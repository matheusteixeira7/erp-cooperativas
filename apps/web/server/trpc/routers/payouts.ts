import { z } from "zod"

import { exportPayout } from "@/server/modules/payouts/payouts.export"
import * as service from "@/server/modules/payouts/payouts.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { periodStatus } from "@/server/modules/shared/period-lock"
import { idSchema, localDateSchema, moneySchema, payoutStatusSchema, periodSchema } from "@/server/modules/shared/schemas"

import { createTRPCRouter, managerProcedure, requireRole } from "../init"
import { advanceSchema } from "./finance"
import { payoutSettingsVersionSchema } from "./payout-settings"
import { exportFileSchema } from "./purchases"

const snapshotSchema = payoutSettingsVersionSchema.omit({ createdBy: true, createdAt: true })

export const payoutItemSchema = z.object({
  id: idSchema,
  payoutId: idSchema,
  memberId: idSchema,
  memberNameSnapshot: z.string(),
  workedDays: z.number().int(),
  grossAmount: z.number(),
  inssBase: z.number(),
  inssRate: z.number(),
  inssAmount: z.number(),
  deductionsAmount: z.number(),
  netAmount: z.number(),
  carryOverDebt: z.number(),
  paidAt: z.string().nullable(),
})

const totalsShape = {
  grossRevenue: z.number(),
  totalPurchases: z.number(),
  totalExpenses: z.number(),
  surplus: z.number(),
  legalReserveAmount: z.number(),
  fatesAmount: z.number(),
  otherFundsAmount: z.number(),
  distributableSurplus: z.number(),
  totalWorkedDays: z.number().int(),
  dayValue: z.number(),
  distributedTotal: z.number(),
  roundingResidual: z.number(),
  inssTotal: z.number(),
  totalDeductions: z.number(),
  totalNet: z.number(),
}

export const payoutSchema = z.object({
  id: idSchema,
  period: periodSchema,
  status: payoutStatusSchema,
  ...totalsShape,
  settingsSnapshot: snapshotSchema,
  closedBy: z.string(),
  closedAt: z.string(),
  reopenedBy: z.string().nullable(),
  reopenedAt: z.string().nullable(),
  reopenReason: z.string().nullable(),
  items: z.array(payoutItemSchema),
})

const simulationItemSchema = z.object({
  memberId: idSchema,
  memberName: z.string(),
  workedDays: z.number().int(),
  grossAmount: z.number(),
  inssBase: z.number(),
  inssRate: z.number(),
  inssAmount: z.number(),
  deductionsAmount: z.number(),
  netAmount: z.number(),
  carryOverDebt: z.number(),
  advanceIds: z.array(idSchema),
})

const simulationSchema = z.object({
  period: periodSchema,
  periodClosed: z.boolean(),
  closedPayoutId: idSchema.nullable(),
  settings: payoutSettingsVersionSchema,
  outcome: z.discriminatedUnion("ok", [
    z.object({
      ok: z.literal(true),
      result: z.object({ period: periodSchema, ...totalsShape, items: z.array(simulationItemSchema), warnings: z.array(z.string()) }),
    }),
    z.object({
      ok: z.literal(false),
      code: z.enum(["NO_SURPLUS", "NO_ATTENDANCE"]),
      details: z.object({ grossRevenue: z.number(), totalPurchases: z.number(), totalExpenses: z.number(), surplus: z.number() }),
    }),
  ]),
})

const statementSchema = z
  .object({
    period: periodSchema,
    member: z.object({ id: idSchema, name: z.string(), admittedOn: localDateSchema }),
    presences: z.array(localDateSchema),
    closed: z
      .object({
        payout: z.object({ id: idSchema, period: periodSchema, dayValue: z.number(), totalWorkedDays: z.number().int(), closedAt: z.string(), inssTotal: z.number() }),
        item: payoutItemSchema,
        deductedAdvances: z.array(advanceSchema),
      })
      .nullable(),
    pendingAdvances: z.array(advanceSchema),
  })
  .nullable()

