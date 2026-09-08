// Error catalog (50-api/erros.json). Messages shown to the user are pt-BR.

export const ERROR_MESSAGES = {
  "ERR-PAYOUT-001": "A sobra do mês é zero ou negativa. Não há valor para ratear.",
  "ERR-PAYOUT-002": "Nenhuma presença registrada neste mês.",
  "ERR-PAYOUT-003": "Este mês já foi fechado. Peça ao gestor para reabrir antes de alterar lançamentos.",
  "ERR-PAYOUT-004": "Este mês já tem um fechamento.",
  "ERR-PAYOUT-005": "Não é possível fechar um mês futuro.",
  "ERR-PAYOUT-006": "Fechamento não encontrado.",
  "ERR-PAYOUT-007": "Só é possível reabrir um mês fechado.",
  "ERR-VAL-001": "Dados inválidos. Verifique os campos destacados.",
  "ERR-MEMBER-001": "Já existe um cooperado com este CPF.",
  "ERR-MEMBER-002": "Cooperado não encontrado.",
  "ERR-MEMBER-003": "Cooperado não estava ativo nesta data.",
  "ERR-SALE-001": "Adicione pelo menos um material à venda.",
  "ERR-SALE-002": "Comprador ou tipo de material não encontrado.",
  "ERR-SALE-003": "Venda não encontrada.",
  "ERR-EXPENSE-001": "Despesa não encontrada.",
  "ERR-ADVANCE-001": "Este vale já foi descontado e não pode ser cancelado.",
  "ERR-ADVANCE-002": "Vale não encontrado.",
  "ERR-SETTINGS-001": "Reserva Legal mínima é 10% e FATES mínimo é 5%.",
  "ERR-AUTH-001": "Faça login para continuar.",
  "ERR-AUTH-002": "Você não tem permissão para esta ação.",
  "ERR-AUTH-003": "E-mail ou senha incorretos.",
  "ERR-SYS-001": "Algo deu errado. Tente novamente em instantes.",
} as const

export type ErrorCode = keyof typeof ERROR_MESSAGES

export class DemoError extends Error {
  code: ErrorCode

  constructor(code: ErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code])
    this.name = "DemoError"
    this.code = code
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof DemoError) return error.message
  if (error instanceof Error && error.message) return error.message
  return ERROR_MESSAGES["ERR-SYS-001"]
}
