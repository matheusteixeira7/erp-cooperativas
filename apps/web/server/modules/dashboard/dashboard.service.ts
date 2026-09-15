/**
 * Numbers for the home screen (UI-inicio). Read-only aggregation over the
 * other modules' tables; no business rule lives here.
 */
import { and, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { advances, attendances, buyers, expenses, members, payoutItems, payouts, purchases, sales } from "@/server/db/schema"
import { activeMembersOn } from "@/server/modules/attendance/attendance.service"
import { simulate } from "@/server/modules/payouts/payouts.service"
import type { Actor } from "@/server/modules/shared/actor"
import { closedPayoutIdForPeriod } from "@/server/modules/shared/period-lock"
import { addMonths, currentPeriod, firstDayOf, lastDayOf, todayIso } from "@/server/shared/dates"

export async function summary(db: DbClient, actor: Actor) {
  const today = todayIso(actor.timezone)
  const period = currentPeriod(actor.timezone)
  const previousPeriod = addMonths(period, -1)
  const start = firstDayOf(period)
  const end = lastDayOf(period)
  const tenant = actor.cooperativeId

  const [activeToday, todayRows, salesAgg, purchasesAgg, expensesAgg, pendingAgg, workedDays, previousClosedId, lastClosed, recentSales] = await Promise.all([
    activeMembersOn(db, tenant, today),
    db.select({ present: attendances.present }).from(attendances).where(and(eq(attendances.cooperativeId, tenant), eq(attendances.date, today))),
    db
      .select({ amount: sql<number>`coalesce(sum(${sales.totalAmount}), 0)::float8`, weightKg: sql<number>`coalesce(sum(${sales.totalWeightKg}), 0)::float8`, count: count() })
      .from(sales)
      .where(and(eq(sales.cooperativeId, tenant), isNull(sales.deletedAt), gte(sales.soldOn, start), lte(sales.soldOn, end))),
    db
      .select({ amount: sql<number>`coalesce(sum(${purchases.totalAmount}), 0)::float8` })
      .from(purchases)
      .where(and(eq(purchases.cooperativeId, tenant), isNull(purchases.deletedAt), gte(purchases.purchasedOn, start), lte(purchases.purchasedOn, end))),
    db
      .select({ amount: sql<number>`coalesce(sum(${expenses.amount}), 0)::float8` })
      .from(expenses)
      .where(and(eq(expenses.cooperativeId, tenant), isNull(expenses.deletedAt), gte(expenses.incurredOn, start), lte(expenses.incurredOn, end))),
    db
      .select({ amount: sql<number>`coalesce(sum(${advances.amount}), 0)::float8`, count: count() })
      .from(advances)
      .where(and(eq(advances.cooperativeId, tenant), eq(advances.status, "pending"))),
    db
      .select({ count: count() })
      .from(attendances)
      .where(and(eq(attendances.cooperativeId, tenant), eq(attendances.present, true), gte(attendances.date, start), lte(attendances.date, end))),
    closedPayoutIdForPeriod(db, tenant, previousPeriod),
    db
      .select({ id: payouts.id, period: payouts.period })
      .from(payouts)
      .where(and(eq(payouts.cooperativeId, tenant), eq(payouts.status, "closed")))
      .orderBy(desc(payouts.period))
      .limit(1),
    db
      .select({ id: sales.id, soldOn: sales.soldOn, buyerName: buyers.name, totalWeightKg: sales.totalWeightKg, totalAmount: sales.totalAmount })
      .from(sales)
      .innerJoin(buyers, eq(buyers.id, sales.buyerId))
      .where(and(eq(sales.cooperativeId, tenant), isNull(sales.deletedAt)))
      .orderBy(desc(sales.soldOn), desc(sales.createdAt))
      .limit(5),
  ])

  const last = lastClosed[0] ?? null
  const unpaid = last
    ? await db
        .select({ count: count() })
        .from(payoutItems)
        .where(and(eq(payoutItems.payoutId, last.id), isNull(payoutItems.paidAt), sql`${payoutItems.netAmount} > 0`))
    : null

  let previousSimulation: { distributableSurplus: number } | null = null
  if (!previousClosedId && actor.roles.includes("manager")) {
    const sim = await simulate(db, actor, previousPeriod)
    if (sim.outcome.ok) previousSimulation = { distributableSurplus: sim.outcome.result.distributableSurplus }
  }

  const revenue = salesAgg[0]?.amount ?? 0
  const purchasesTotal = purchasesAgg[0]?.amount ?? 0
  const expensesTotal = expensesAgg[0]?.amount ?? 0

  // Closed months among the recent sales, so the UI can badge them.
  const recentPeriods = [...new Set(recentSales.map((s) => s.soldOn.slice(0, 7)))]
  const closedPeriods = (
    await Promise.all(recentPeriods.map(async (p) => ((await closedPayoutIdForPeriod(db, tenant, p)) ? p : null)))
  ).filter((p): p is string => p !== null)

  return {
    today,
    period,
    previousPeriod,
    attendance: { done: todayRows.length > 0, present: todayRows.filter((r) => r.present).length, active: activeToday.length },
    sales: { amount: revenue, weightKg: salesAgg[0]?.weightKg ?? 0, count: salesAgg[0]?.count ?? 0 },
    purchases: purchasesTotal,
    expenses: expensesTotal,
    partialSurplus: Math.round((revenue - purchasesTotal - expensesTotal) * 100) / 100,
    workedDays: workedDays[0]?.count ?? 0,
    pendingAdvances: { count: pendingAgg[0]?.count ?? 0, amount: pendingAgg[0]?.amount ?? 0 },
    previousPeriodClosed: previousClosedId !== null,
    previousSimulation,
    lastClosed: last ? { id: last.id, period: last.period.slice(0, 7), unpaidCount: unpaid?.[0]?.count ?? 0 } : null,
    recentSales: recentSales.map((s) => ({ ...s, periodClosed: closedPeriods.includes(s.soldOn.slice(0, 7)) })),
    activeMembersCount: (
      await db
        .select({ count: count() })
        .from(members)
        .where(and(eq(members.cooperativeId, tenant), sql`(${members.leftOn} is null or ${members.leftOn} >= ${today})`))
    )[0]?.count ?? 0,
  }
}
