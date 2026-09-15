/**
 * Deterministic demo dataset for "Cooperativa Recicla Vida". Numbers for
 * August/2026 mirror estudo/spec/80-testes/fixtures.json. Used by the seed
 * script and by the router tests, so every id is stable across runs.
 */
import { createHash } from "node:crypto"

import { itemSubtotal } from "@/lib/domain/payout"

import type {
  advances,
  attendances,
  buyers,
  cooperatives,
  expenses,
  materialTypes,
  members,
  payoutItems,
  payoutSettings,
  payouts,
  purchaseItems,
  purchases,
  saleItems,
  sales,
  suppliers,
  users,
} from "./schema"

/** Stable UUID derived from a readable key (seed-only; the app uses gen_random_uuid()). */
export function stableId(key: string) {
  const hex = createHash("sha1").update(`erp-cooperativas:${key}`).digest("hex").slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export const COOPERATIVE_NAME = "Cooperativa Recicla Vida"
export const DEMO_PASSWORD = "demo123"

export const DEMO_USERS = [
  { key: "u-marta", name: "Marta Ribeiro", email: "marta@reciclavida.coop", roles: ["manager", "operator"] as const, memberKey: null },
  { key: "u-jorge", name: "Jorge Nascimento", email: "jorge@reciclavida.coop", roles: ["operator"] as const, memberKey: null },
  { key: "u-ana", name: "Ana Maria Silva", email: "ana@reciclavida.coop", roles: ["member"] as const, memberKey: "m1" },
] as const

export const ids = {
  cooperative: stableId("coop-recicla-vida"),
  user: (key: string) => stableId(`user:${key}`),
  member: (key: string) => stableId(`member:${key}`),
  buyer: (key: string) => stableId(`buyer:${key}`),
  supplier: (key: string) => stableId(`supplier:${key}`),
  material: (key: string) => stableId(`material:${key}`),
  sale: (key: string) => stableId(`sale:${key}`),
  purchase: (key: string) => stableId(`purchase:${key}`),
  expense: (key: string) => stableId(`expense:${key}`),
  advance: (key: string) => stableId(`advance:${key}`),
  settings: (key: string) => stableId(`settings:${key}`),
  payout: (key: string) => stableId(`payout:${key}`),
}

type Condition = "loose" | "baled"

function weekdayOf(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

function workDaysOf(period: string) {
  const [year, month] = period.split("-").map(Number)
  const total = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate()
  const days: string[] = []
  for (let day = 1; day <= total; day++) {
    const iso = `${period}-${String(day).padStart(2, "0")}`
    if (weekdayOf(iso) !== 0) days.push(iso)
  }
  return days
}

function attendanceFor(period: string, memberIndex: number, memberKey: string, workedDays: number) {
  const days = workDaysOf(period)
  const absences = Math.max(0, days.length - workedDays)
  const absent = new Set<number>()
  let k = 0
  while (absent.size < absences && k < days.length * 2) {
    absent.add((memberIndex * 7 + k * 9) % days.length)
    k++
  }
  return days.map((date, index) => ({ memberKey, date, present: !absent.has(index) }))
}

export type SeedData = {
  cooperative: typeof cooperatives.$inferInsert
  users: (typeof users.$inferInsert & { passwordHash: string })[]
  members: (typeof members.$inferInsert)[]
  buyers: (typeof buyers.$inferInsert)[]
  suppliers: (typeof suppliers.$inferInsert)[]
  materialTypes: (typeof materialTypes.$inferInsert)[]
  sales: (typeof sales.$inferInsert)[]
  saleItems: (typeof saleItems.$inferInsert)[]
  purchases: (typeof purchases.$inferInsert)[]
  purchaseItems: (typeof purchaseItems.$inferInsert)[]
  expenses: (typeof expenses.$inferInsert)[]
  advances: (typeof advances.$inferInsert)[]
  attendances: (typeof attendances.$inferInsert)[]
  payoutSettings: (typeof payoutSettings.$inferInsert)[]
  payouts: (typeof payouts.$inferInsert)[]
  payoutItems: (typeof payoutItems.$inferInsert)[]
}

export function buildSeed(passwordHash: string): SeedData {
  const coop = ids.cooperative
  const marta = ids.user("u-marta")
  const jorge = ids.user("u-jorge")

  const memberRows = [
    { key: "m1", name: "Ana Maria Silva", cpf: "52601815906", pixKey: "52601815906", phone: "11987654321", admittedOn: "2023-03-06", leftOn: null, inssWithheld: true, notes: null },
    { key: "m2", name: "Carlos Eduardo Santos", cpf: "08301661305", pixKey: "carlos.santos@gmail.com", phone: "11976543210", admittedOn: "2023-03-06", leftOn: null, inssWithheld: true, notes: null },
    { key: "m3", name: "João Pedro Oliveira", cpf: "18609139034", pixKey: "+5511965432109", phone: "11965432109", admittedOn: "2023-08-14", leftOn: null, inssWithheld: true, notes: "Opera a prensa." },
    { key: "m4", name: "Maria Aparecida Costa", cpf: "99603082430", pixKey: "99603082430", phone: "11954321098", admittedOn: "2024-01-08", leftOn: null, inssWithheld: true, notes: null },
    { key: "m5", name: "Roberto Souza", cpf: "62819482112", pixKey: "roberto.souza@outlook.com", phone: "11943210987", admittedOn: "2024-05-20", leftOn: null, inssWithheld: true, notes: null },
    { key: "m6", name: "Fernanda Lima", cpf: "99351819019", pixKey: "99351819019", phone: "11932109876", admittedOn: "2025-02-03", leftOn: null, inssWithheld: false, notes: "Aposentada: recolhe INSS por fora." },
    { key: "m7", name: "Gabriel Martins", cpf: "93786579741", pixKey: "+5511921098765", phone: "11921098765", admittedOn: "2026-08-03", leftOn: null, inssWithheld: true, notes: "Entrou em agosto/2026." },
    { key: "m8", name: "Paulo Henrique Rocha", cpf: "54323194897", pixKey: "54323194897", phone: "11910987654", admittedOn: "2022-11-07", leftOn: "2026-07-31", inssWithheld: true, notes: "Desligado a pedido." },
    { key: "m9", name: "Juliana Ferreira", cpf: "75749118606", pixKey: "juliana.ferreira@gmail.com", phone: "11909876543", admittedOn: "2026-09-01", leftOn: null, inssWithheld: true, notes: null },
  ]
  const cpfOf = new Map(memberRows.map((m) => [m.key, m.cpf]))

  const materialRows: { key: string; name: string; category: "plastic" | "paper" | "metal" | "glass" | "waste" | "other"; defaultCondition: Condition; active: boolean }[] = [
    { key: "mt-pet-cristal", name: "PET Cristal", category: "plastic", defaultCondition: "baled", active: true },
    { key: "mt-pet-colorido", name: "PET Colorido", category: "plastic", defaultCondition: "baled", active: true },
    { key: "mt-pead", name: "PEAD (plástico duro)", category: "plastic", defaultCondition: "baled", active: true },
    { key: "mt-pp", name: "PP", category: "plastic", defaultCondition: "baled", active: true },
    { key: "mt-papelao", name: "Papelão Ondulado", category: "paper", defaultCondition: "baled", active: true },
    { key: "mt-papel-branco", name: "Papel Branco", category: "paper", defaultCondition: "baled", active: true },
    { key: "mt-papel-misto", name: "Papel Misto", category: "paper", defaultCondition: "baled", active: true },
    { key: "mt-aluminio", name: "Alumínio (lata)", category: "metal", defaultCondition: "baled", active: true },
    { key: "mt-ferro", name: "Ferro / Sucata", category: "metal", defaultCondition: "loose", active: true },
    { key: "mt-cobre", name: "Cobre", category: "metal", defaultCondition: "loose", active: true },
    { key: "mt-vidro", name: "Vidro", category: "glass", defaultCondition: "loose", active: true },
    { key: "mt-rejeito", name: "Rejeito", category: "waste", defaultCondition: "loose", active: false },
  ]
  const defaultCondition = new Map(materialRows.map((m) => [m.key, m.defaultCondition]))

  type ItemSeed = { material: string; condition?: Condition; weightKg: number; pricePerKg: number }
  const saleSeeds: { key: string; buyer: string; soldOn: string; invoiceNumber?: string; items: ItemSeed[] }[] = [
    { key: "s-jul-1", buyer: "b1", soldOn: "2026-07-07", invoiceNumber: "000412", items: [{ material: "mt-pet-cristal", weightKg: 4000, pricePerKg: 3.1 }, { material: "mt-papelao", weightKg: 14000, pricePerKg: 0.6 }] },
    { key: "s-jul-2", buyer: "b2", soldOn: "2026-07-17", items: [{ material: "mt-aluminio", weightKg: 2200, pricePerKg: 6.3 }, { material: "mt-pead", weightKg: 1800, pricePerKg: 2.1 }] },
    { key: "s-jul-3", buyer: "b3", soldOn: "2026-07-29", items: [{ material: "mt-papel-branco", weightKg: 2000, pricePerKg: 1.38 }] },
    { key: "s-ago-1", buyer: "b1", soldOn: "2026-08-08", invoiceNumber: "000431", items: [{ material: "mt-pet-cristal", weightKg: 3200, pricePerKg: 3.2 }, { material: "mt-papelao", weightKg: 12600, pricePerKg: 0.65 }] },
    { key: "s-ago-2", buyer: "b2", soldOn: "2026-08-19", items: [{ material: "mt-aluminio", weightKg: 2500, pricePerKg: 6.4 }, { material: "mt-pead", weightKg: 2000, pricePerKg: 2.0 }] },
    { key: "s-ago-3", buyer: "b1", soldOn: "2026-08-28", invoiceNumber: "000447", items: [{ material: "mt-pet-colorido", weightKg: 4028, pricePerKg: 2.5 }] },
    { key: "s-set-1", buyer: "b3", soldOn: "2026-09-04", items: [{ material: "mt-papelao", weightKg: 5000, pricePerKg: 0.7 }, { material: "mt-papel-misto", weightKg: 1500, pricePerKg: 0.45 }] },
  ]

  const saleRows: SeedData["sales"] = []
  const saleItemRows: SeedData["saleItems"] = []
  for (const seed of saleSeeds) {
    const items = seed.items.map((item, index) => ({
      id: stableId(`sale-item:${seed.key}:${index}`),
      saleId: ids.sale(seed.key),
      materialTypeId: ids.material(item.material),
      condition: item.condition ?? defaultCondition.get(item.material) ?? "baled",
      weightKg: item.weightKg,
      pricePerKg: item.pricePerKg,
      subtotal: itemSubtotal(item.weightKg, item.pricePerKg),
      position: index,
    }))
    saleItemRows.push(...items)
    saleRows.push({
      id: ids.sale(seed.key),
      cooperativeId: coop,
      buyerId: ids.buyer(seed.buyer),
      soldOn: seed.soldOn,
      totalAmount: Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
      totalWeightKg: items.reduce((s, i) => s + i.weightKg, 0),
      invoiceNumber: seed.invoiceNumber ?? null,
      createdBy: jorge,
      createdAt: `${seed.soldOn}T13:30:00.000Z`,
    })
  }

  const purchaseSeeds: { key: string; supplier: string; purchasedOn: string; paymentMethod: "cash" | "pix"; paidOn: string | null; items: ItemSeed[] }[] = [
    { key: "pu-set-1", supplier: "sup-ze", purchasedOn: "2026-09-02", paymentMethod: "cash", paidOn: "2026-09-02", items: [{ material: "mt-papelao", weightKg: 800, pricePerKg: 0.3 }, { material: "mt-pet-cristal", weightKg: 120, pricePerKg: 1.5 }] },
    { key: "pu-set-2", supplier: "sup-coop-vizinha", purchasedOn: "2026-09-08", paymentMethod: "pix", paidOn: null, items: [{ material: "mt-pet-cristal", weightKg: 500, pricePerKg: 1.8 }] },
  ]
  const purchaseRows: SeedData["purchases"] = []
  const purchaseItemRows: SeedData["purchaseItems"] = []
  for (const seed of purchaseSeeds) {
    const items = seed.items.map((item, index) => ({
      id: stableId(`purchase-item:${seed.key}:${index}`),
      purchaseId: ids.purchase(seed.key),
      materialTypeId: ids.material(item.material),
      condition: item.condition ?? ("loose" as Condition),
      weightKg: item.weightKg,
      pricePerKg: item.pricePerKg,
      subtotal: itemSubtotal(item.weightKg, item.pricePerKg),
      position: index,
    }))
    purchaseItemRows.push(...items)
    purchaseRows.push({
      id: ids.purchase(seed.key),
      cooperativeId: coop,
      supplierId: ids.supplier(seed.supplier),
      purchasedOn: seed.purchasedOn,
      totalAmount: Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
      totalWeightKg: items.reduce((s, i) => s + i.weightKg, 0),
      paymentMethod: seed.paymentMethod,
      paidOn: seed.paidOn,
      createdBy: jorge,
      createdAt: `${seed.purchasedOn}T11:45:00.000Z`,
    })
  }

  const expenseSeeds: [string, string, string, number, string][] = [
    ["e-jul-1", "Aluguel do galpão", "aluguel", 6000, "2026-07-05"],
    ["e-jul-2", "Energia elétrica", "energia", 1180, "2026-07-18"],
    ["e-jul-3", "Combustível do caminhão", "combustivel", 390, "2026-07-15"],
    ["e-jul-4", "Troca de correia da prensa", "manutencao", 650, "2026-07-10"],
    ["e-jul-5", "Aterro (rejeito)", "aterro", 3680, "2026-07-30"],
    ["e-ago-1", "Aluguel do galpão", "aluguel", 6000, "2026-08-05"],
    ["e-ago-2", "Manutenção da prensa hidráulica", "manutencao", 850, "2026-08-10"],
    ["e-ago-3", "Combustível do caminhão", "combustivel", 420, "2026-08-15"],
    ["e-ago-4", "Energia elétrica", "energia", 1250, "2026-08-18"],
    ["e-ago-5", "Aterro (rejeito)", "aterro", 3780, "2026-08-30"],
    ["e-set-1", "Energia elétrica", "energia", 1180, "2026-09-03"],
    ["e-set-2", "Aluguel do galpão", "aluguel", 6000, "2026-09-05"],
  ]

  const julyPayoutId = ids.payout("p-2026-07")
  type AdvanceSeed = [key: string, member: string, kind: "cash_advance" | "purchase" | "other", description: string, amount: number, grantedOn: string, status?: "pending" | "deducted" | "cancelled", deductedIn?: string | null]
  const advanceSeeds: AdvanceSeed[] = [
    ["a-jul-1", "m3", "cash_advance", "Adiantamento", 150, "2026-07-08", "deducted", julyPayoutId],
    ["a-jul-2", "m5", "purchase", "Botas de segurança", 100, "2026-07-14", "deducted", julyPayoutId],
    ["a-ago-1", "m1", "purchase", "Vale mercado", 200, "2026-08-05"],
    ["a-ago-2", "m2", "cash_advance", "Adiantamento", 150, "2026-08-12"],
    ["a-ago-3", "m3", "cash_advance", "Adiantamento emergencial", 300, "2026-08-12"],
    ["a-ago-4", "m4", "purchase", "Farmácia", 100, "2026-08-20"],
    ["a-ago-5", "m5", "cash_advance", "Adiantamento", 250, "2026-08-01"],
    ["a-ago-6", "m7", "purchase", "Luvas e óculos (EPI)", 120, "2026-08-15"],
    ["a-ago-7", "m6", "other", "Lançado por engano", 80, "2026-08-21", "cancelled"],
    ["a-set-1", "m5", "cash_advance", "Adiantamento", 200, "2026-09-02"],
  ]

  const attendanceSeeds = [
    ...attendanceFor("2026-07", 0, "m1", 20),
    ...attendanceFor("2026-07", 1, "m2", 21),
    ...attendanceFor("2026-07", 2, "m3", 19),
    ...attendanceFor("2026-07", 3, "m4", 22),
    ...attendanceFor("2026-07", 4, "m5", 18),
    ...attendanceFor("2026-07", 5, "m6", 20),
    ...attendanceFor("2026-07", 7, "m8", 18),
    ...attendanceFor("2026-08", 0, "m1", 22),
    ...attendanceFor("2026-08", 1, "m2", 20),
    ...attendanceFor("2026-08", 2, "m3", 18),
    ...attendanceFor("2026-08", 3, "m4", 22),
    ...attendanceFor("2026-08", 4, "m5", 21),
    ...attendanceFor("2026-08", 5, "m6", 22),
    ...attendanceFor("2026-08", 6, "m7", 19),
    ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-07"].flatMap((date) =>
      ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m9"].map((memberKey) => ({
        memberKey,
        date,
        present: !((memberKey === "m3" && date === "2026-09-02") || (memberKey === "m5" && date === "2026-09-04")),
      })),
    ),
  ]

  const julyItems = [
    { member: "m1", days: 20, deductions: 0 },
    { member: "m2", days: 21, deductions: 0 },
    { member: "m3", days: 19, deductions: 150 },
    { member: "m4", days: 22, deductions: 0 },
    { member: "m5", days: 18, deductions: 100 },
    { member: "m6", days: 20, deductions: 0 },
    { member: "m8", days: 18, deductions: 0 },
  ]
  const JULY_DAY_VALUE = 180.47
  const nameOf = new Map(memberRows.map((m) => [m.key, m.name]))

  return {
    cooperative: { id: coop, legalName: "Cooperativa de Trabalho Recicla Vida", tradeName: COOPERATIVE_NAME, cnpj: "11222333000181", timezone: "America/Sao_Paulo" },
    users: DEMO_USERS.map((u) => ({
      id: ids.user(u.key),
      cooperativeId: coop,
      email: u.email,
      name: u.name,
      roles: [...u.roles],
      memberId: u.memberKey ? ids.member(u.memberKey) : null,
      passwordHash,
      active: true,
    })),
    members: memberRows.map(({ key, ...m }) => ({ id: ids.member(key), cooperativeId: coop, ...m })),
    buyers: [
      { id: ids.buyer("b1"), cooperativeId: coop, name: "Reciclagem Indústria X", cnpj: "12345678000190", contact: "Sr. Antônio · (11) 4002-8922", active: true },
      { id: ids.buyer("b2"), cooperativeId: coop, name: "Metalúrgica Sul", cnpj: "98765432000110", contact: "Dona Cléia · (11) 3333-1010", active: true },
      { id: ids.buyer("b3"), cooperativeId: coop, name: "Papéis do Vale", cnpj: "45678912000155", contact: "Marcos · (12) 3922-5544", active: true },
    ],
    suppliers: [
      { id: ids.supplier("sup-ze"), cooperativeId: coop, kind: "individual", name: "José Carlos (Seu Zé, catador)", cpf: "39053344705", cnpj: null, pixKey: "+5511988887777", phone: "11988887777", active: true, createdBy: jorge },
      { id: ids.supplier("sup-dona-lu"), cooperativeId: coop, kind: "individual", name: "Luzia Andrade (catadora)", cpf: null, cnpj: null, pixKey: null, phone: "11977776666", active: true, createdBy: jorge },
      { id: ids.supplier("sup-coop-vizinha"), cooperativeId: coop, kind: "company", name: "Cooperativa Vizinha Recicla", cpf: null, cnpj: "23456789000101", pixKey: "financeiro@coopvizinha.org", phone: "1133334444", active: true, createdBy: marta },
    ],
    materialTypes: materialRows.map(({ key, ...m }, index) => ({ id: ids.material(key), cooperativeId: coop, ...m, sortOrder: index })),
    sales: saleRows,
    saleItems: saleItemRows,
    purchases: purchaseRows,
    purchaseItems: purchaseItemRows,
    expenses: expenseSeeds.map(([key, description, category, amount, incurredOn]) => ({
      id: ids.expense(key),
      cooperativeId: coop,
      description,
      category,
      amount,
      incurredOn,
      createdBy: jorge,
      createdAt: `${incurredOn}T12:00:00.000Z`,
    })),
    advances: advanceSeeds.map(([key, member, kind, description, amount, grantedOn, status = "pending", deductedIn = null]) => ({
      id: ids.advance(key),
      cooperativeId: coop,
      memberId: ids.member(member),
      kind,
      description,
      amount,
      grantedOn,
      status,
      deductedInPayoutId: deductedIn,
      cancelReason: status === "cancelled" ? "Lançado em duplicidade" : null,
      createdBy: jorge,
      createdAt: `${grantedOn}T14:00:00.000Z`,
    })),
    attendances: attendanceSeeds.map((a) => ({
      id: stableId(`attendance:${a.memberKey}:${a.date}`),
      cooperativeId: coop,
      memberId: ids.member(a.memberKey),
      date: a.date,
      present: a.present,
      recordedBy: jorge,
    })),
    payoutSettings: [
      { id: ids.settings("ps-1"), cooperativeId: coop, effectiveFrom: "2026-01-01", legalReserveRate: 0.1, fatesRate: 0.05, otherFundsRate: 0, inssRate: 0, negativeBalancePolicy: "carry_over", includeMembersLeftInPeriod: true, createdBy: marta, createdByName: "Marta Ribeiro", createdAt: "2026-01-05T12:12:00.000Z" },
      // INSS withheld from August/2026 on (client request, DEC-006).
      { id: ids.settings("ps-2"), cooperativeId: coop, effectiveFrom: "2026-08-01", legalReserveRate: 0.1, fatesRate: 0.05, otherFundsRate: 0, inssRate: 0.075, negativeBalancePolicy: "carry_over", includeMembersLeftInPeriod: true, createdBy: marta, createdByName: "Marta Ribeiro", createdAt: "2026-08-01T12:00:00.000Z" },
    ],
    payouts: [
      {
        id: julyPayoutId,
        cooperativeId: coop,
        period: "2026-07-01",
        status: "closed",
        grossRevenue: 41200,
        totalPurchases: 0,
        totalExpenses: 11900,
        surplus: 29300,
        legalReserveAmount: 2930,
        fatesAmount: 1465,
        otherFundsAmount: 0,
        distributableSurplus: 24905,
        totalWorkedDays: 138,
        dayValue: JULY_DAY_VALUE,
        distributedTotal: 24904.86,
        roundingResidual: 0.14,
        inssTotal: 0,
        totalDeductions: 250,
        totalNet: 24654.86,
        settingsSnapshot: {
          id: ids.settings("ps-1"),
          effectiveFrom: "2026-01",
          legalReserveRate: 0.1,
          fatesRate: 0.05,
          otherFundsRate: 0,
          inssRate: 0,
          negativeBalancePolicy: "carry_over",
          includeMembersLeftInPeriod: true,
          isLegalDefault: true,
        },
        closedBy: marta,
        closedByName: "Marta Ribeiro",
        closedAt: "2026-08-03T19:40:00.000Z",
      },
    ],
    payoutItems: julyItems.map((item, index) => {
      const gross = Math.round(item.days * JULY_DAY_VALUE * 100) / 100
      return {
        id: stableId(`payout-item:p-2026-07:${item.member}`),
        payoutId: julyPayoutId,
        memberId: ids.member(item.member),
        memberNameSnapshot: nameOf.get(item.member) ?? item.member,
        memberCpfSnapshot: cpfOf.get(item.member) ?? "",
        workedDays: item.days,
        grossAmount: gross,
        inssBase: gross,
        inssRate: 0,
        inssAmount: 0,
        deductionsAmount: item.deductions,
        netAmount: Math.round((gross - item.deductions) * 100) / 100,
        carryOverDebt: 0,
        paidAt: index === 6 ? null : "2026-08-04T13:15:00.000Z",
      }
    }),
  }
}
