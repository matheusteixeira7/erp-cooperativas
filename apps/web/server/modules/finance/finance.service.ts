/**
 * Operating expenses and member advances (vales). RN-011, RN-020, RN-021, RN-022.
 */
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { advances, expenses, members } from "@/server/db/schema"
import type { Actor } from "@/server/modules/shared/actor"
import { assertPeriodOpen, periodStatus } from "@/server/modules/shared/period-lock"
import { audit } from "@/server/shared/audit"
import { firstDayOf, lastDayOf, nowIso, todayIso } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

// ---------- expenses ----------

export type ExpenseDto = {
  id: string
  description: string
  category: string
  amount: number
  incurredOn: string
  createdAt: string
}

function toExpenseDto(row: typeof expenses.$inferSelect): ExpenseDto {
  return { id: row.id, description: row.description, category: row.category ?? "outros", amount: row.amount, incurredOn: row.incurredOn, createdAt: row.createdAt }
}

export async function listExpenses(db: DbClient, actor: Actor, input: { period: string }) {
  const where = and(
    eq(expenses.cooperativeId, actor.cooperativeId),
    isNull(expenses.deletedAt),
    gte(expenses.incurredOn, firstDayOf(input.period)),
    lte(expenses.incurredOn, lastDayOf(input.period)),
  )
  const [rows, status] = await Promise.all([
    db.select().from(expenses).where(where).orderBy(desc(expenses.incurredOn), desc(expenses.createdAt)),
    periodStatus(db, actor.cooperativeId, input.period),
  ])
  const items = rows.map(toExpenseDto)
  return {
    items,
    nextCursor: null as string | null,
    total: Math.round(items.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
    periodClosed: status.closed,
    closedPayoutId: status.payoutId,
  }
}

export async function createExpense(db: DbClient, actor: Actor, input: { description: string; category?: string; amount: number; incurredOn: string }) {
  if (input.amount <= 0) throw new DomainError("VALIDATION", "O valor da despesa deve ser maior que zero.")
  if (input.incurredOn > todayIso(actor.timezone)) throw new DomainError("VALIDATION", "A data da despesa não pode ser futura.")
  await assertPeriodOpen(db, actor.cooperativeId, input.incurredOn)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        cooperativeId: actor.cooperativeId,
        description: input.description.trim(),
        category: input.category ?? null,
        amount: Math.round(input.amount * 100) / 100,
        incurredOn: input.incurredOn,
        createdBy: actor.userId,
      })
      .returning()
    if (!row) throw new Error("expense insert returned nothing")
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "expenses", entityId: row.id, after: row })
    return toExpenseDto(row)
  })
}

export async function deleteExpense(db: DbClient, actor: Actor, id: string, reason?: string) {
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.cooperativeId, actor.cooperativeId), eq(expenses.id, id), isNull(expenses.deletedAt)))
    .limit(1)
  if (!row) throw new DomainError("EXPENSE_NOT_FOUND")
  await assertPeriodOpen(db, actor.cooperativeId, row.incurredOn)
  await db.transaction(async (tx) => {
    await tx.update(expenses).set({ deletedAt: nowIso() }).where(eq(expenses.id, id))
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "delete", entity: "expenses", entityId: id, before: row, after: { reason: reason ?? null } })
  })
  return { ok: true as const }
}

// ---------- advances ----------

export type AdvanceDto = {
  id: string
  memberId: string
  memberName: string
  kind: "cash_advance" | "purchase" | "carry_over" | "other"
  description: string
  amount: number
  grantedOn: string
  status: "pending" | "deducted" | "cancelled"
  deductedInPayoutId: string | null
  originAdvanceId: string | null
  generatedByPayoutId: string | null
  cancelReason: string | null
  createdAt: string
}

export function toAdvanceDto(row: typeof advances.$inferSelect, memberName: string): AdvanceDto {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName,
    kind: row.kind,
    description: row.description,
    amount: row.amount,
    grantedOn: row.grantedOn,
    status: row.status,
    deductedInPayoutId: row.deductedInPayoutId,
    originAdvanceId: row.originAdvanceId,
    generatedByPayoutId: row.generatedByPayoutId,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
  }
}

export async function listAdvances(
  db: DbClient,
  actor: Actor,
  input: { status?: "pending" | "deducted" | "cancelled"; memberId?: string; period?: string },
) {
  const conditions = [eq(advances.cooperativeId, actor.cooperativeId)]
  if (input.status) conditions.push(eq(advances.status, input.status))
  if (input.memberId) conditions.push(eq(advances.memberId, input.memberId))
  if (input.period) conditions.push(gte(advances.grantedOn, firstDayOf(input.period)), lte(advances.grantedOn, lastDayOf(input.period)))
  const [rows, status] = await Promise.all([
    db
      .select({ advance: advances, memberName: members.name })
      .from(advances)
      .innerJoin(members, eq(members.id, advances.memberId))
      .where(and(...conditions))
      .orderBy(desc(advances.grantedOn), desc(advances.createdAt)),
    input.period ? periodStatus(db, actor.cooperativeId, input.period) : Promise.resolve(null),
  ])
  const items = rows.map((r) => toAdvanceDto(r.advance, r.memberName))
  return {
    items,
    nextCursor: null as string | null,
    total: Math.round(items.reduce((sum, a) => sum + a.amount, 0) * 100) / 100,
    periodClosed: status?.closed ?? false,
    closedPayoutId: status?.payoutId ?? null,
  }
}

export async function createAdvance(
  db: DbClient,
  actor: Actor,
  input: { memberId: string; kind?: "cash_advance" | "purchase" | "other"; description: string; amount: number; grantedOn: string },
) {
  if (input.amount <= 0) throw new DomainError("VALIDATION", "O valor do vale deve ser maior que zero.")
  if (input.grantedOn > todayIso(actor.timezone)) throw new DomainError("VALIDATION", "A data do vale não pode ser futura.")
  await assertPeriodOpen(db, actor.cooperativeId, input.grantedOn)
  const [member] = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.cooperativeId, actor.cooperativeId), eq(members.id, input.memberId)))
    .limit(1)
  if (!member) throw new DomainError("MEMBER_NOT_FOUND")
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(advances)
      .values({
        cooperativeId: actor.cooperativeId,
        memberId: input.memberId,
        kind: input.kind ?? "cash_advance",
        description: input.description.trim(),
        amount: Math.round(input.amount * 100) / 100,
        grantedOn: input.grantedOn,
        createdBy: actor.userId,
      })
      .returning()
    if (!row) throw new Error("advance insert returned nothing")
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "advances", entityId: row.id, after: row })
    return toAdvanceDto(row, member.name)
  })
}

export async function cancelAdvance(db: DbClient, actor: Actor, id: string, reason: string) {
  const [found] = await db
    .select({ advance: advances, memberName: members.name })
    .from(advances)
    .innerJoin(members, eq(members.id, advances.memberId))
    .where(and(eq(advances.cooperativeId, actor.cooperativeId), eq(advances.id, id)))
    .limit(1)
  if (!found) throw new DomainError("ADVANCE_NOT_FOUND")
  if (found.advance.status !== "pending") throw new DomainError("ADVANCE_NOT_PENDING")
  await assertPeriodOpen(db, actor.cooperativeId, found.advance.grantedOn)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(advances)
      .set({ status: "cancelled", cancelReason: reason.trim(), updatedAt: sql`now()` })
      .where(eq(advances.id, id))
      .returning()
    if (!row) throw new DomainError("ADVANCE_NOT_FOUND")
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "advances", entityId: id, before: found.advance, after: row })
    return toAdvanceDto(row, found.memberName)
  })
}
