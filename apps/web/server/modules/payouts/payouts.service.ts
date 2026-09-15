/**
 * Payout (rateio) use cases: simulate, close, reopen, list, detail, mark paid,
 * member statement and exports. The calculation itself is the pure function in
 * lib/domain/payout.ts (RN-001..RN-012, RN-020, RN-028); this module only reads
 * the inputs and persists the snapshot (RN-008, RN-009, RN-025).
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm"

import { simulatePayout, toCents, type PayoutResult, type SimulationOutcome } from "@/lib/domain/payout"
import type { DbClient } from "@/server/db/client"
import { advances, attendances, expenses, members, payoutItems, payouts, purchases, sales } from "@/server/db/schema"
import { toAdvanceDto, type AdvanceDto } from "@/server/modules/finance/finance.service"
import { settingsForPeriod, toSnapshot } from "@/server/modules/payout-settings/payout-settings.service"
import type { Actor } from "@/server/modules/shared/actor"
import { closedPayoutIdForPeriod } from "@/server/modules/shared/period-lock"
import { audit } from "@/server/shared/audit"
import { addMonths, currentPeriod, firstDayOf, lastDayOf, nowIso } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

// ---------- DTOs ----------

export type PayoutItemDto = {
  id: string
  payoutId: string
  memberId: string
  memberNameSnapshot: string
  workedDays: number
  grossAmount: number
  inssBase: number
  inssRate: number
  inssAmount: number
  deductionsAmount: number
  netAmount: number
  carryOverDebt: number
  paidAt: string | null
}

export type PayoutDto = {
  id: string
  period: string
  status: "closed" | "reopened"
  grossRevenue: number
  totalPurchases: number
  totalExpenses: number
  surplus: number
  legalReserveAmount: number
  fatesAmount: number
  otherFundsAmount: number
  distributableSurplus: number
  totalWorkedDays: number
  dayValue: number
  distributedTotal: number
  roundingResidual: number
  inssTotal: number
  totalDeductions: number
  totalNet: number
  settingsSnapshot: typeof payouts.$inferSelect["settingsSnapshot"]
  closedBy: string
  closedAt: string
  reopenedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
  items: PayoutItemDto[]
}

function toItemDto(row: typeof payoutItems.$inferSelect): PayoutItemDto {
  return {
    id: row.id,
    payoutId: row.payoutId,
    memberId: row.memberId,
    memberNameSnapshot: row.memberNameSnapshot,
    workedDays: row.workedDays,
    grossAmount: row.grossAmount,
    inssBase: row.inssBase,
    inssRate: row.inssRate,
    inssAmount: row.inssAmount,
    deductionsAmount: row.deductionsAmount,
    netAmount: row.netAmount,
    carryOverDebt: row.carryOverDebt,
    paidAt: row.paidAt,
  }
}

function toPayoutDto(row: typeof payouts.$inferSelect, items: (typeof payoutItems.$inferSelect)[]): PayoutDto {
  return {
    id: row.id,
    period: row.period.slice(0, 7),
    status: row.status,
    grossRevenue: row.grossRevenue,
    totalPurchases: row.totalPurchases,
    totalExpenses: row.totalExpenses,
    surplus: row.surplus,
    legalReserveAmount: row.legalReserveAmount,
    fatesAmount: row.fatesAmount,
    otherFundsAmount: row.otherFundsAmount,
    distributableSurplus: row.distributableSurplus,
    totalWorkedDays: row.totalWorkedDays,
    dayValue: row.dayValue,
    distributedTotal: row.distributedTotal,
    roundingResidual: row.roundingResidual,
    inssTotal: row.inssTotal,
    totalDeductions: row.totalDeductions,
    totalNet: row.totalNet,
    settingsSnapshot: row.settingsSnapshot,
    closedBy: row.closedByName,
    closedAt: row.closedAt,
    reopenedBy: row.reopenedByName,
    reopenedAt: row.reopenedAt,
    reopenReason: row.reopenReason,
    items: [...items].sort((a, b) => a.memberNameSnapshot.localeCompare(b.memberNameSnapshot, "pt-BR")).map(toItemDto),
  }
}

// ---------- simulation ----------

/** Loads everything the pure calculation needs for one month (RN-003, RN-005, RN-020). */
async function loadSimulationInput(db: DbClient, cooperativeId: string, period: string) {
  const start = firstDayOf(period)
  const end = lastDayOf(period)
  const [saleRows, purchaseRows, expenseRows, attendanceRows, memberRows, advanceRows, settings] = await Promise.all([
    db
      .select({ soldOn: sales.soldOn, totalAmount: sales.totalAmount })
      .from(sales)
      .where(and(eq(sales.cooperativeId, cooperativeId), isNull(sales.deletedAt), gte(sales.soldOn, start), lte(sales.soldOn, end))),
    db
      .select({ purchasedOn: purchases.purchasedOn, totalAmount: purchases.totalAmount })
      .from(purchases)
      .where(and(eq(purchases.cooperativeId, cooperativeId), isNull(purchases.deletedAt), gte(purchases.purchasedOn, start), lte(purchases.purchasedOn, end))),
    db
      .select({ incurredOn: expenses.incurredOn, amount: expenses.amount })
      .from(expenses)
      .where(and(eq(expenses.cooperativeId, cooperativeId), isNull(expenses.deletedAt), gte(expenses.incurredOn, start), lte(expenses.incurredOn, end))),
    db
      .select({ memberId: attendances.memberId, date: attendances.date, present: attendances.present })
      .from(attendances)
      .where(and(eq(attendances.cooperativeId, cooperativeId), gte(attendances.date, start), lte(attendances.date, end))),
    db
      .select({ id: members.id, name: members.name, cpf: members.cpf, admittedOn: members.admittedOn, leftOn: members.leftOn, inssWithheld: members.inssWithheld })
      .from(members)
      // Members active at any point up to the end of the month (RN-007 filters the rest).
      .where(and(eq(members.cooperativeId, cooperativeId), lte(members.admittedOn, end), or(isNull(members.leftOn), gte(members.leftOn, start)))),
    db
      .select({ id: advances.id, memberId: advances.memberId, amount: advances.amount, grantedOn: advances.grantedOn, status: advances.status })
      .from(advances)
      .where(and(eq(advances.cooperativeId, cooperativeId), eq(advances.status, "pending"), lte(advances.grantedOn, end))),
    settingsForPeriod(db, cooperativeId, period),
  ])
  return { saleRows, purchaseRows, expenseRows, attendanceRows, memberRows, advanceRows, settings }
}

