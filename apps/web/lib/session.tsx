"use client"

/**
 * Session state for the app shell. The server owns authentication (httpOnly
 * cookie resolved in createTRPCContext); this provider only mirrors
 * `auth.session` and keeps the UI-only "active role" choice in localStorage.
 */
import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import type { Role } from "@/lib/domain/enums"
import { useTRPC, useTRPCClient, type RouterOutputs } from "@/lib/trpc/client"

export type SessionUser = NonNullable<RouterOutputs["auth"]["session"]>["user"]

export type Session = {
  userId: string
  name: string
  email: string
  roles: Role[]
  activeRole: Role
  memberId: string | null
  cooperativeName: string
  timezone: string
}

const ROLE_PRIORITY: Role[] = ["manager", "operator", "member"]
const ROLE_STORAGE_PREFIX = "erp-cooperativas.active-role:"

function readStoredRole(userId: string): Role | null {
  try {
    const raw = window.localStorage.getItem(`${ROLE_STORAGE_PREFIX}${userId}`)
    return raw === "manager" || raw === "operator" || raw === "member" ? raw : null
  } catch {
    return null
  }
}

function storeRole(userId: string, role: Role) {
  try {
    window.localStorage.setItem(`${ROLE_STORAGE_PREFIX}${userId}`, role)
  } catch {
    // storage unavailable: role resets on reload, nothing else breaks
  }
}

/** tRPC query keys start with the procedure path: ["auth","session"] for the session query. */
function isSessionQuery(queryKey: readonly unknown[]) {
  const path = queryKey[0]
  return Array.isArray(path) && path[0] === "auth" && path[1] === "session"
}

function defaultRole(roles: Role[]) {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0] ?? "member"
}

type SessionContextValue = {
  /** `undefined` while loading, `null` when logged out. */
  session: Session | null | undefined
  /** Network/server failure while resolving the session. */
  error: string | null
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<Session>
  logout: () => Promise<void>
  switchRole: (role: Role) => void
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

function buildSession(user: SessionUser, activeRole: Role): Session {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    activeRole,
    memberId: user.memberId,
    cooperativeName: user.cooperative.name,
    timezone: user.cooperative.timezone,
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const queryClient = useQueryClient()
  const query = useQuery(trpc.auth.session.queryOptions(undefined, { staleTime: 60_000, retry: 1 }))
  const [roleOverride, setRoleOverride] = React.useState<{ userId: string; role: Role } | null>(null)

  const user = query.data?.user ?? null
  const session = React.useMemo<Session | null | undefined>(() => {
    if (query.isPending) return undefined
    if (!user) return null
    const stored = roleOverride?.userId === user.id ? roleOverride.role : typeof window !== "undefined" ? readStoredRole(user.id) : null
    const activeRole = stored && user.roles.includes(stored) ? stored : defaultRole(user.roles)
    return buildSession(user, activeRole)
  }, [query.isPending, user, roleOverride])

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.auth.session.queryKey() })
  }, [queryClient, trpc])

  const login = React.useCallback(
    async (email: string, password: string) => {
      const result = await client.auth.login.mutate({ email: email.trim(), password })
      // Keep the session observer alive (clear() would detach it): set the new
      // session, then drop every other cached query so nothing leaks between users.
      queryClient.setQueryData(trpc.auth.session.queryKey(), result)
      queryClient.removeQueries({ predicate: (query) => !isSessionQuery(query.queryKey) })
      const role = readStoredRole(result.user.id) ?? defaultRole(result.user.roles)
      return buildSession(result.user, result.user.roles.includes(role) ? role : defaultRole(result.user.roles))
    },
    [client, queryClient, trpc],
  )

  const logout = React.useCallback(async () => {
    try {
      await client.auth.logout.mutate()
    } catch {
      // Cookie may already be gone; the UI treats it as logged out anyway.
    }
    queryClient.setQueryData(trpc.auth.session.queryKey(), null)
    queryClient.removeQueries({ predicate: (query) => !isSessionQuery(query.queryKey) })
  }, [client, queryClient, trpc])

  const switchRole = React.useCallback(
    (role: Role) => {
      if (!user || !user.roles.includes(role)) return
      storeRole(user.id, role)
      setRoleOverride({ userId: user.id, role })
      // Data visibility differs by role (e.g. PIX keys): refetch everything.
      void queryClient.invalidateQueries({ predicate: (query) => !isSessionQuery(query.queryKey) })
    },
    [user, queryClient, trpc],
  )

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session,
      error: query.isError ? "Não foi possível verificar sua sessão. Confira a conexão e tente de novo." : null,
      refresh,
      login,
      logout,
      switchRole,
    }),
    [session, query.isError, refresh, login, logout, switchRole],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = React.useContext(SessionContext)
  if (!context) throw new Error("useSession must be used within SessionProvider")
  return context
}

/** Session guaranteed to exist (used inside the authenticated shell). */
export function useRequiredSession() {
  const { session, ...rest } = useSession()
  if (!session) throw new Error("Session required")
  return { session, ...rest }
}
