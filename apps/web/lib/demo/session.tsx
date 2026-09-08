"use client"

// Mock authentication. Session lives in localStorage so a page refresh keeps the user logged in.

import * as React from "react"

import { DemoError } from "@/lib/demo/errors"
import { COOPERATIVE_NAME, DEMO_USERS } from "@/lib/demo/seed"
import type { Role, Session } from "@/lib/demo/types"

const STORAGE_KEY = "erp-cooperativas.demo-session"

// --- tiny external store around localStorage (works with useSyncExternalStore) ---

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function getServerSnapshot(): string | null | undefined {
  return undefined
}

function writeStorage(session: Session | null) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable: nothing to persist
  }
  listeners.forEach((listener) => listener())
}

function parseSession(raw: string | null | undefined): Session | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

type SessionContextValue = {
  /** `undefined` while hydrating, `null` when logged out. */
  session: Session | null | undefined
  login: (email: string, password: string) => Promise<Session>
  loginAs: (role: Role) => Promise<Session>
  logout: () => void
  switchRole: (role: Role) => void
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

const ROLE_PRIORITY: Role[] = ["manager", "operator", "member"]

function buildSession(user: (typeof DEMO_USERS)[number]): Session {
  const activeRole = ROLE_PRIORITY.find((r) => user.roles.includes(r)) ?? user.roles[0] ?? "member"
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    activeRole,
    memberId: user.memberId,
    cooperativeName: COOPERATIVE_NAME,
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const raw = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const session = React.useMemo(() => parseSession(raw), [raw])

  const login = React.useCallback(async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    const user = DEMO_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || user.password !== password) throw new DemoError("ERR-AUTH-003")
    const next = buildSession(user)
    writeStorage(next)
    return next
  }, [])

  const loginAs = React.useCallback(
    async (role: Role) => {
      const user = DEMO_USERS.find((u) => u.roles[0] === role) ?? DEMO_USERS[0]!
      return login(user.email, user.password)
    },
    [login],
  )

  const logout = React.useCallback(() => writeStorage(null), [])

  const switchRole = React.useCallback(
    (role: Role) => {
      if (!session || !session.roles.includes(role)) return
      writeStorage({ ...session, activeRole: role })
    },
    [session],
  )

  const value = React.useMemo(
    () => ({ session, login, loginAs, logout, switchRole }),
    [session, login, loginAs, logout, switchRole],
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
