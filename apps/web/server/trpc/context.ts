/**
 * Request context. The session is resolved here, at the transport edge, from
 * the httpOnly session cookie; routers never read headers or cookies.
 *
 * `createInnerTRPCContext` is what tests and server-side callers use: it takes
 * an explicit session and database client and skips HTTP entirely.
 */
import type { DbClient } from "@/server/db/client"
import { resolveSessionFromCookieHeader } from "@/server/modules/auth/auth.service"

export type Role = "manager" | "operator" | "member"

export type Session = {
  user: {
    id: string
    name: string
    email: string
    cooperativeId: string
    roles: Role[]
    memberId: string | null
  }
  cooperative: {
    id: string
    name: string
    timezone: string
  }
  /** Raw session token, needed by auth.logout to revoke this session. */
  token: string
} | null

export type InnerContextOptions = {
  session?: Session
  db: DbClient
  /** Response headers the auth router uses to set/clear the session cookie. */
  resHeaders?: Headers
}

export function createInnerTRPCContext(options: InnerContextOptions) {
  return {
    session: options.session ?? null,
    db: options.db,
    resHeaders: options.resHeaders ?? new Headers(),
  }
}

export async function createTRPCContext(options: { headers: Headers; resHeaders: Headers }) {
  // Imported lazily so the module graph stays free of `server-only` for tests.
  const { db } = await import("@/server/db")
  const session = await resolveSessionFromCookieHeader(db, options.headers.get("cookie"))
  return createInnerTRPCContext({ session, db, resHeaders: options.resHeaders })
}

export type TRPCContext = ReturnType<typeof createInnerTRPCContext>