export const payoutsRouter = createTRPCRouter({
  periodStatus: requireRole("manager", "operator", "member")
    .input(z.object({ period: periodSchema }))
    .output(z.object({ period: periodSchema, closed: z.boolean(), payoutId: idSchema.nullable() }))
    .query(({ ctx, input }) => periodStatus(ctx.db, ctx.session.user.cooperativeId, input.period)),

  simulate: managerProcedure
    .input(z.object({ period: periodSchema }))
    .output(simulationSchema)
    .query(async ({ ctx, input }) => {
      const simulation = await service.simulate(ctx.db, actorFromSession(ctx.session), input.period)
      const outcome = simulation.outcome
      return {
        period: input.period,
        periodClosed: simulation.periodClosed,
        closedPayoutId: simulation.closedPayoutId,
        settings: simulation.settingsVersion,
        outcome: outcome.ok
          ? {
              ok: true as const,
              result: {
                period: outcome.result.period,
                grossRevenue: outcome.result.grossRevenue,
                totalPurchases: outcome.result.totalPurchases,
                totalExpenses: outcome.result.totalExpenses,
                surplus: outcome.result.surplus,
                legalReserveAmount: outcome.result.legalReserveAmount,
                fatesAmount: outcome.result.fatesAmount,
                otherFundsAmount: outcome.result.otherFundsAmount,
                distributableSurplus: outcome.result.distributableSurplus,
                totalWorkedDays: outcome.result.totalWorkedDays,
                dayValue: outcome.result.dayValue,
                distributedTotal: outcome.result.distributedTotal,
                roundingResidual: outcome.result.roundingResidual,
                inssTotal: outcome.result.inssTotal,
                totalDeductions: outcome.result.totalDeductions,
                totalNet: outcome.result.totalNet,
                items: outcome.result.items,
                warnings: outcome.result.warnings,
              },
            }
          : { ok: false as const, code: outcome.code, details: outcome.details },
      }
    }),

  close: managerProcedure
    .input(z.object({ period: periodSchema, confirmDistributableSurplus: moneySchema }))
    .output(payoutSchema)
    .mutation(({ ctx, input }) => service.close(ctx.db, actorFromSession(ctx.session), input)),

  list: managerProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().int().min(1).max(100).default(24) }).default({ limit: 24 }))
    .output(z.object({ items: z.array(payoutSchema), nextCursor: z.string().nullable() }))
    .query(({ ctx }) => service.list(ctx.db, actorFromSession(ctx.session))),

  byId: managerProcedure
    .input(z.object({ id: idSchema }))
    .output(payoutSchema.extend({ deductedAdvances: z.array(advanceSchema) }))
    .query(({ ctx, input }) => service.byId(ctx.db, actorFromSession(ctx.session), input.id)),

  reopen: managerProcedure
    .input(z.object({ id: idSchema, reason: z.string().trim().min(10).max(1000) }))
    .output(payoutSchema)
    .mutation(({ ctx, input }) => service.reopen(ctx.db, actorFromSession(ctx.session), input)),

  markPaid: managerProcedure
    .input(z.object({ payoutId: idSchema, memberIds: z.array(idSchema).min(1).max(500), paid: z.boolean().default(true), paidAt: z.iso.datetime().optional() }))
    .output(z.object({ updated: z.number().int() }))
    .mutation(({ ctx, input }) => service.markPaid(ctx.db, actorFromSession(ctx.session), input)),

  markAllPaid: managerProcedure
    .input(z.object({ payoutId: idSchema }))
    .output(z.object({ updated: z.number().int() }))
    .mutation(({ ctx, input }) => service.markAllPaid(ctx.db, actorFromSession(ctx.session), input.payoutId)),

  memberStatement: requireRole("manager", "member")
    .input(z.object({ period: periodSchema, memberId: idSchema.optional() }))
    .output(statementSchema)
    .query(({ ctx, input }) => service.memberStatement(ctx.db, actorFromSession(ctx.session), input)),

  export: managerProcedure
    .input(z.object({ id: idSchema, format: z.enum(["csv", "pdf"]), report: z.enum(["payout", "inss"]).default("payout") }))
    .output(exportFileSchema)
    .query(({ ctx, input }) => exportPayout(ctx.db, { ...actorFromSession(ctx.session), cooperativeName: ctx.session.cooperative.name }, input)),
})
