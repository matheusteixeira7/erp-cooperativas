import { z } from "zod"

import { summary } from "@/server/modules/dashboard/dashboard.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { idSchema, localDateSchema, periodSchema } from "@/server/modules/shared/schemas"

import { createTRPCRouter, staffProcedure } from "../init"

export const dashboardRouter = createTRPCRouter({
  summary: staffProcedure
    .output(
      z.object({
        today: localDateSchema,
        period: periodSchema,
        previousPeriod: periodSchema,
        attendance: z.object({ done: z.boolean(), present: z.number().int(), active: z.number().int() }),
        sales: z.object({ amount: z.number(), weightKg: z.number(), count: z.number().int() }),
        purchases: z.number(),
        expenses: z.number(),
        partialSurplus: z.number(),
        workedDays: z.number().int(),
        pendingAdvances: z.object({ count: z.number().int(), amount: z.number() }),
        previousPeriodClosed: z.boolean(),
        previousSimulation: z.object({ distributableSurplus: z.number() }).nullable(),
        lastClosed: z.object({ id: idSchema, period: periodSchema, unpaidCount: z.number().int() }).nullable(),
        recentSales: z.array(
          z.object({ id: idSchema, soldOn: localDateSchema, buyerName: z.string(), totalWeightKg: z.number(), totalAmount: z.number(), periodClosed: z.boolean() }),
        ),
        activeMembersCount: z.number().int(),
      }),
    )
    .query(({ ctx }) => summary(ctx.db, actorFromSession(ctx.session))),
})
