// Deterministic seed data. Numbers for August/2026 mirror estudo/spec/80-testes/fixtures.json.

import { itemSubtotal } from "@/lib/domain/payout"
import { weekdayOf } from "@/lib/dates"

import type {
  Advance,
  Attendance,
  Buyer,
  DemoData,
  DemoUser,
  Expense,
  MaterialType,
  Member,
  Payout,
  PayoutSettingsVersion,
  Sale,
} from "./types"

export const COOPERATIVE_NAME = "Cooperativa Recicla Vida"

export const DEMO_PASSWORD = "demo123"

export const DEMO_USERS: DemoUser[] = [
  {
    id: "u-marta",
    name: "Marta Ribeiro",
    email: "marta@reciclavida.coop",
    password: DEMO_PASSWORD,
    roles: ["manager", "operator"],
  },
  {
    id: "u-jorge",
    name: "Jorge Nascimento",
    email: "jorge@reciclavida.coop",
    password: DEMO_PASSWORD,
    roles: ["operator"],
  },
  {
    id: "u-ana",
    name: "Ana Maria Silva",
    email: "ana@reciclavida.coop",
    password: DEMO_PASSWORD,
    roles: ["member"],
    memberId: "m1",
  },
]

const members: Member[] = [
  { id: "m1", name: "Ana Maria Silva", cpf: "52601815906", pixKey: "52601815906", phone: "11987654321", admittedOn: "2023-03-06", leftOn: null, notes: "", hasAccess: true },
  { id: "m2", name: "Carlos Eduardo Santos", cpf: "08301661305", pixKey: "carlos.santos@gmail.com", phone: "11976543210", admittedOn: "2023-03-06", leftOn: null, notes: "", hasAccess: false },
  { id: "m3", name: "João Pedro Oliveira", cpf: "18609139034", pixKey: "+5511965432109", phone: "11965432109", admittedOn: "2023-08-14", leftOn: null, notes: "Opera a prensa.", hasAccess: false },
  { id: "m4", name: "Maria Aparecida Costa", cpf: "99603082430", pixKey: "99603082430", phone: "11954321098", admittedOn: "2024-01-08", leftOn: null, notes: "", hasAccess: false },
  { id: "m5", name: "Roberto Souza", cpf: "62819482112", pixKey: "roberto.souza@outlook.com", phone: "11943210987", admittedOn: "2024-05-20", leftOn: null, notes: "", hasAccess: false },
  { id: "m6", name: "Fernanda Lima", cpf: "99351819019", pixKey: "99351819019", phone: "11932109876", admittedOn: "2025-02-03", leftOn: null, notes: "", hasAccess: false },
  { id: "m7", name: "Gabriel Martins", cpf: "93786579741", pixKey: "+5511921098765", phone: "11921098765", admittedOn: "2026-08-03", leftOn: null, notes: "Entrou em agosto/2026.", hasAccess: false },
  { id: "m8", name: "Paulo Henrique Rocha", cpf: "54323194897", pixKey: "54323194897", phone: "11910987654", admittedOn: "2022-11-07", leftOn: "2026-07-31", notes: "Desligado a pedido.", hasAccess: false },
  { id: "m9", name: "Juliana Ferreira", cpf: "75749118606", pixKey: "juliana.ferreira@gmail.com", phone: "11909876543", admittedOn: "2026-09-01", leftOn: null, notes: "", hasAccess: false },
]

const buyers: Buyer[] = [
  { id: "b1", name: "Reciclagem Indústria X", cnpj: "12345678000190", contact: "Sr. Antônio · (11) 4002-8922", active: true },
  { id: "b2", name: "Metalúrgica Sul", cnpj: "98765432000110", contact: "Dona Cléia · (11) 3333-1010", active: true },
  { id: "b3", name: "Papéis do Vale", cnpj: "45678912000155", contact: "Marcos · (12) 3922-5544", active: true },
]