export async function simulate(db: DbClient, actor: Actor, period: string) {
  const input = await loadSimulationInput(db, actor.cooperativeId, period)
  const outcome: SimulationOutcome = simulatePayout({
    period,
    sales: input.saleRows,
    purchases: input.purchaseRows,
    expenses: input.expenseRows,
    attendances: input.attendanceRows,
    members: input.memberRows,
    advances: input.advanceRows,
    settings: {
      legalReserveRate: input.settings.legalReserveRate,
      fatesRate: input.settings.fatesRate,
      otherFundsRate: input.settings.otherFundsRate,
      inssRate: input.settings.inssRate,
      negativeBalancePolicy: input.settings.negativeBalancePolicy,
      includeMembersLeftInPeriod: input.settings.includeMembersLeftInPeriod,
    },
  })
  const closedPayoutId = await closedPayoutIdForPeriod(db, actor.cooperativeId, period)
  const warnings = outcome.ok ? [...outcome.result.warnings] : []
  if (outcome.ok && period === currentPeriod(actor.timezone)) warnings.unshift("O mês corrente ainda não terminou: presenças e vendas de hoje em diante ficarão de fora.")
  return {
    outcome: outcome.ok ? { ...outcome, result: { ...outcome.result, warnings } } : outcome,
    settingsVersion: input.settings,
    periodClosed: closedPayoutId !== null,
    closedPayoutId,
    memberCpfById: new Map(input.memberRows.map((m) => [m.id, m.cpf])),
  }
}

// ---------- close / reopen ----------

