import { z } from "zod"

import * as service from "@/server/modules/catalog/catalog.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import {
  cnpjSchema,
  cpfSchema,
  idSchema,
  localDateSchema,
  materialCategorySchema,
  materialConditionSchema,
  phoneSchema,
  pixKeySchema,
  supplierKindSchema,
  textSchema,
} from "@/server/modules/shared/schemas"

import { createTRPCRouter, managerProcedure, staffProcedure } from "../init"

export const materialTypeSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: materialCategorySchema,
  defaultCondition: materialConditionSchema,
  active: z.boolean(),
  sortOrder: z.number().int(),
})

export const buyerSchema = z.object({ id: idSchema, name: z.string(), cnpj: z.string(), contact: z.string(), active: z.boolean() })

export const supplierSchema = z.object({
  id: idSchema,
  kind: supplierKindSchema,
  name: z.string(),
  cpfMasked: z.string().nullable(),
  cnpj: z.string(),
  pixKey: z.string().nullable(),
  phone: z.string(),
  active: z.boolean(),
  document: z.string().nullable(),
})

export const materialTypesRouter = createTRPCRouter({
  list: staffProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).default({ includeInactive: false }))
    .output(z.array(materialTypeSchema))
    .query(({ ctx, input }) => service.listMaterialTypes(ctx.db, actorFromSession(ctx.session), input.includeInactive)),

  create: managerProcedure
    .input(z.object({ name: textSchema, category: materialCategorySchema, defaultCondition: materialConditionSchema.default("baled") }))
    .output(materialTypeSchema)
    .mutation(({ ctx, input }) => service.createMaterialType(ctx.db, actorFromSession(ctx.session), input)),

  lastPrice: staffProcedure
    .input(
      z
        .object({
          materialTypeId: idSchema,
          condition: materialConditionSchema,
          buyerId: idSchema.optional(),
          supplierId: idSchema.optional(),
        })
        .refine((v) => Boolean(v.buyerId) !== Boolean(v.supplierId), "Informe comprador ou fornecedor"),
    )
    .output(z.object({ pricePerKg: z.number(), on: localDateSchema }).nullable())
    .query(({ ctx, input }) => service.lastPrice(ctx.db, actorFromSession(ctx.session), input)),
})

export const buyersRouter = createTRPCRouter({
  list: staffProcedure
    .input(z.object({ search: z.string().trim().max(100).optional(), includeInactive: z.boolean().default(false) }).default({ includeInactive: false }))
    .output(z.array(buyerSchema))
    .query(({ ctx, input }) => service.listBuyers(ctx.db, actorFromSession(ctx.session), input)),

  create: staffProcedure
    .input(z.object({ name: z.string().trim().min(2).max(200), cnpj: z.union([z.literal(""), cnpjSchema]).optional(), contact: z.string().trim().max(200).optional() }))
    .output(buyerSchema)
    .mutation(({ ctx, input }) => service.createBuyer(ctx.db, actorFromSession(ctx.session), input)),
})

export const suppliersRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z
        .object({ search: z.string().trim().max(100).optional(), kind: supplierKindSchema.optional(), includeInactive: z.boolean().default(false) })
        .default({ includeInactive: false }),
    )
    .output(z.array(supplierSchema))
    .query(({ ctx, input }) => service.listSuppliers(ctx.db, actorFromSession(ctx.session), input)),

  create: staffProcedure
    .input(
      z.object({
        kind: supplierKindSchema,
        name: z.string().trim().min(2).max(200),
        cpf: z.union([z.literal(""), cpfSchema]).optional(),
        cnpj: z.union([z.literal(""), cnpjSchema]).optional(),
        pixKey: z.union([z.literal(""), pixKeySchema]).optional(),
        phone: phoneSchema.optional(),
      }),
    )
    .output(supplierSchema)
    .mutation(({ ctx, input }) => service.createSupplier(ctx.db, actorFromSession(ctx.session), input)),
})