const materialTypes: MaterialType[] = [
  { id: "mt-pet-cristal", name: "PET Cristal", category: "plastic", active: true },
  { id: "mt-pet-colorido", name: "PET Colorido", category: "plastic", active: true },
  { id: "mt-pead", name: "PEAD (plástico duro)", category: "plastic", active: true },
  { id: "mt-pp", name: "PP", category: "plastic", active: true },
  { id: "mt-papelao", name: "Papelão Ondulado", category: "paper", active: true },
  { id: "mt-papel-branco", name: "Papel Branco", category: "paper", active: true },
  { id: "mt-papel-misto", name: "Papel Misto", category: "paper", active: true },
  { id: "mt-aluminio", name: "Alumínio (lata)", category: "metal", active: true },
  { id: "mt-ferro", name: "Ferro / Sucata", category: "metal", active: true },
  { id: "mt-cobre", name: "Cobre", category: "metal", active: true },
  { id: "mt-vidro", name: "Vidro", category: "glass", active: true },
  { id: "mt-rejeito", name: "Rejeito", category: "waste", active: false },
]

type SeedSale = {
  id: string
  buyerId: string
  soldOn: string
  invoiceNumber?: string
  items: { materialTypeId: string; weightKg: number; pricePerKg: number }[]
}

function buildSale(seed: SeedSale): Sale {
  const items = seed.items.map((item, index) => ({
    id: `${seed.id}-i${index + 1}`,
    materialTypeId: item.materialTypeId,
    weightKg: item.weightKg,
    pricePerKg: item.pricePerKg,
    subtotal: itemSubtotal(item.weightKg, item.pricePerKg),
  }))
  return {
    id: seed.id,
    buyerId: seed.buyerId,
    soldOn: seed.soldOn,
    items,
    totalAmount: Math.round(items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100,
    totalWeightKg: items.reduce((sum, i) => sum + i.weightKg, 0),
    invoiceNumber: seed.invoiceNumber ?? "",
    note: "",
    deletedAt: null,
    createdBy: "u-jorge",
    createdAt: `${seed.soldOn}T10:30:00`,
  }
}

const sales: Sale[] = [
  // Julho/2026 (fechado)
  buildSale({ id: "s-jul-1", buyerId: "b1", soldOn: "2026-07-07", invoiceNumber: "000412", items: [
    { materialTypeId: "mt-pet-cristal", weightKg: 4000, pricePerKg: 3.1 },
    { materialTypeId: "mt-papelao", weightKg: 14000, pricePerKg: 0.6 },
  ] }),
  buildSale({ id: "s-jul-2", buyerId: "b2", soldOn: "2026-07-17", items: [
    { materialTypeId: "mt-aluminio", weightKg: 2200, pricePerKg: 6.3 },
    { materialTypeId: "mt-pead", weightKg: 1800, pricePerKg: 2.1 },
  ] }),
  buildSale({ id: "s-jul-3", buyerId: "b3", soldOn: "2026-07-29", items: [
    { materialTypeId: "mt-papel-branco", weightKg: 2000, pricePerKg: 1.38 },
  ] }),
  // Agosto/2026 (aberto) — fixture FX-ago-2026-com-fundos
  buildSale({ id: "s-ago-1", buyerId: "b1", soldOn: "2026-08-08", invoiceNumber: "000431", items: [
    { materialTypeId: "mt-pet-cristal", weightKg: 3200, pricePerKg: 3.2 },
    { materialTypeId: "mt-papelao", weightKg: 12600, pricePerKg: 0.65 },
  ] }),
  buildSale({ id: "s-ago-2", buyerId: "b2", soldOn: "2026-08-19", items: [
    { materialTypeId: "mt-aluminio", weightKg: 2500, pricePerKg: 6.4 },
    { materialTypeId: "mt-pead", weightKg: 2000, pricePerKg: 2.0 },
  ] }),
  buildSale({ id: "s-ago-3", buyerId: "b1", soldOn: "2026-08-28", invoiceNumber: "000447", items: [
    { materialTypeId: "mt-pet-colorido", weightKg: 4028, pricePerKg: 2.5 },
  ] }),
  // Setembro/2026 (mês corrente, parcial)
  buildSale({ id: "s-set-1", buyerId: "b3", soldOn: "2026-09-04", items: [
    { materialTypeId: "mt-papelao", weightKg: 5000, pricePerKg: 0.7 },
    { materialTypeId: "mt-papel-misto", weightKg: 1500, pricePerKg: 0.45 },
  ] }),
]

function expense(id: string, description: string, category: Expense["category"], amount: number, incurredOn: string): Expense {
  return { id, description, category, amount, incurredOn, deletedAt: null, createdBy: "u-jorge", createdAt: `${incurredOn}T09:00:00` }
}

const expenses: Expense[] = [
  expense("e-jul-1", "Aluguel do galpão", "aluguel", 6000, "2026-07-05"),
  expense("e-jul-2", "Energia elétrica", "energia", 1180, "2026-07-18"),
  expense("e-jul-3", "Combustível do caminhão", "combustivel", 390, "2026-07-15"),
  expense("e-jul-4", "Troca de correia da prensa", "manutencao", 650, "2026-07-10"),
  expense("e-jul-5", "Aterro (rejeito)", "aterro", 3680, "2026-07-30"),
  expense("e-ago-1", "Aluguel do galpão", "aluguel", 6000, "2026-08-05"),
  expense("e-ago-2", "Manutenção da prensa hidráulica", "manutencao", 850, "2026-08-10"),
  expense("e-ago-3", "Combustível do caminhão", "combustivel", 420, "2026-08-15"),
  expense("e-ago-4", "Energia elétrica", "energia", 1250, "2026-08-18"),
  expense("e-ago-5", "Aterro (rejeito)", "aterro", 3780, "2026-08-30"),
  expense("e-set-1", "Energia elétrica", "energia", 1180, "2026-09-03"),
  expense("e-set-2", "Aluguel do galpão", "aluguel", 6000, "2026-09-05"),
]

function advance(
  id: string,
  memberId: string,
  kind: Advance["kind"],
  description: string,
  amount: number,
  grantedOn: string,
  status: Advance["status"] = "pending",
  deductedInPayoutId: string | null = null,
): Advance {
  return {
    id,
    memberId,
    kind,
    description,
    amount,
    grantedOn,
    status,
    deductedInPayoutId,
    originAdvanceId: null,
    generatedByPayoutId: null,
    cancelReason: null,
    createdBy: "u-jorge",
    createdAt: `${grantedOn}T11:00:00`,
  }
}

const advances: Advance[] = [
  advance("a-jul-1", "m3", "cash_advance", "Adiantamento", 150, "2026-07-08", "deducted", "p-2026-07"),
  advance("a-jul-2", "m5", "purchase", "Botas de segurança", 100, "2026-07-14", "deducted", "p-2026-07"),
  advance("a-ago-1", "m1", "purchase", "Vale mercado", 200, "2026-08-05"),
  advance("a-ago-2", "m2", "cash_advance", "Adiantamento", 150, "2026-08-12"),
  advance("a-ago-3", "m3", "cash_advance", "Adiantamento emergencial", 300, "2026-08-12"),
  advance("a-ago-4", "m4", "purchase", "Farmácia", 100, "2026-08-20"),
  advance("a-ago-5", "m5", "cash_advance", "Adiantamento", 250, "2026-08-01"),
  advance("a-ago-6", "m7", "purchase", "Luvas e óculos (EPI)", 120, "2026-08-15"),
  advance("a-ago-7", "m6", "other", "Lançado por engano", 80, "2026-08-21", "cancelled"),
  advance("a-set-1", "m5", "cash_advance", "Adiantamento", 200, "2026-09-02"),
]

/** Mon–Sat dates of a month, as ISO strings. */
function workDaysOf(period: string) {
  const [year, month] = period.split("-").map(Number)
  const total = new Date(year ?? 1970, month ?? 1, 0).getDate()
  const days: string[] = []
  for (let day = 1; day <= total; day++) {
    const iso = `${period}-${String(day).padStart(2, "0")}`
    if (weekdayOf(iso) !== 0) days.push(iso)
  }
  return days
}

/** Marks `workedDays` presences for a member, spreading absences deterministically. */
function attendanceFor(period: string, memberIndex: number, memberId: string, workedDays: number): Attendance[] {
  const days = workDaysOf(period)
  const absences = Math.max(0, days.length - workedDays)
  const absent = new Set<number>()
  let k = 0
  while (absent.size < absences && k < days.length * 2) {
    absent.add((memberIndex * 7 + k * 9) % days.length)
    k++
  }
  return days.map((date, index) => ({
    id: `att-${memberId}-${date}`,
    memberId,
    date,
    present: !absent.has(index),
  }))
}

const attendances: Attendance[] = [
  // Julho/2026 — 138 diárias
  ...attendanceFor("2026-07", 0, "m1", 20),
  ...attendanceFor("2026-07", 1, "m2", 21),
  ...attendanceFor("2026-07", 2, "m3", 19),
  ...attendanceFor("2026-07", 3, "m4", 22),
  ...attendanceFor("2026-07", 4, "m5", 18),
  ...attendanceFor("2026-07", 5, "m6", 20),
  ...attendanceFor("2026-07", 7, "m8", 18),
  // Agosto/2026 — 144 diárias (fixture)
  ...attendanceFor("2026-08", 0, "m1", 22),
  ...attendanceFor("2026-08", 1, "m2", 20),
  ...attendanceFor("2026-08", 2, "m3", 18),
  ...attendanceFor("2026-08", 3, "m4", 22),
  ...attendanceFor("2026-08", 4, "m5", 21),
  ...attendanceFor("2026-08", 5, "m6", 22),
  ...attendanceFor("2026-08", 6, "m7", 19),
  // Setembro/2026 — parcial (hoje ainda sem chamada)
  ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-07"].flatMap((date) =>
    ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m9"].map((memberId) => ({
      id: `att-${memberId}-${date}`,
      memberId,
      date,
      present: !((memberId === "m3" && date === "2026-09-02") || (memberId === "m5" && date === "2026-09-04")),
    })),
  ),
]

