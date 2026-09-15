import { z } from "zod"

import { purchaseReceipt } from "@/server/modules/payouts/payouts.export"
import * as service from "@/server/modules/purchases/purchases.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { idSchema, localDateSchema, paginationInput, paymentMethodSchema, periodSchema, supplierKindSchema } from "@/server/modules/shared/schemas"

import { createTRPCRouter, managerProcedure, staffProcedure } from "../init"
import { byMaterialSchema, saleItemInputSchema, tradeItemSchema } from "./sales"

export const purchaseSchema = z.object({
  id: idSchema,
  supplierId: idSchema,
  supplierName: z.string(),
  supplierKind: supplierKindSchema,
  supplierDocument: z.string().nullable(),
  purchasedOn: localDateSchema,
  totalAmount: z.number(),
  totalWeightKg: z.number(),
  paymentMethod: paymentMethodSchema,
  paidOn: localDateSchema.nullable(),
  note: z.string(),
  createdAt: z.string(),
  items: z.array(tradeItemSchema),
})

export const exportFileSchema = z.object({ filename: z.string(), mimeType: z.string(), base64: z.string() })

export const purchasesRouter = createTRPCRouter({
  list: staffProcedure
    .input(z.object({ period: periodSchema.optional(), supplierId: idSchema.optional(), materialTypeId: idSchema.optional(), ...paginationInput }))
    .output(
      z.object({
        items: z.array(purchaseSchema),
        nextCursor: z.string().nullable(),
        totals: z.object({ amount: z.number(), weightKg: z.number(), count: z.number().int() }),
        bySupplier: z.array(z.object({ supplierId: idSchema, supplierName: z.string(), amount: z.number(), weightKg: z.number(), count: z.number().int() })),
        byMaterial: z.array(byMaterialSchema),
        periodClosed: z.boolean(),
        closedPayoutId: idSchema.nullable(),
      }),
    )
    .query(({ ctx, input }) => service.listPurchases(ctx.db, actorFromSession(ctx.session), input)),

  create: staffProcedure
    .input(
      z.object({
        supplierId: idSchema,
        purchasedOn: localDateSchema,
        items: z.array(saleItemInputSchema.omit({ baleCount: true })).min(1).max(200),
        paymentMethod: paymentMethodSchema,
        paidOn: localDateSchema.nullish(),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .output(purchaseSchema)
    .mutation(({ ctx, input }) => service.createPurchase(ctx.db, actorFromSession(ctx.session), input)),

  delete: managerProcedure
    .input(z.object({ id: idSchema, reason: z.string().trim().max(500).optional() }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(({ ctx, input }) => service.deletePurchase(ctx.db, actorFromSession(ctx.session), input.id, input.reason)),

  receipt: staffProcedure
    .input(z.object({ id: idSchema }))
    .output(exportFileSchema)
    .query(({ ctx, input }) => purchaseReceipt(ctx.db, { ...actorFromSession(ctx.session), cooperativeName: ctx.session.cooperative.name }, input.id)),
})
