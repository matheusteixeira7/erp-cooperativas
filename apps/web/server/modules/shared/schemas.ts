/**
 * Zod primitives shared by controllers (10-tipos/primitivos.json).
 * Transport contract only; use cases never import zod.
 */
import { z } from "zod"

import { isValidCpf, isValidPixKey } from "@/lib/validation"

export const idSchema = z.uuid()
export const localDateSchema = z.iso.date()
export const periodSchema = z.string().regex(/^(20[2-9]\d|2100)-(0[1-9]|1[0-2])$/, "Período inválido")
export const textSchema = z.string().trim().min(1).max(200)
export const moneySchema = z.number().finite().nonnegative()
export const positiveMoneySchema = z.number().finite().positive()
export const weightSchema = z.number().finite().positive()
export const pricePerKgSchema = z.number().finite().positive()
export const fractionSchema = z.number().min(0).max(1)
export const cpfSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => isValidCpf(value), "CPF inválido")
export const cnpjSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^\d{14}$/.test(value), "CNPJ deve ter 14 dígitos")
export const pixKeySchema = z
  .string()
  .trim()
  .max(77)
  .refine((value) => isValidPixKey(value), "Chave PIX inválida")
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 0 || (value.length >= 10 && value.length <= 13), "Telefone inválido")

export const materialCategorySchema = z.enum(["plastic", "paper", "metal", "glass", "waste", "other"])
export const materialConditionSchema = z.enum(["loose", "baled"])
export const supplierKindSchema = z.enum(["individual", "company"])
export const paymentMethodSchema = z.enum(["cash", "pix"])
export const advanceKindSchema = z.enum(["cash_advance", "purchase", "carry_over", "other"])
export const advanceStatusSchema = z.enum(["pending", "deducted", "cancelled"])
export const payoutStatusSchema = z.enum(["closed", "reopened"])
export const negativeBalancePolicySchema = z.enum(["carry_over", "forgive"])

export const paginationInput = {
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
}

/** "***.456.789-**" (PL-005) */
export function maskCpf(cpf: string | null | undefined) {
  if (!cpf || cpf.length !== 11) return null
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`
}
