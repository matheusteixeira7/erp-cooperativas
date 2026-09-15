/**
 * RN-011: a month with a closed payout is immutable. Every write use case that
 * touches dated entries (attendance, sales, purchases, expenses, advances)
 * calls `assertPeriodOpen` first.
 */
import { and, eq } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { payouts } from "@/server/db/schema"
import { firstDayOf, periodOf } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

export async function closedPayoutIdForPeriod(db: DbClient, cooperativeId: string, period: string) {
  const rows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(and(eq(payouts.cooperativeId, cooperativeId), eq(payouts.period, firstDayOf(period)), eq(payouts.status, "closed")))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function periodStatus(db: DbClient, cooperativeId: string, period: string) {
  const payoutId = await closedPayoutIdForPeriod(db, cooperativeId, period)
  return { period, closed: payoutId !== null, payoutId }
}

export async function assertPeriodOpen(db: DbClient, cooperativeId: string, isoDate: string) {
  if (await closedPayoutIdForPeriod(db, cooperativeId, periodOf(isoDate))) {
    throw new DomainError("PERIOD_CLOSED")
  }
}