const settingsHistory: PayoutSettingsVersion[] = [
  {
    id: "ps-1",
    effectiveFrom: "2026-01",
    legalReserveRate: 0.1,
    fatesRate: 0.05,
    otherFundsRate: 0,
    negativeBalancePolicy: "carry_over",
    includeMembersLeftInPeriod: true,
    createdBy: "u-marta",
    createdAt: "2026-01-05T09:12:00",
    isLegalDefault: true,
  },
]

const julyItems = [
  { memberId: "m1", name: "Ana Maria Silva", days: 20, deductions: 0 },
  { memberId: "m2", name: "Carlos Eduardo Santos", days: 21, deductions: 0 },
  { memberId: "m3", name: "João Pedro Oliveira", days: 19, deductions: 150 },
  { memberId: "m4", name: "Maria Aparecida Costa", days: 22, deductions: 0 },
  { memberId: "m5", name: "Roberto Souza", days: 18, deductions: 100 },
  { memberId: "m6", name: "Fernanda Lima", days: 20, deductions: 0 },
  { memberId: "m8", name: "Paulo Henrique Rocha", days: 18, deductions: 0 },
]

const JULY_DAY_VALUE = 180.47

const payouts: Payout[] = [
  {
    id: "p-2026-07",
    period: "2026-07",
    status: "closed",
    grossRevenue: 41200,
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
    totalDeductions: 250,
    totalNet: 24654.86,
    settingsSnapshot: settingsHistory[0]!,
    closedBy: "Marta Ribeiro",
    closedAt: "2026-08-03T16:40:00",
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
    items: julyItems.map((item, index) => {
      const gross = Math.round(item.days * JULY_DAY_VALUE * 100) / 100
      return {
        id: `pi-2026-07-${index + 1}`,
        payoutId: "p-2026-07",
        memberId: item.memberId,
        memberNameSnapshot: item.name,
        workedDays: item.days,
        grossAmount: gross,
        deductionsAmount: item.deductions,
        netAmount: Math.round((gross - item.deductions) * 100) / 100,
        carryOverDebt: 0,
        paidAt: index === 6 ? null : "2026-08-04T10:15:00",
      }
    }),
  },
]

export function createSeed(): DemoData {
  // Structured clone keeps the seed immutable across resets.
  return structuredClone({
    members,
    buyers,
    materialTypes,
    sales,
    expenses,
    advances,
    attendances,
    payouts,
    settingsHistory,
  })
}
