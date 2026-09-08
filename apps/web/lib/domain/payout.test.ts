// @vitest-environment node

import { describe, expect, it } from "vitest"

import { itemSubtotal, roundHalfEven, simulatePayout, type PayoutInput } from "./payout"

// Mirrors estudo/spec/80-testes/fixtures.json → FX-ago-2026-com-fundos
const members = [
  { id: "m1", name: "Ana Maria Silva", admittedOn: "2024-01-10", workedDays: 22, advance: 200 },
  { id: "m2", name: "Carlos Eduardo Santos", admittedOn: "2024-01-10", workedDays: 20, advance: 150 },
  { id: "m3", name: "João Pedro Oliveira", admittedOn: "2024-01-10", workedDays: 18, advance: 300 },
  { id: "m4", name: "Maria Aparecida Costa", admittedOn: "2024-01-10", workedDays: 22, advance: 100 },
  { id: "m5", name: "Roberto Souza", admittedOn: "2024-01-10", workedDays: 21, advance: 250 },
  { id: "m6", name: "Fernanda Lima", admittedOn: "2024-01-10", workedDays: 22, advance: 0 },
  { id: "m7", name: "Gabriel Martins", admittedOn: "2024-01-10", workedDays: 19, advance: 120 },
]

function buildInput(): PayoutInput {
  const attendances = members.flatMap((m) =>
    Array.from({ length: m.workedDays }, (_, i) => ({
      memberId: m.id,
      date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      present: true,
    })),
  )
  return {
    period: "2026-08",
    sales: [
      { soldOn: "2026-08-08", totalAmount: 3200 * 3.2 + 12600 * 0.65 },
      { soldOn: "2026-08-19", totalAmount: 2500 * 6.4 + 2000 * 2.0 },
      { soldOn: "2026-08-28", totalAmount: 4028 * 2.5 },
    ],
    expenses: [
      { incurredOn: "2026-08-10", amount: 850 },
      { incurredOn: "2026-08-15", amount: 420 },
      { incurredOn: "2026-08-18", amount: 1250 },
      { incurredOn: "2026-08-05", amount: 6000 },
      { incurredOn: "2026-08-30", amount: 3780 },
    ],
    attendances,
    members: members.map(({ id, name, admittedOn }) => ({ id, name, admittedOn })),
    advances: members
      .filter((m) => m.advance > 0)
      .map((m) => ({
        id: `adv-${m.id}`,
        memberId: m.id,
        amount: m.advance,
        grantedOn: "2026-08-12",
        status: "pending",
      })),
    settings: {
      legalReserveRate: 0.1,
      fatesRate: 0.05,
      otherFundsRate: 0,
      negativeBalancePolicy: "carry_over",
      includeMembersLeftInPeriod: true,
    },
  }
}

describe("simulatePayout", () => {
  it("reproduz a fixture FX-ago-2026-com-fundos", () => {
    const outcome = simulatePayout(buildInput())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const r = outcome.result
    expect(r.grossRevenue).toBe(48500)
    expect(r.totalExpenses).toBe(12300)
    expect(r.surplus).toBe(36200)
    expect(r.legalReserveAmount).toBe(3620)
    expect(r.fatesAmount).toBe(1810)
    expect(r.distributableSurplus).toBe(30770)
    expect(r.totalWorkedDays).toBe(144)
    expect(r.dayValue).toBe(213.68)
    expect(r.distributedTotal).toBe(30769.92)
    expect(r.roundingResidual).toBeCloseTo(0.08, 2)
    expect(r.totalDeductions).toBe(1120)
    expect(r.totalNet).toBe(29649.92)
    const ana = r.items.find((i) => i.memberId === "m1")
    expect(ana?.grossAmount).toBe(4700.96)
    expect(ana?.netAmount).toBe(4500.96)
  })

  it("retorna NO_SURPLUS quando despesas superam vendas (RN-004)", () => {
    const input = buildInput()
    input.sales = []
    const outcome = simulatePayout(input)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.code).toBe("NO_SURPLUS")
  })

  it("retorna NO_ATTENDANCE sem presenças (RN-006)", () => {
    const input = buildInput()
    input.attendances = []
    const outcome = simulatePayout(input)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.code).toBe("NO_ATTENDANCE")
  })

  it("gera saldo devedor quando o vale supera o bruto (RN-009)", () => {
    const input = buildInput()
    input.advances.push({ id: "big", memberId: "m7", amount: 10000, grantedOn: "2026-08-20", status: "pending" })
    const outcome = simulatePayout(input)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const gabriel = outcome.result.items.find((i) => i.memberId === "m7")
    expect(gabriel?.netAmount).toBe(0)
    expect(gabriel?.carryOverDebt).toBeCloseTo(10120 - 4059.92, 2)
  })
})

describe("arredondamento", () => {
  it("half-even", () => {
    expect(roundHalfEven(2.5)).toBe(2)
    expect(roundHalfEven(3.5)).toBe(4)
    expect(roundHalfEven(2.51)).toBe(3)
  })
  it("subtotal do item", () => {
    expect(itemSubtotal(3200, 3.2)).toBe(10240)
    expect(itemSubtotal(12600, 0.65)).toBe(8190)
  })
})