export async function close(db: DbClient, actor: Actor, input: { period: string; confirmDistributableSurplus: number }) {
  if (input.period > currentPeriod(actor.timezone)) throw new DomainError("PERIOD_IN_FUTURE")

  return db.transaction(async (tx) => {
    // Lock per (cooperative, period) so two managers cannot close at once (API-payouts-close).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${actor.cooperativeId}:${input.period}`}))`)
    if (await closedPayoutIdForPeriod(tx, actor.cooperativeId, input.period)) throw new DomainError("PAYOUT_ALREADY_CLOSED")

    const simulation = await simulate(tx, actor, input.period)
    if (!simulation.outcome.ok) {
      throw new DomainError(simulation.outcome.code === "NO_SURPLUS" ? "PAYOUT_NO_SURPLUS" : "PAYOUT_NO_ATTENDANCE")
    }
    const result: PayoutResult = simulation.outcome.result
    if (toCents(result.distributableSurplus) !== toCents(input.confirmDistributableSurplus)) {
      throw new DomainError("PAYOUT_CHANGED_SINCE_SIMULATION")
    }

    const [payout] = await tx
      .insert(payouts)
      .values({
        cooperativeId: actor.cooperativeId,
        period: firstDayOf(input.period),
        status: "closed",
        grossRevenue: result.grossRevenue,
        totalPurchases: result.totalPurchases,
        totalExpenses: result.totalExpenses,
        surplus: result.surplus,
        legalReserveAmount: result.legalReserveAmount,
        fatesAmount: result.fatesAmount,
        otherFundsAmount: result.otherFundsAmount,
        distributableSurplus: result.distributableSurplus,
        totalWorkedDays: result.totalWorkedDays,
        dayValue: result.dayValue,
        distributedTotal: result.distributedTotal,
        roundingResidual: result.roundingResidual,
        inssTotal: result.inssTotal,
        totalDeductions: result.totalDeductions,
        totalNet: result.totalNet,
        settingsSnapshot: toSnapshot(simulation.settingsVersion),
        closedBy: actor.userId,
        closedByName: actor.userName,
      })
      .returning()
    if (!payout) throw new Error("payout insert returned nothing")

    const items = await tx
      .insert(payoutItems)
      .values(
        result.items.map((item) => ({
          payoutId: payout.id,
          memberId: item.memberId,
          memberNameSnapshot: item.memberName,
          memberCpfSnapshot: simulation.memberCpfById.get(item.memberId) ?? "",
          workedDays: item.workedDays,
          grossAmount: item.grossAmount,
          inssBase: item.inssBase,
          inssRate: item.inssRate,
          inssAmount: item.inssAmount,
          deductionsAmount: item.deductionsAmount,
          netAmount: item.netAmount,
          carryOverDebt: item.carryOverDebt,
        })),
      )
      .returning()

    // RN-008: advances considered are now deducted.
    const deductedIds = result.items.flatMap((i) => i.advanceIds)
    if (deductedIds.length > 0) {
      await tx
        .update(advances)
        .set({ status: "deducted", deductedInPayoutId: payout.id, updatedAt: sql`now()` })
        .where(and(eq(advances.cooperativeId, actor.cooperativeId), inArray(advances.id, deductedIds)))
    }

    // RN-009: carry-over debts become pending advances in the next month.
    const carryOvers = result.items.filter((i) => i.carryOverDebt > 0)
    if (carryOvers.length > 0) {
      const nextPeriodStart = firstDayOf(addMonths(input.period, 1))
      await tx.insert(advances).values(
        carryOvers.map((item) => ({
          cooperativeId: actor.cooperativeId,
          memberId: item.memberId,
          kind: "carry_over" as const,
          description: `Saldo devedor de ${input.period}`,
          amount: item.carryOverDebt,
          grantedOn: nextPeriodStart,
          status: "pending" as const,
          originAdvanceId: item.advanceIds[0] ?? null,
          generatedByPayoutId: payout.id,
          createdBy: actor.userId,
        })),
      )
    }

    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "close", entity: "payouts", entityId: payout.id, after: { period: input.period, distributableSurplus: result.distributableSurplus } })
    return toPayoutDto(payout, items)
  })
}

