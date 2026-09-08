// Pure payout calculation (RN-001..RN-012, RN-020). No I/O. Money handled in integer cents.

import { isInPeriod, lastDayOf } from "@/lib/dates"

export type NegativeBalancePolicy = "carry_over" | "forgive"

export type PayoutSettings = {
  legalReserveRate: number
  fatesRate: number
  otherFundsRate: number
  negativeBalancePolicy: NegativeBalancePolicy
  includeMembersLeftInPeriod: boolean
}

export const LEGAL_DEFAULT_SETTINGS: PayoutSettings = {
  legalReserveRate: 0.1,
  fatesRate: 0.05,
  otherFundsRate: 0,
  negativeBalancePolicy: "carry_over",
  includeMembersLeftInPeriod: true,
}

export type PayoutInput = {
  period: string
  sales: { soldOn: string; totalAmount: number; deletedAt?: string | null }[]
  expenses: { incurredOn: string; amount: number; deletedAt?: string | null }[]
  attendances: { memberId: string; date: string; present: boolean }[]
  members: { id: string; name: string; admittedOn: string; leftOn?: string | null }[]
  advances: { id: string; memberId: string; amount: number; grantedOn: string; status: string }[]
  settings: PayoutSettings
}

export type PayoutItemResult = {
  memberId: string
  memberName: string
  workedDays: number
  grossAmount: number
  deductionsAmount: number
  netAmount: number
  carryOverDebt: number
  advanceIds: string[]
}

export type PayoutResult = {
  period: string
  grossRevenue: number
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
  totalDeductions: number
  totalNet: number
  items: PayoutItemResult[]
  warnings: string[]
  settings: PayoutSettings
}

export type PayoutErrorCode = "NO_SURPLUS" | "NO_ATTENDANCE"

export type SimulationOutcome =
  | { ok: true; result: PayoutResult }
  | { ok: false; code: PayoutErrorCode; details: { grossRevenue: number; totalExpenses: number; surplus: number } }

export function toCents(value: number) {
  return Math.round(value * 100)
}

export function fromCents(cents: number) {
  return cents / 100
}

/** Round to integer using banker's rounding (half to even). */
export function roundHalfEven(value: number) {
  const floor = Math.floor(value)
  const diff = value - floor
  const epsilon = 1e-9
  if (diff > 0.5 + epsilon) return floor + 1
  if (diff < 0.5 - epsilon) return floor
  return floor % 2 === 0 ? floor : floor + 1
}

/** subtotal = round_half_even(weight × price, 2) — RN-015 */
export function itemSubtotal(weightKg: number, pricePerKg: number) {
  return fromCents(roundHalfEven(weightKg * pricePerKg * 100))
}

