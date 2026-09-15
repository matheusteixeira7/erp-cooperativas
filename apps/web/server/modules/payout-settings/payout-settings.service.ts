/**
 * Versioned payout parameters (DEC-002, DEC-006, RN-010, RN-026, RN-028).
 */
import { and, desc, eq, lte } from "drizzle-orm"

import { INSS_RATE_MAX, LEGAL_DEFAULT_SETTINGS } from "@/lib/domain/payout"
import type { DbClient } from "@/server/db/client"
import { payoutSettings, type PayoutSettingsSnapshot } from "@/server/db/schema"
import type { Actor } from "@/server/modules/shared/actor"
import { closedPayoutIdForPeriod } from "@/server/modules/shared/period-lock"
import { audit } from "@/server/shared/audit"
import { firstDayOf } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

export type PayoutSettingsVersionDto = PayoutSettingsSnapshot & {
  createdBy: string
  createdAt: string
}

const LEGAL_DEFAULT_VERSION: PayoutSettingsVersionDto = {
  id: null,
  effectiveFrom: "1970-01",
  ...LEGAL_DEFAULT_SETTINGS,
  isLegalDefault: true,
  createdBy: "sistema",
  createdAt: "1970-01-01T00:00:00.000Z",
}

export function isLegalDefault(v: { legalReserveRate: number; fatesRate: number; otherFundsRate: number }) {
  return v.legalReserveRate === 0.1 && v.fatesRate === 0.05 && v.otherFundsRate === 0
}

function toDto(row: typeof payoutSettings.$inferSelect): PayoutSettingsVersionDto {
  return {
    id: row.id,
    effectiveFrom: row.effectiveFrom.slice(0, 7),
    legalReserveRate: row.legalReserveRate,
    fatesRate: row.fatesRate,
    otherFundsRate: row.otherFundsRate,
    inssRate: row.inssRate,
    negativeBalancePolicy: row.negativeBalancePolicy,
    includeMembersLeftInPeriod: row.includeMembersLeftInPeriod,
    isLegalDefault: isLegalDefault(row),
    createdBy: row.createdByName,
    createdAt: row.createdAt,
  }
}

/** RN-026: the version with the greatest effectiveFrom ≤ period, else the legal defaults. */
export async function settingsForPeriod(db: DbClient, cooperativeId: string, period: string): Promise<PayoutSettingsVersionDto> {
  const rows = await db
    .select()
    .from(payoutSettings)
    .where(and(eq(payoutSettings.cooperativeId, cooperativeId), lte(payoutSettings.effectiveFrom, firstDayOf(period))))
    .orderBy(desc(payoutSettings.effectiveFrom))
    .limit(1)
  return rows[0] ? toDto(rows[0]) : LEGAL_DEFAULT_VERSION
}

export function toSnapshot(version: PayoutSettingsVersionDto): PayoutSettingsSnapshot {
  return {
    id: version.id,
    effectiveFrom: version.effectiveFrom,
    legalReserveRate: version.legalReserveRate,
    fatesRate: version.fatesRate,
    otherFundsRate: version.otherFundsRate,
    inssRate: version.inssRate,
    negativeBalancePolicy: version.negativeBalancePolicy,
    includeMembersLeftInPeriod: version.includeMembersLeftInPeriod,
    isLegalDefault: version.isLegalDefault,
  }
}

export async function getSettings(db: DbClient, actor: Actor, period: string) {
  const [current, history] = await Promise.all([
    settingsForPeriod(db, actor.cooperativeId, period),
    db.select().from(payoutSettings).where(eq(payoutSettings.cooperativeId, actor.cooperativeId)).orderBy(desc(payoutSettings.effectiveFrom), desc(payoutSettings.createdAt)),
  ])
  return { current, isDefault: current.id === null, history: history.map(toDto) }
}

export type UpdateSettingsInput = {
  effectiveFrom: string
  legalReserveRate: number
  fatesRate: number
  otherFundsRate: number
  inssRate: number
  negativeBalancePolicy: "carry_over" | "forgive"
  includeMembersLeftInPeriod: boolean
}

export async function updateSettings(db: DbClient, actor: Actor, input: UpdateSettingsInput) {
  if (input.legalReserveRate < 0.1 || input.fatesRate < 0.05) throw new DomainError("SETTINGS_BELOW_LEGAL_MINIMUM")
  if (input.otherFundsRate < 0 || input.legalReserveRate + input.fatesRate + input.otherFundsRate >= 1) {
    throw new DomainError("VALIDATION", "A soma dos fundos precisa ser menor que 100%.")
  }
  if (input.inssRate < 0 || input.inssRate > INSS_RATE_MAX) throw new DomainError("SETTINGS_INSS_RATE_OUT_OF_RANGE")
  if (await closedPayoutIdForPeriod(db, actor.cooperativeId, input.effectiveFrom)) throw new DomainError("PERIOD_CLOSED")

  return db.transaction(async (tx) => {
    const values = {
      cooperativeId: actor.cooperativeId,
      effectiveFrom: firstDayOf(input.effectiveFrom),
      legalReserveRate: input.legalReserveRate,
      fatesRate: input.fatesRate,
      otherFundsRate: input.otherFundsRate,
      inssRate: input.inssRate,
      negativeBalancePolicy: input.negativeBalancePolicy,
      includeMembersLeftInPeriod: input.includeMembersLeftInPeriod,
      createdBy: actor.userId,
      createdByName: actor.userName,
    }
    // One version per (cooperative, effectiveFrom): saving the same month again replaces it.
    const [row] = await tx
      .insert(payoutSettings)
      .values(values)
      .onConflictDoUpdate({ target: [payoutSettings.cooperativeId, payoutSettings.effectiveFrom], set: values })
      .returning()
    if (!row) throw new Error("settings insert returned nothing")
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "payout_settings", entityId: row.id, after: row })
    return toDto(row)
  })
}
