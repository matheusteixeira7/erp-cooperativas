// Demo (mocked) domain types. Names follow the glossary (00-contexto/glossario.json).

import type { NegativeBalancePolicy } from "@/lib/domain/payout"

export type Role = "manager" | "operator" | "member"

export type DemoUser = {
  id: string
  name: string
  email: string
  password: string
  roles: Role[]
  memberId?: string
}

export type Session = {
  userId: string
  name: string
  email: string
  roles: Role[]
  activeRole: Role
  memberId?: string
  cooperativeName: string
}

export type Member = {
  id: string
  name: string
  cpf: string
  pixKey: string
  phone: string
  admittedOn: string
  leftOn: string | null
  /** Contribui INSS pelo sistema (RN-028). false para aposentado, MEI ou quem recolhe por fora. */
  inssWithheld: boolean
  notes: string
  hasAccess: boolean
}

export type Buyer = {
  id: string
  name: string
  cnpj: string
  contact: string
  active: boolean
}

export type MaterialCategory = "plastic" | "paper" | "metal" | "glass" | "waste" | "other"

/** Fornecedor de material (EN-fornecedor): catador avulso ou empresa/cooperativa. */
export type SupplierKind = "individual" | "company"

export type Supplier = {
  id: string
  kind: SupplierKind
  name: string
  /** Só para kind = individual; opcional. 11 dígitos. */
  cpf: string
  /** Obrigatório para kind = company. 14 dígitos. */
  cnpj: string
  pixKey: string
  phone: string
  active: boolean
}

export type PaymentMethod = "cash" | "pix"

/** Estado do material na pesagem (TP-EstadoMaterial, RN-030). */
export type MaterialCondition = "loose" | "baled"

export type MaterialType = {
  id: string
  name: string
  category: MaterialCategory
  /** Pré-seleção do estado na UI. Mudar aqui não altera itens antigos (RN-030). */
  defaultCondition: MaterialCondition
  active: boolean
}

export type SaleItem = {
  id: string
  materialTypeId: string
  condition: MaterialCondition
  weightKg: number
  pricePerKg: number
  subtotal: number
}

export type Sale = {
  id: string
  buyerId: string
  soldOn: string
  items: SaleItem[]
  totalAmount: number
  totalWeightKg: number
  invoiceNumber: string
  note: string
  deletedAt: string | null
  createdBy: string
  createdAt: string
}

export type PurchaseItem = {
  id: string
  materialTypeId: string
  condition: MaterialCondition
  weightKg: number
  pricePerKg: number
  subtotal: number
}

/** Compra de material (EN-compra). Custo do mês; reduz a sobra em linha própria (RN-003). */
export type Purchase = {
  id: string
  supplierId: string
  purchasedOn: string
  items: PurchaseItem[]
  totalAmount: number
  totalWeightKg: number
  paymentMethod: PaymentMethod
  /** Nulo = a pagar. Informativo; a competência é purchasedOn. */
  paidOn: string | null
  note: string
  deletedAt: string | null
  createdBy: string
  createdAt: string
}

export type ExpenseCategory =
  | "aluguel"
  | "energia"
  | "agua"
  | "combustivel"
  | "manutencao"
  | "aterro"
  | "alimentacao"
  | "epi"
  | "outros"

export type Expense = {
  id: string
  description: string
  category: ExpenseCategory
  amount: number
  incurredOn: string
  deletedAt: string | null
  createdBy: string
  createdAt: string
}

export type AdvanceKind = "cash_advance" | "purchase" | "carry_over" | "other"
export type AdvanceStatus = "pending" | "deducted" | "cancelled"

export type Advance = {
  id: string
  memberId: string
  kind: AdvanceKind
  description: string
  amount: number
  grantedOn: string
  status: AdvanceStatus
  deductedInPayoutId: string | null
  originAdvanceId: string | null
  generatedByPayoutId: string | null
  cancelReason: string | null
  createdBy: string
  createdAt: string
}

export type Attendance = {
  id: string
  memberId: string
  date: string
  present: boolean
}

export type PayoutStatus = "closed" | "reopened"

export type PayoutItem = {
  id: string
  payoutId: string
  memberId: string
  memberNameSnapshot: string
  /** CPF na data do fechamento, para o relatório de INSS (só sai na exportação). */
  memberCpfSnapshot: string
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

export type Payout = {
  id: string
  period: string
  status: PayoutStatus
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
  settingsSnapshot: PayoutSettingsVersion
  closedBy: string
  closedAt: string
  reopenedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
  items: PayoutItem[]
}

export type PayoutSettingsVersion = {
  id: string
  effectiveFrom: string
  legalReserveRate: number
  fatesRate: number
  otherFundsRate: number
  inssRate: number
  negativeBalancePolicy: NegativeBalancePolicy
  includeMembersLeftInPeriod: boolean
  createdBy: string
  createdAt: string
  isLegalDefault: boolean
}

export type DemoData = {
  members: Member[]
  buyers: Buyer[]
  suppliers: Supplier[]
  materialTypes: MaterialType[]
  sales: Sale[]
  purchases: Purchase[]
  expenses: Expense[]
  advances: Advance[]
  attendances: Attendance[]
  payouts: Payout[]
  settingsHistory: PayoutSettingsVersion[]
}

export const ROLE_LABEL: Record<Role, string> = {
  manager: "Gestor",
  operator: "Operador",
  member: "Cooperado",
}

export const MATERIAL_CONDITION_LABEL: Record<MaterialCondition, string> = {
  loose: "Solto",
  baled: "Prensado",
}

export const SUPPLIER_KIND_LABEL: Record<SupplierKind, string> = {
  individual: "Pessoa física",
  company: "Empresa / cooperativa",
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
}

export const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  plastic: "Plástico",
  paper: "Papel",
  metal: "Metal",
  glass: "Vidro",
  waste: "Rejeito",
  other: "Outros",
}

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  aluguel: "Aluguel",
  energia: "Energia elétrica",
  agua: "Água",
  combustivel: "Combustível",
  manutencao: "Manutenção",
  aterro: "Aterro (rejeito)",
  alimentacao: "Alimentação",
  epi: "EPI",
  outros: "Outros",
}

export const ADVANCE_KIND_LABEL: Record<AdvanceKind, string> = {
  cash_advance: "Adiantamento em dinheiro",
  purchase: "Compra (EPI, mercado, farmácia)",
  carry_over: "Saldo de mês anterior",
  other: "Outro",
}

export const ADVANCE_STATUS_LABEL: Record<AdvanceStatus, string> = {
  pending: "Pendente",
  deducted: "Descontado",
  cancelled: "Cancelado",
}

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  closed: "Fechado",
  reopened: "Reaberto",
}
