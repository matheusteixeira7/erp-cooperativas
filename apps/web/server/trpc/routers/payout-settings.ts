import { z } from "zod"

import * as service from "@/server/modules/payout-settings/payout-settings.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { fractionSchema, negativeBalancePolicySchema, periodSchema } from "@/server/modules/shared/schemas"
import { currentPeriod } from "@/server/shared/dates"

import { createTRPCRouter, managerProcedure } from "../init"

export const payoutSettingsVersionSchema = z.object({
  id: z.string().nullable(),
  effectiveFrom: z.string(),
  legalReserveRate: z.number(),
  fatesRate: z.number(),
  otherFundsRate: z.number(),
  inssRate: z.number(),
  negativeBalancePolicy: negativeBalancePolicySchema,
  includeMembersLeftInPeriod: z.boolean(),
  isLegalDefault: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
})

export const payoutSettingsRouter = createTRPCRouter({
  get: managerProcedure
    .input(z.object({ period: periodSchema.optional() }).default({}))
    .output(z.object({ current: payoutSettingsVersionSchema, isDefault: z.boolean(), history: z.array(payoutSettingsVersionSchema) }))
    .query(({ ctx, input }) => service.getSettings(ctx.db, actorFromSession(ctx.session), input.period ?? currentPeriod(ctx.session.cooperative.timezone))),

  update: managerProcedure
    .input(
      z.object({
        effectiveFrom: periodSchema,
        legalReserveRate: fractionSchema,
        fatesRate: fractionSchema,
        otherFundsRate: fractionSchema,
        inssRate: fractionSchema,
        negativeBalancePolicy: negativeBalancePolicySchema,
        includeMembersLeftInPeriod: z.boolean(),
      }),
    )
    .output(payoutSettingsVersionSchema)
    .mutation(({ ctx, input }) => service.updateSettings(ctx.db, actorFromSession(ctx.session), input)),
})
