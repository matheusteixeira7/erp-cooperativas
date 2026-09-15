import { and, eq, gt, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { cooperatives, sessions, users } from "@/server/db/schema"

export type UserRow = typeof users.$inferSelect
export type CooperativeRow = typeof cooperatives.$inferSelect

export async function findUserByEmail(db: DbClient, email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), eq(users.active, true)))
    .limit(1)
  return rows[0] ?? null
}

export async function findCooperativeById(db: DbClient, id: string) {
  const rows = await db.select().from(cooperatives).where(eq(cooperatives.id, id)).limit(1)
  return rows[0] ?? null
}

export async function insertSession(db: DbClient, input: { userId: string; tokenHash: string; expiresAt: string }) {
  await db.insert(sessions).values(input)
}

export async function deleteSessionByTokenHash(db: DbClient, tokenHash: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

/** Active (non-expired) session joined with its user and cooperative. */
export async function findActiveSession(db: DbClient, tokenHash: string) {
  const rows = await db
    .select({ user: users, cooperative: cooperatives, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(cooperatives, eq(cooperatives.id, users.cooperativeId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, sql`now()`), eq(users.active, true)))
    .limit(1)
  return rows[0] ?? null
}

export async function emailExists(db: DbClient, email: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return rows.length > 0
}
