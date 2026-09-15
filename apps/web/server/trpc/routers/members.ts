import { z } from "zod"

import * as service from "@/server/modules/members/members.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { cpfSchema, idSchema, localDateSchema, phoneSchema, pixKeySchema } from "@/server/modules/shared/schemas"

import { createTRPCRouter, managerProcedure, staffProcedure } from "../init"

export const memberSchema = z.object({
  id: idSchema,
  name: z.string(),
  cpfMasked: z.string(),
  cpf: z.string().nullable(),
  pixKey: z.string().nullable(),
  phone: z.string(),
  admittedOn: localDateSchema,
  leftOn: localDateSchema.nullable(),
  active: z.boolean(),
  inssWithheld: z.boolean(),
  notes: z.string(),
  hasRecords: z.boolean(),
  hasAccess: z.boolean(),
  accessEmail: z.string().nullable(),
})

const accessSchema = z
  .object({
    email: z.email(),
    password: z.string().min(6).max(128).optional(),
  })
  .nullable()
  .optional()

const optionalPixKey = z.union([z.literal(""), pixKeySchema])

export const membersRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z
        .object({
          activeOn: localDateSchema.optional(),
          includeInactive: z.boolean().default(false),
          search: z.string().trim().max(100).optional(),
        })
        .default({ includeInactive: false }),
    )
    .output(z.object({ items: z.array(memberSchema) }))
    .query(async ({ ctx, input }) => ({
      items: await service.listMembers(
        ctx.db,
        { ...actorFromSession(ctx.session), manager: ctx.session.user.roles.includes("manager") },
        input,
      ),
    })),

  byId: managerProcedure
    .input(z.object({ id: idSchema }))
    .output(memberSchema)
    .query(({ ctx, input }) => service.getMember(ctx.db, actorFromSession(ctx.session), input.id)),

  create: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(200),
        cpf: cpfSchema,
        pixKey: optionalPixKey,
        phone: phoneSchema,
        admittedOn: localDateSchema.optional(),
        inssWithheld: z.boolean().default(true),
        notes: z.string().trim().max(2000).default(""),
        access: accessSchema,
      }),
    )
    .output(memberSchema)
    .mutation(({ ctx, input }) => service.createMember(ctx.db, actorFromSession(ctx.session), input)),

  update: managerProcedure
    .input(
      z.object({
        id: idSchema,
        name: z.string().trim().min(2).max(200).optional(),
        pixKey: optionalPixKey.optional(),
        phone: phoneSchema.optional(),
        admittedOn: localDateSchema.optional(),
        inssWithheld: z.boolean().optional(),
        notes: z.string().trim().max(2000).optional(),
        access: accessSchema,
      }),
    )
    .output(memberSchema)
    .mutation(({ ctx, input }) => {
      const { id, ...rest } = input
      return service.updateMember(ctx.db, actorFromSession(ctx.session), id, rest)
    }),

  deactivate: managerProcedure
    .input(z.object({ id: idSchema, leftOn: localDateSchema, reason: z.string().trim().max(500).optional() }))
    .output(memberSchema)
    .mutation(({ ctx, input }) => service.deactivateMember(ctx.db, actorFromSession(ctx.session), input.id, input.leftOn)),

  reactivate: managerProcedure
    .input(z.object({ id: idSchema }))
    .output(memberSchema)
    .mutation(({ ctx, input }) => service.reactivateMember(ctx.db, actorFromSession(ctx.session), input.id)),

  delete: managerProcedure
    .input(z.object({ id: idSchema }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(({ ctx, input }) => service.deleteMember(ctx.db, actorFromSession(ctx.session), input.id)),
})