export async function reopen(db: DbClient, actor: Actor, input: { id: string; reason: string }) {
  return db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(and(eq(payouts.cooperativeId, actor.cooperativeId), eq(payouts.id, input.id)))
      .for("update")
      .limit(1)
    if (!payout) throw new DomainError("PAYOUT_NOT_FOUND")
    if (payout.status !== "closed") throw new DomainError("PAYOUT_NOT_CLOSED")

    const [updated] = await tx
      .update(payouts)
      .set({ status: "reopened", reopenedBy: actor.userId, reopenedByName: actor.userName, reopenedAt: nowIso(), reopenReason: input.reason.trim() })
      .where(eq(payouts.id, input.id))
      .returning()
    if (!updated) throw new DomainError("PAYOUT_NOT_FOUND")

    // RN-023: deducted advances go back to pending; generated carry-overs are cancelled.
    await tx
      .update(advances)
      .set({ status: "pending", deductedInPayoutId: null, updatedAt: sql`now()` })
      .where(and(eq(advances.cooperativeId, actor.cooperativeId), eq(advances.deductedInPayoutId, input.id)))
    await tx
      .update(advances)
      .set({ status: "cancelled", cancelReason: "Mês de origem reaberto", updatedAt: sql`now()` })
      .where(and(eq(advances.cooperativeId, actor.cooperativeId), eq(advances.generatedByPayoutId, input.id), eq(advances.status, "pending")))

    const items = await tx.select().from(payoutItems).where(eq(payoutItems.payoutId, input.id))
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "reopen", entity: "payouts", entityId: input.id, after: { reason: input.reason } })
    return toPayoutDto(updated, items)
  })
}

// ---------- reads ----------

export async function list(db: DbClient, actor: Actor) {
  const rows = await db
    .select()
    .from(payouts)
    .where(eq(payouts.cooperativeId, actor.cooperativeId))
    .orderBy(desc(payouts.period), desc(payouts.closedAt))
  if (rows.length === 0) return { items: [] as PayoutDto[], nextCursor: null as string | null }
  const items = await db.select().from(payoutItems).where(inArray(payoutItems.payoutId, rows.map((r) => r.id)))
  const byPayout = new Map<string, (typeof payoutItems.$inferSelect)[]>()
  for (const item of items) {
    const list = byPayout.get(item.payoutId) ?? []
    list.push(item)
    byPayout.set(item.payoutId, list)
  }
  return { items: rows.map((row) => toPayoutDto(row, byPayout.get(row.id) ?? [])), nextCursor: null as string | null }
}

export async function byId(db: DbClient, actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.cooperativeId, actor.cooperativeId), eq(payouts.id, id)))
    .limit(1)
  if (!row) throw new DomainError("PAYOUT_NOT_FOUND")
  const [items, deducted] = await Promise.all([
    db.select().from(payoutItems).where(eq(payoutItems.payoutId, id)),
    db
      .select({ advance: advances, memberName: members.name })
      .from(advances)
      .innerJoin(members, eq(members.id, advances.memberId))
      .where(and(eq(advances.cooperativeId, actor.cooperativeId), eq(advances.deductedInPayoutId, id)))
      .orderBy(asc(members.name), asc(advances.grantedOn)),
  ])
  return { ...toPayoutDto(row, items), deductedAdvances: deducted.map((d) => toAdvanceDto(d.advance, d.memberName)) }
}

export async function markPaid(db: DbClient, actor: Actor, input: { payoutId: string; memberIds: string[]; paid: boolean; paidAt?: string }) {
  const [row] = await db
    .select({ id: payouts.id, status: payouts.status })
    .from(payouts)
    .where(and(eq(payouts.cooperativeId, actor.cooperativeId), eq(payouts.id, input.payoutId)))
    .limit(1)
  if (!row) throw new DomainError("PAYOUT_NOT_FOUND")
  if (row.status !== "closed") throw new DomainError("PAYOUT_NOT_CLOSED", "Só é possível marcar pagamentos em um mês fechado.")
  const updated = await db
    .update(payoutItems)
    .set({ paidAt: input.paid ? (input.paidAt ?? nowIso()) : null })
    .where(and(eq(payoutItems.payoutId, input.payoutId), inArray(payoutItems.memberId, input.memberIds), sql`${payoutItems.netAmount} > 0`))
    .returning({ id: payoutItems.id })
  await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "payout_items", entityId: input.payoutId, after: { memberIds: input.memberIds, paid: input.paid } })
  return { updated: updated.length }
}

