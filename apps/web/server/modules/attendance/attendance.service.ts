/**
 * Daily attendance (RN-005, RN-011, RN-013, RN-014).
 */
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { attendances, members } from "@/server/db/schema"
import type { Actor } from "@/server/modules/shared/actor"
import { assertPeriodOpen, periodStatus } from "@/server/modules/shared/period-lock"
import { audit } from "@/server/shared/audit"
import { firstDayOf, lastDayOf, periodOf, todayIso } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

export async function activeMembersOn(db: DbClient, cooperativeId: string, date: string) {
  return db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.cooperativeId, cooperativeId), lte(members.admittedOn, date), or(isNull(members.leftOn), gte(members.leftOn, date))))
    .orderBy(asc(members.name))
}

export async function byDate(db: DbClient, actor: Actor, date: string) {
  const [activeMembers, recorded, status] = await Promise.all([
    activeMembersOn(db, actor.cooperativeId, date),
    db
      .select({ memberId: attendances.memberId, present: attendances.present })
      .from(attendances)
      .where(and(eq(attendances.cooperativeId, actor.cooperativeId), eq(attendances.date, date))),
    periodStatus(db, actor.cooperativeId, periodOf(date)),
  ])
  const recordedByMember = new Map(recorded.map((r) => [r.memberId, r.present]))
  return {
    date,
    periodClosed: status.closed,
    closedPayoutId: status.payoutId,
    recorded: recorded.length > 0,
    entries: activeMembers.map((m) => ({
      memberId: m.id,
      memberName: m.name,
      present: recordedByMember.get(m.id) ?? false,
    })),
  }
}

export async function saveDaily(db: DbClient, actor: Actor, input: { date: string; entries: { memberId: string; present: boolean; note?: string }[] }) {
  if (input.date > todayIso(actor.timezone)) throw new DomainError("VALIDATION", "A data da chamada não pode ser futura.")
  if (input.entries.length === 0) throw new DomainError("VALIDATION")
  await assertPeriodOpen(db, actor.cooperativeId, input.date)

  const eligible = await activeMembersOn(db, actor.cooperativeId, input.date)
  const eligibleIds = new Set(eligible.map((m) => m.id))
  const allMembers = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.cooperativeId, actor.cooperativeId), inArray(members.id, input.entries.map((e) => e.memberId))))
  const known = new Set(allMembers.map((m) => m.id))
  for (const entry of input.entries) {
    if (!known.has(entry.memberId)) throw new DomainError("MEMBER_NOT_FOUND")
    if (!eligibleIds.has(entry.memberId)) throw new DomainError("MEMBER_INACTIVE_ON_DATE")
  }

  // RN-013/RN-014: atomic upsert of the whole list.
  await db.transaction(async (tx) => {
    await tx
      .insert(attendances)
      .values(
        input.entries.map((entry) => ({
          cooperativeId: actor.cooperativeId,
          memberId: entry.memberId,
          date: input.date,
          present: entry.present,
          note: entry.note?.trim() || null,
          recordedBy: actor.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [attendances.memberId, attendances.date],
        set: {
          present: sql`excluded.present`,
          note: sql`excluded.note`,
          recordedBy: sql`excluded.recorded_by`,
          updatedAt: sql`now()`,
        },
      })
    await audit(tx, {
      cooperativeId: actor.cooperativeId,
      userId: actor.userId,
      action: "update",
      entity: "attendances",
      entityId: input.date,
      after: { date: input.date, present: input.entries.filter((e) => e.present).map((e) => e.memberId) },
    })
  })

  return { saved: input.entries.length, presentCount: input.entries.filter((e) => e.present).length }
}

export async function mine(db: DbClient, actor: Actor, period: string) {
  if (!actor.memberId) throw new DomainError("FORBIDDEN_ROLE")
  const rows = await db
    .select({ date: attendances.date, present: attendances.present })
    .from(attendances)
    .where(
      and(
        eq(attendances.cooperativeId, actor.cooperativeId),
        eq(attendances.memberId, actor.memberId),
        gte(attendances.date, firstDayOf(period)),
        lte(attendances.date, lastDayOf(period)),
      ),
    )
    .orderBy(asc(attendances.date))
  return { period, workedDays: rows.filter((r) => r.present).length, days: rows }
}