export function simulatePayout(input: PayoutInput): SimulationOutcome {
  const { period, settings } = input
  const periodEnd = lastDayOf(period)

  // RN-003: competence by entry date, soft-deleted rows ignored.
  const grossRevenueCents = input.sales
    .filter((s) => !s.deletedAt && isInPeriod(s.soldOn, period))
    .reduce((sum, s) => sum + toCents(s.totalAmount), 0)
  const totalExpensesCents = input.expenses
    .filter((e) => !e.deletedAt && isInPeriod(e.incurredOn, period))
    .reduce((sum, e) => sum + toCents(e.amount), 0)
  const surplusCents = grossRevenueCents - totalExpensesCents

  const details = {
    grossRevenue: fromCents(grossRevenueCents),
    totalExpenses: fromCents(totalExpensesCents),
    surplus: fromCents(surplusCents),
  }

  // RN-004
  if (surplusCents <= 0) {
    return { ok: false, code: "NO_SURPLUS", details }
  }

  // RN-005 / RN-007: worked days per eligible member.
  const presencesInPeriod = input.attendances.filter(
    (a) => a.present && isInPeriod(a.date, period),
  )
  if (presencesInPeriod.length === 0) {
    return { ok: false, code: "NO_ATTENDANCE", details }
  }

  const workedDaysByMember = new Map<string, number>()
  for (const attendance of presencesInPeriod) {
    workedDaysByMember.set(
      attendance.memberId,
      (workedDaysByMember.get(attendance.memberId) ?? 0) + 1,
    )
  }

  const warnings: string[] = []

  const eligibleMembers = input.members.filter((member) => {
    const days = workedDaysByMember.get(member.id) ?? 0
    const leftInsidePeriod = member.leftOn ? isInPeriod(member.leftOn, period) : false
    const leftBeforePeriod = member.leftOn ? member.leftOn < `${period}-01` : false
    if (leftBeforePeriod) return false
    if (leftInsidePeriod && !settings.includeMembersLeftInPeriod) {
      if (days > 0) warnings.push(`${member.name} foi desligado em ${period} e ficou fora do rateio (configuração da cooperativa).`)
      return false
    }
    // Active member with zero presence still appears with 0 days (RN-007).
    return true
  })

  const zeroDayMembers = eligibleMembers.filter((m) => (workedDaysByMember.get(m.id) ?? 0) === 0)
  if (zeroDayMembers.length > 0) {
    warnings.push(
      `${zeroDayMembers.length} cooperado(s) sem nenhuma presença no mês: ${zeroDayMembers.map((m) => m.name).join(", ")}.`,
    )
  }

  const totalWorkedDays = eligibleMembers.reduce(
    (sum, m) => sum + (workedDaysByMember.get(m.id) ?? 0),
    0,
  )
  if (totalWorkedDays === 0) {
    return { ok: false, code: "NO_ATTENDANCE", details }
  }

  // RN-010: legal funds retained before distribution, half-even rounding.
  const legalReserveCents = roundHalfEven(surplusCents * settings.legalReserveRate)
  const fatesCents = roundHalfEven(surplusCents * settings.fatesRate)
  const otherFundsCents = roundHalfEven(surplusCents * settings.otherFundsRate)
  const distributableCents = surplusCents - legalReserveCents - fatesCents - otherFundsCents

  // RN-001 / RN-012: day value truncated down.
  const dayValueCents = Math.floor(distributableCents / totalWorkedDays)

  // RN-020: pending advances granted up to the last day of the period.
  const pendingAdvances = input.advances.filter(
    (a) => a.status === "pending" && a.grantedOn <= periodEnd,
  )

  const items: PayoutItemResult[] = eligibleMembers
    .map((member) => {
      const workedDays = workedDaysByMember.get(member.id) ?? 0
      const grossCents = workedDays * dayValueCents
      const memberAdvances = pendingAdvances.filter((a) => a.memberId === member.id)
      const deductionsCents = memberAdvances.reduce((sum, a) => sum + toCents(a.amount), 0)
      const netCents = Math.max(0, grossCents - deductionsCents)
      const debtCents =
        settings.negativeBalancePolicy === "carry_over"
          ? Math.max(0, deductionsCents - grossCents)
          : 0
      if (deductionsCents > grossCents) {
        warnings.push(
          settings.negativeBalancePolicy === "carry_over"
            ? `${member.name}: vales (${fromCents(deductionsCents).toFixed(2)}) maiores que o bruto. Saldo devedor passa para o mês seguinte.`
            : `${member.name}: vales maiores que o bruto. A diferença será perdoada (política da cooperativa).`,
        )
      }
      return {
        memberId: member.id,
        memberName: member.name,
        workedDays,
        grossAmount: fromCents(grossCents),
        deductionsAmount: fromCents(deductionsCents),
        netAmount: fromCents(netCents),
        carryOverDebt: fromCents(debtCents),
        advanceIds: memberAdvances.map((a) => a.id),
      }
    })
    .sort((a, b) => a.memberName.localeCompare(b.memberName, "pt-BR"))

  const distributedCents = items.reduce((sum, i) => sum + toCents(i.grossAmount), 0)
  const totalDeductionsCents = items.reduce((sum, i) => sum + toCents(i.deductionsAmount), 0)
  const totalNetCents = items.reduce((sum, i) => sum + toCents(i.netAmount), 0)

  return {
    ok: true,
    result: {
      period,
      grossRevenue: fromCents(grossRevenueCents),
      totalExpenses: fromCents(totalExpensesCents),
      surplus: fromCents(surplusCents),
      legalReserveAmount: fromCents(legalReserveCents),
      fatesAmount: fromCents(fatesCents),
      otherFundsAmount: fromCents(otherFundsCents),
      distributableSurplus: fromCents(distributableCents),
      totalWorkedDays,
      dayValue: fromCents(dayValueCents),
      distributedTotal: fromCents(distributedCents),
      roundingResidual: fromCents(distributableCents - distributedCents),
      totalDeductions: fromCents(totalDeductionsCents),
      totalNet: fromCents(totalNetCents),
      items,
      warnings,
      settings,
    },
  }
}
