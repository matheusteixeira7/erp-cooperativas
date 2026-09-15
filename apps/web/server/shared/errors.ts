/**
 * Error catalog (estudo/spec/50-api/erros.json).
 *
 * Use cases throw `DomainError`; the tRPC layer maps it to a `TRPCError` with
 * the right code and the pt-BR message. The error formatter exposes
 * `data.domainCode` so the UI can branch on specific errors (e.g. CPF taken).
 */
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server"

export const ERROR_CATALOG = {
  PAYOUT_NO_SURPLUS: { trpc: "UNPROCESSABLE_CONTENT", message: "A sobra do mês é zero ou negativa. Não há valor para ratear." },
  PAYOUT_NO_ATTENDANCE: { trpc: "UNPROCESSABLE_CONTENT", message: "Nenhuma presença registrada neste mês." },
  PERIOD_CLOSED: { trpc: "CONFLICT", message: "Este mês já foi fechado. Peça ao gestor para reabrir antes de alterar lançamentos." },
  PAYOUT_ALREADY_CLOSED: { trpc: "CONFLICT", message: "Este mês já tem um fechamento." },
  PERIOD_IN_FUTURE: { trpc: "UNPROCESSABLE_CONTENT", message: "Não é possível fechar um mês futuro." },
  PAYOUT_NOT_FOUND: { trpc: "NOT_FOUND", message: "Fechamento não encontrado." },
  PAYOUT_NOT_CLOSED: { trpc: "CONFLICT", message: "Só é possível reabrir um mês fechado." },
  PAYOUT_CHANGED_SINCE_SIMULATION: {
    trpc: "CONFLICT",
    message: "Os lançamentos mudaram desde a simulação. Atualize a tela e confira os números antes de fechar.",
  },
  VALIDATION: { trpc: "BAD_REQUEST", message: "Dados inválidos. Verifique os campos destacados." },
  MEMBER_CPF_TAKEN: { trpc: "CONFLICT", message: "Já existe um cooperado com este CPF." },
  MEMBER_NOT_FOUND: { trpc: "NOT_FOUND", message: "Cooperado não encontrado." },
  MEMBER_INACTIVE_ON_DATE: { trpc: "UNPROCESSABLE_CONTENT", message: "Cooperado não estava ativo nesta data." },
  MEMBER_HAS_RECORDS: {
    trpc: "CONFLICT",
    message: "Este cooperado tem presenças, vales ou fechamentos e não pode ser excluído. Use “Desligar”.",
  },
  MEMBER_NOT_LEFT: { trpc: "CONFLICT", message: "Este cooperado já está ativo." },
  SALE_NO_ITEMS: { trpc: "UNPROCESSABLE_CONTENT", message: "Adicione pelo menos um material à venda." },
  REFERENCE_NOT_FOUND: { trpc: "UNPROCESSABLE_CONTENT", message: "Comprador ou tipo de material não encontrado." },
  SALE_NOT_FOUND: { trpc: "NOT_FOUND", message: "Venda não encontrada." },
  PURCHASE_NO_ITEMS: { trpc: "UNPROCESSABLE_CONTENT", message: "Adicione pelo menos um material à compra." },
  PURCHASE_REFERENCE_NOT_FOUND: { trpc: "UNPROCESSABLE_CONTENT", message: "Fornecedor ou tipo de material não encontrado." },
  PURCHASE_NOT_FOUND: { trpc: "NOT_FOUND", message: "Compra não encontrada." },
  EXPENSE_NOT_FOUND: { trpc: "NOT_FOUND", message: "Despesa não encontrada." },
  ADVANCE_NOT_PENDING: { trpc: "CONFLICT", message: "Este vale já foi descontado e não pode ser cancelado." },
  ADVANCE_NOT_FOUND: { trpc: "NOT_FOUND", message: "Vale não encontrado." },
  SETTINGS_BELOW_LEGAL_MINIMUM: { trpc: "UNPROCESSABLE_CONTENT", message: "Reserva Legal mínima é 10% e FATES mínimo é 5%." },
  SETTINGS_INSS_RATE_OUT_OF_RANGE: { trpc: "UNPROCESSABLE_CONTENT", message: "A alíquota de INSS deve ficar entre 0% e 20%." },
  BUYER_NAME_TAKEN: { trpc: "CONFLICT", message: "Já existe um comprador com este nome." },
  MATERIAL_NAME_TAKEN: { trpc: "CONFLICT", message: "Já existe um material com este nome." },
  UNAUTHENTICATED: { trpc: "UNAUTHORIZED", message: "Faça login para continuar." },
  FORBIDDEN_ROLE: { trpc: "FORBIDDEN", message: "Você não tem permissão para esta ação." },
  INVALID_CREDENTIALS: { trpc: "UNAUTHORIZED", message: "E-mail ou senha incorretos." },
  EMAIL_TAKEN: { trpc: "CONFLICT", message: "Já existe uma conta com este e-mail." },
  TOO_MANY_ATTEMPTS: { trpc: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um minuto e tente de novo." },
  INTERNAL: { trpc: "INTERNAL_SERVER_ERROR", message: "Algo deu errado. Tente novamente em instantes." },
} as const satisfies Record<string, { trpc: TRPC_ERROR_CODE_KEY; message: string }>

export type DomainCode = keyof typeof ERROR_CATALOG

export class DomainError extends Error {
  readonly code: DomainCode

  constructor(code: DomainCode, message?: string) {
    super(message ?? ERROR_CATALOG[code].message)
    this.name = "DomainError"
    this.code = code
  }

  get trpcCode(): TRPC_ERROR_CODE_KEY {
    return ERROR_CATALOG[this.code].trpc
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
