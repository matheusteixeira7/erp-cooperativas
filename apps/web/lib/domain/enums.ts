// Enums and pt-BR labels shared by UI and server (10-tipos/enums.json). Names follow 00-contexto/glossario.json.

import type { NegativeBalancePolicy } from "@/lib/domain/payout"

export type Role = "manager" | "operator" | "member"
export type MaterialCategory = "plastic" | "paper" | "metal" | "glass" | "waste" | "other"
/** Estado do material na pesagem (TP-EstadoMaterial, RN-030). */
export type MaterialCondition = "loose" | "baled"
/** Fornecedor de material (EN-fornecedor): catador avulso ou empresa/cooperativa. */
export type SupplierKind = "individual" | "company"
export type PaymentMethod = "cash" | "pix"
export type AdvanceKind = "cash_advance" | "purchase" | "carry_over" | "other"
export type AdvanceStatus = "pending" | "deducted" | "cancelled"
export type PayoutStatus = "closed" | "reopened"
export type { NegativeBalancePolicy }

export type ExpenseCategory = "aluguel" | "energia" | "agua" | "combustivel" | "manutencao" | "aterro" | "alimentacao" | "epi" | "inss_patronal" | "outros"

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
  inss_patronal: "INSS patronal",
  outros: "Outros",
}

export function expenseCategoryLabel(category: string) {
  return (EXPENSE_CATEGORY_LABEL as Record<string, string>)[category] ?? category
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
