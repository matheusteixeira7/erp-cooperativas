/**
 * Error helpers for the UI. The server always sends a pt-BR message and a
 * `domainCode` (50-api/erros.json); the UI shows the message and may branch on
 * the code (e.g. highlight the CPF field on MEMBER_CPF_TAKEN).
 */
import { TRPCClientError } from "@trpc/client"

export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente em instantes."
export const OFFLINE_ERROR_MESSAGE = "Sem conexão com o servidor. Verifique a internet e tente de novo."

type ErrorData = { domainCode?: string | null; code?: string; zodError?: { fieldErrors?: Record<string, string[] | undefined> } | null }

export function domainCodeOf(error: unknown): string | null {
  if (error instanceof TRPCClientError) {
    const data = error.data as ErrorData | undefined
    return data?.domainCode ?? null
  }
  return null
}

export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof TRPCClientError)) return {}
  const data = error.data as ErrorData | undefined
  const fields = data?.zodError?.fieldErrors ?? {}
  return Object.fromEntries(Object.entries(fields).flatMap(([key, messages]) => (messages?.[0] ? [[key, messages[0]]] : [])))
}

export function errorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    if (error.message === "Failed to fetch" || error.cause instanceof TypeError) return OFFLINE_ERROR_MESSAGE
    return error.message || GENERIC_ERROR_MESSAGE
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) return OFFLINE_ERROR_MESSAGE
  if (error instanceof Error && error.message) return error.message
  return GENERIC_ERROR_MESSAGE
}

export function isUnauthorized(error: unknown) {
  return error instanceof TRPCClientError && (error.data as ErrorData | undefined)?.code === "UNAUTHORIZED"
}
