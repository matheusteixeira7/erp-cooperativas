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
      inssRate: 0,
      negativeBalancePolicy: "carry_over",
      includeMembersLeftInPeriod: true,
    },
  }
}

describe("INSS retido antes dos vales (RN-028)", () => {
  it("reproduz a fixture FX-ago-2026-com-inss", () => {
    const input = buildInput()
    input.settings.inssRate = 0.075
    input.members = input.members.map((m) => (m.id === "m6" ? { ...m, inssWithheld: false } : m))
    const outcome = simulatePayout(input)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const r = outcome.result
    const byId = (id: string) => r.items.find((i) => i.memberId === id)!
    // bruto e diária não mudam
    expect(r.dayValue).toBe(213.68)
    expect(r.distributedTotal).toBe(30769.92)
    // Ana: 4700,96 × 7,5% = 352,572 → 352,57; líquido = 4700,96 − 352,57 − 200
    expect(byId("m1").inssBase).toBe(4700.96)
    expect(byId("m1").inssRate).toBe(0.075)
    expect(byId("m1").inssAmount).toBe(352.57)
    expect(byId("m1").netAmount).toBe(4148.39)
    // Roberto: 4487,28 × 7,5% = 336,546 → 336,55 (half-even sobe porque 0,6 > 0,5)
    expect(byId("m5").inssAmount).toBe(336.55)
    expect(byId("m5").netAmount).toBe(3900.73)
    // Fernanda não contribui pelo sistema
    expect(byId("m6").inssRate).toBe(0)
    expect(byId("m6").inssAmount).toBe(0)
    expect(byId("m6").netAmount).toBe(4700.96)
    expect(r.inssTotal).toBe(1955.17)
    expect(r.totalNet).toBe(27694.75)
    expect(r.warnings.some((w) => w.includes("Fernanda Lima") && w.includes("INSS"))).toBe(true)
  })

  it("com alíquota zero nada muda em relação ao cálculo antigo", () => {
    const outcome = simulatePayout(buildInput())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.inssTotal).toBe(0)
    expect(outcome.result.totalNet).toBe(29649.92)
  })

  it("saldo devedor é calculado sobre bruto − INSS (FX-out-2026-compras-inss)", () => {
    const outcome = simulatePayout({
      period: "2026-10",
      sales: [{ soldOn: "2026-10-20", totalAmount: 11000 }],
      purchases: [
        { purchasedOn: "2026-10-03", totalAmount: 600 },
        { purchasedOn: "2026-10-15", totalAmount: 900 },
      ],
      expenses: [{ incurredOn: "2026-10-10", amount: 1000 }],
      attendances: [
        ...Array.from({ length: 20 }, (_, i) => ({ memberId: "p1", date: `2026-10-${String(i + 1).padStart(2, "0")}`, present: true })),
        { memberId: "p2", date: "2026-10-01", present: true },
        { memberId: "p2", date: "2026-10-02", present: true },
      ],
      members: [
        { id: "p1", name: "Paulo Prensa", admittedOn: "2026-01-01" },
        { id: "p2", name: "Rita Reciclo", admittedOn: "2026-01-01" },
      ],
      advances: [{ id: "adv-rita", memberId: "p2", amount: 700, grantedOn: "2026-10-06", status: "pending" }],
      settings: { legalReserveRate: 0.1, fatesRate: 0.05, otherFundsRate: 0, inssRate: 0.075, negativeBalancePolicy: "carry_over", includeMembersLeftInPeriod: true },
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const r = outcome.result
    expect(r.totalPurchases).toBe(1500)
    expect(r.surplus).toBe(8500)
    expect(r.distributableSurplus).toBe(7225)
    expect(r.dayValue).toBe(328.4)
    const rita = r.items.find((i) => i.memberId === "p2")!
    expect(rita.grossAmount).toBe(656.8)
    expect(rita.inssAmount).toBe(49.26)
    expect(rita.netAmount).toBe(0)
    // sem INSS seria 43,20; com INSS retido antes, 700 − 607,54
    expect(rita.carryOverDebt).toBe(92.46)
    expect(r.inssTotal).toBe(541.86)
    expect(r.totalNet).toBe(6075.4)
  })
})

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

  it("compras de material reduzem a sobra em linha própria (RN-003)", () => {
    const input = buildInput()
    input.purchases = [
      { purchasedOn: "2026-08-03", totalAmount: 1500 },
      { purchasedOn: "2026-08-10", totalAmount: 999, deletedAt: "2026-08-11T00:00:00" }, // excluída: não conta
      { purchasedOn: "2026-09-01", totalAmount: 999 }, // outro mês: não conta
    ]
    const outcome = simulatePayout(input)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.totalPurchases).toBe(1500)
    expect(outcome.result.totalExpenses).toBe(12300)
    expect(outcome.result.surplus).toBe(34700)
    // fundos: 3470 + 1735 → distribuível 29495
    expect(outcome.result.distributableSurplus).toBe(29495)
  })

  it("sem compras, totalPurchases é zero e nada muda", () => {
    const outcome = simulatePayout(buildInput())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.totalPurchases).toBe(0)
    expect(outcome.result.surplus).toBe(36200)
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
