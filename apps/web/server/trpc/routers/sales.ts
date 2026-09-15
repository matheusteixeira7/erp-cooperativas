import { z } from "zod"

import * as service from "@/server/modules/sales/sales.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { idSchema, localDateSchema, materialConditionSchema, paginationInput, periodSchema, pricePerKgSchema, weightSchema } from "@/server/modules/shared/schemas"

import { createTRPCRouter, managerProcedure, staffProcedure } from "../init"

export const saleItemInputSchema = z.object({
  materialTypeId: idSchema,
  condition: materialConditionSchema,
  weightKg: weightSchema,
  pricePerKg: pricePerKgSchema,
  baleCount: z.number().int().positive().nullish(),
})

export const tradeItemSchema = z.object({
  id: idSchema,
  materialTypeId: idSchema,
  materialTypeName: z.string(),
  condition: materialConditionSchema,
  weightKg: z.number(),
  pricePerKg: z.number(),
  subtotal: z.number(),
})

export const saleSchema = z.object({
  id: idSchema,
  buyerId: idSchema,
  buyerName: z.string(),
  soldOn: localDateSchema,
  totalAmount: z.number(),
  totalWeightKg: z.number(),
  invoiceNumber: z.string(),
  note: z.string(),
  createdAt: z.string(),
  items: z.array(tradeItemSchema),
})

export const byMaterialSchema = z.object({
  materialTypeId: idSchema,
  materialTypeName: z.string(),
  condition: materialConditionSchema,
  amount: z.number(),
  weightKg: z.number(),
})

export const salesRouter = createTRPCRouter({
  list: staffProcedure
    .input(z.object({ period: periodSchema.optional(), buyerId: idSchema.optional(), materialTypeId: idSchema.optional(), ...paginationInput }))
    .output(
      z.object({
        items: z.array(saleSchema),
        nextCursor: z.string().nullable(),
        totals: z.object({ amount: z.number(), weightKg: z.number(), count: z.number().int() }),
        byMaterial: z.array(byMaterialSchema),
        periodClosed: z.boolean(),
        closedPayoutId: idSchema.nullable(),
      }),
    )
    .query(({ ctx, input }) => service.listSales(ctx.db, actorFromSession(ctx.session), input)),

  create: staffProcedure
    .input(
      z.object({
        buyerId: idSchema,
        soldOn: localDateSchema,
        items: z.array(saleItemInputSchema).min(1).max(200),
        invoiceNumber: z.string().trim().max(50).optional(),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .output(saleSchema)
    .mutation(({ ctx, input }) => service.createSale(ctx.db, actorFromSession(ctx.session), input)),

  delete: managerProcedure
    .input(z.object({ id: idSchema, reason: z.string().trim().max(500).optional() }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(({ ctx, input }) => service.deleteSale(ctx.db, actorFromSession(ctx.session), input.id, input.reason)),
})