export async function markAllPaid(db: DbClient, actor: Actor, payoutId: string) {
  const [row] = await db
    .select({ id: payouts.id, status: payouts.status })
    .from(payouts)
    .where(and(eq(payouts.cooperativeId, actor.cooperativeId), eq(payouts.id, payoutId)))
    .limit(1)
  if (!row) throw new DomainError("PAYOUT_NOT_FOUND")
  if (row.status !== "closed") throw new DomainError("PAYOUT_NOT_CLOSED", "Só é possível marcar pagamentos em um mês fechado.")
  const updated = await db
    .update(payoutItems)
    .set({ paidAt: nowIso() })
    .where(and(eq(payoutItems.payoutId, payoutId), isNull(payoutItems.paidAt), sql`${payoutItems.netAmount} > 0`))
    .returning({ id: payoutItems.id })
  await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "payout_items", entityId: payoutId, after: { all: true } })
  return { updated: updated.length }
}

// ---------- member statement (UI-extrato-cooperado) ----------

export type MemberStatementDto = {
  period: string
  member: { id: string; name: string; admittedOn: string }
  presences: string[]
  closed: {
    payout: Pick<PayoutDto, "id" | "period" | "dayValue" | "totalWorkedDays" | "closedAt" | "inssTotal">
    item: PayoutItemDto
    deductedAdvances: AdvanceDto[]
  } | null
  pendingAdvances: AdvanceDto[]
}

export async function memberStatement(db: DbClient, actor: Actor, input: { period: string; memberId?: string }): Promise<MemberStatementDto | null> {
  // member: memberId forced to the session's own member; manager: memberId required.
  const memberId = actor.roles.includes("member") && actor.memberId ? actor.memberId : input.memberId
  if (!memberId) throw new DomainError("FORBIDDEN_ROLE")
  const [member] = await db
    .select({ id: members.id, name: members.name, admittedOn: members.admittedOn })
    .from(members)
    .where(and(eq(members.cooperativeId, actor.cooperativeId), eq(members.id, memberId)))
    .limit(1)
  if (!member) return null

  const start = firstDayOf(input.period)
  const end = lastDayOf(input.period)
  const [presenceRows, payoutRow, pendingRows] = await Promise.all([
    db
      .select({ date: attendances.date })
      .from(attendances)
      .where(and(eq(attendances.memberId, memberId), eq(attendances.present, true), gte(attendances.date, start), lte(attendances.date, end)))
      .orderBy(asc(attendances.date)),
    db
      .select()
      .from(payouts)
      .where(and(eq(payouts.cooperativeId, actor.cooperativeId), eq(payouts.period, start), eq(payouts.status, "closed")))
      .limit(1),
    db
      .select()
      .from(advances)
      .where(and(eq(advances.memberId, memberId), eq(advances.status, "pending"), lte(advances.grantedOn, end)))
      .orderBy(asc(advances.grantedOn)),
  ])

  let closed: MemberStatementDto["closed"] = null
  const payout = payoutRow[0]
  if (payout) {
    const [item] = await db
      .select()
      .from(payoutItems)
      .where(and(eq(payoutItems.payoutId, payout.id), eq(payoutItems.memberId, memberId)))
      .limit(1)
    if (item) {
      const deducted = await db
        .select()
        .from(advances)
        .where(and(eq(advances.memberId, memberId), eq(advances.deductedInPayoutId, payout.id)))
        .orderBy(asc(advances.grantedOn))
      closed = {
        payout: { id: payout.id, period: input.period, dayValue: payout.dayValue, totalWorkedDays: payout.totalWorkedDays, closedAt: payout.closedAt, inssTotal: payout.inssTotal },
        item: toItemDto(item),
        deductedAdvances: deducted.map((a) => toAdvanceDto(a, member.name)),
      }
    }
  }

  return {
    period: input.period,
    member,
    presences: presenceRows.map((r) => r.date),
    closed,
    pendingAdvances: pendingRows.map((a) => toAdvanceDto(a, member.name)),
  }
}

// ---------- export helpers (CSV/PDF built in payouts.export.ts) ----------

export async function loadForExport(db: DbClient, actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.cooperativeId, actor.cooperativeId), eq(payouts.id, id)))
    .limit(1)
  if (!row) throw new DomainError("PAYOUT_NOT_FOUND")
  const items = await db.select().from(payoutItems).where(eq(payoutItems.payoutId, id)).orderBy(asc(payoutItems.memberNameSnapshot))
  return { payout: toPayoutDto(row, items), cpfByMember: new Map(items.map((i) => [i.memberId, i.memberCpfSnapshot])) }
}
