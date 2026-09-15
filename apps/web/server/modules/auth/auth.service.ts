/**
 * Authentication use cases: login, signup, logout and session resolution.
 * Sessions are opaque random tokens stored hashed in the database and sent to
 * the browser as an httpOnly cookie (NF-006).
 */
import { createHash, randomBytes } from "node:crypto"

import type { DbClient } from "@/server/db/client"
import { cooperatives, materialTypes, users } from "@/server/db/schema"
import { audit } from "@/server/shared/audit"
import { DomainError } from "@/server/shared/errors"
import { hashPassword, verifyPassword } from "@/server/shared/password"
import type { Role, Session } from "@/server/trpc/context"

import { deleteSessionByTokenHash, emailExists, findActiveSession, findUserByEmail, insertSession, type CooperativeRow, type UserRow } from "./auth.repository"
import { DEFAULT_MATERIAL_TYPES } from "./default-material-types"

export const SESSION_COOKIE = "erp_session"
const SESSION_DAYS = 30

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const index = part.indexOf("=")
    if (index === -1) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function sessionCookieHeader(token: string | null) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  if (!token) return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure}`
}

function toSession(user: UserRow, cooperative: CooperativeRow, token: string): NonNullable<Session> {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      cooperativeId: user.cooperativeId,
      roles: user.roles as Role[],
      memberId: user.memberId,
    },
    cooperative: {
      id: cooperative.id,
      name: cooperative.tradeName ?? cooperative.legalName,
      timezone: cooperative.timezone,
    },
    token,
  }
}

export async function resolveSessionFromCookieHeader(db: DbClient, cookieHeader: string | null): Promise<Session> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE]
  if (!token) return null
  const found = await findActiveSession(db, hashToken(token))
  if (!found) return null
  return toSession(found.user, found.cooperative, token)
}

async function startSession(db: DbClient, user: UserRow, cooperative: CooperativeRow) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await insertSession(db, { userId: user.id, tokenHash: hashToken(token), expiresAt })
  return toSession(user, cooperative, token)
}

// --- rate limit: 5 attempts per minute per key (API-auth-login) ---

const attempts = new Map<string, { count: number; resetAt: number }>()
const LIMIT = 5
const WINDOW_MS = 60_000

export function assertLoginAllowed(key: string, now = Date.now()) {
  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
  if (entry.count > LIMIT) throw new DomainError("TOO_MANY_ATTEMPTS")
}

export function resetLoginAttempts(key: string) {
  attempts.delete(key)
}

export async function login(db: DbClient, input: { email: string; password: string; rateKey?: string }) {
  const email = input.email.trim().toLowerCase()
  const key = `${input.rateKey ?? "local"}:${email}`
  assertLoginAllowed(key)

  const user = await findUserByEmail(db, email)
  // Same message for unknown e-mail and wrong password (ERR-AUTH-003).
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new DomainError("INVALID_CREDENTIALS")
  const cooperative = await db.query.cooperatives.findFirst({ where: (c, { eq }) => eq(c.id, user.cooperativeId) })
  if (!cooperative) throw new DomainError("INVALID_CREDENTIALS")

  resetLoginAttempts(key)
  const session = await startSession(db, user, cooperative)
  await audit(db, { cooperativeId: user.cooperativeId, userId: user.id, action: "login", entity: "users", entityId: user.id })
  return session
}

export async function logout(db: DbClient, session: NonNullable<Session>) {
  await deleteSessionByTokenHash(db, hashToken(session.token))
  await audit(db, { cooperativeId: session.user.cooperativeId, userId: session.user.id, action: "logout", entity: "users", entityId: session.user.id })
}

export async function signup(
  db: DbClient,
  input: { cooperativeName: string; managerName: string; email: string; password: string },
) {
  const email = input.email.trim().toLowerCase()
  if (await emailExists(db, email)) throw new DomainError("EMAIL_TAKEN")
  const passwordHash = await hashPassword(input.password)

  const result = await db.transaction(async (tx) => {
    const [cooperative] = await tx
      .insert(cooperatives)
      .values({ legalName: input.cooperativeName.trim(), tradeName: input.cooperativeName.trim() })
      .returning()
    if (!cooperative) throw new Error("cooperative insert returned nothing")
    const [user] = await tx
      .insert(users)
      .values({
        cooperativeId: cooperative.id,
        email,
        name: input.managerName.trim(),
        roles: ["manager", "operator"],
        passwordHash,
      })
      .returning()
    if (!user) throw new Error("user insert returned nothing")
    await tx.insert(materialTypes).values(
      DEFAULT_MATERIAL_TYPES.map((m, index) => ({ ...m, cooperativeId: cooperative.id, sortOrder: index })),
    )
    await audit(tx, { cooperativeId: cooperative.id, userId: user.id, action: "create", entity: "cooperatives", entityId: cooperative.id, after: cooperative })
    return { cooperative, user }
  })

  return startSession(db, result.user, result.cooperative)
}
