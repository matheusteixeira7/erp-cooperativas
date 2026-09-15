import { and, asc, eq, exists, gte, ilike, isNull, lte, or, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { advances, attendances, members, payoutItems, users } from "@/server/db/schema"

export type MemberRow = typeof members.$inferSelect
export type MemberInsert = typeof members.$inferInsert

export type MemberWithFlags = MemberRow & {
  hasRecords: boolean
  accessEmail: string | null
  accessActive: boolean
}

const flagColumns = {
  hasRecords: sql<boolean>`(
    exists(select 1 from ${attendances} where ${attendances.memberId} = ${members.id})
    or exists(select 1 from ${advances} where ${advances.memberId} = ${members.id})
    or exists(select 1 from ${payoutItems} where ${payoutItems.memberId} = ${members.id})
  )`.as("has_records"),
  accessEmail: users.email,
  accessActive: sql<boolean>`coalesce(${users.active}, false)`.as("access_active"),
}

function mapRow(row: { member: MemberRow; hasRecords: boolean; accessEmail: string | null; accessActive: boolean }): MemberWithFlags {
  return { ...row.member, hasRecords: row.hasRecords, accessEmail: row.accessEmail ?? null, accessActive: Boolean(row.accessActive) }
}

export async function listMembers(
  db: DbClient,
  params: { cooperativeId: string; activeOn?: string; includeInactive: boolean; search?: string; today: string },
) {
  const conditions = [eq(members.cooperativeId, params.cooperativeId)]
  if (params.activeOn) {
    conditions.push(lte(members.admittedOn, params.activeOn), or(isNull(members.leftOn), gte(members.leftOn, params.activeOn))!)
  } else if (!params.includeInactive) {
    conditions.push(or(isNull(members.leftOn), gte(members.leftOn, params.today))!)
  }
  if (params.search) {
    const digits = params.search.replace(/\D/g, "")
    const term = `%${params.search.trim()}%`
    conditions.push(digits.length >= 3 ? or(ilike(members.name, term), ilike(members.cpf, `%${digits}%`))! : ilike(members.name, term))
  }
  const rows = await db
    .select({ member: members, ...flagColumns })
    .from(members)
    .leftJoin(users, eq(users.memberId, members.id))
    .where(and(...conditions))
    .orderBy(asc(members.name))
  return rows.map(mapRow)
}

export async function findMember(db: DbClient, cooperativeId: string, id: string) {
  const rows = await db
    .select({ member: members, ...flagColumns })
    .from(members)
    .leftJoin(users, eq(users.memberId, members.id))
    .where(and(eq(members.cooperativeId, cooperativeId), eq(members.id, id)))
    .limit(1)
  const row = rows[0]
  return row ? mapRow(row) : null
}

export async function cpfTaken(db: DbClient, cooperativeId: string, cpf: string, exceptId?: string) {
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.cooperativeId, cooperativeId), eq(members.cpf, cpf)))
    .limit(2)
  return rows.some((r) => r.id !== exceptId)
}

export async function insertMember(db: DbClient, values: MemberInsert) {
  const [row] = await db.insert(members).values(values).returning()
  if (!row) throw new Error("member insert returned nothing")
  return row
}

export async function updateMember(db: DbClient, cooperativeId: string, id: string, values: Partial<MemberInsert>) {
  const [row] = await db
    .update(members)
    .set(values)
    .where(and(eq(members.cooperativeId, cooperativeId), eq(members.id, id)))
    .returning()
  return row ?? null
}

export async function deleteMember(db: DbClient, cooperativeId: string, id: string) {
  await db.delete(users).where(eq(users.memberId, id))
  await db.delete(members).where(and(eq(members.cooperativeId, cooperativeId), eq(members.id, id)))
}

export async function memberHasRecords(db: DbClient, memberId: string) {
  const rows = await db
    .select({ found: sql<boolean>`true` })
    .from(members)
    .where(
      and(
        eq(members.id, memberId),
        or(
          exists(db.select({ one: sql`1` }).from(attendances).where(eq(attendances.memberId, memberId))),
          exists(db.select({ one: sql`1` }).from(advances).where(eq(advances.memberId, memberId))),
          exists(db.select({ one: sql`1` }).from(payoutItems).where(eq(payoutItems.memberId, memberId))),
        ),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export async function findAccessUser(db: DbClient, memberId: string) {
  const rows = await db.select().from(users).where(eq(users.memberId, memberId)).limit(1)
  return rows[0] ?? null
}
