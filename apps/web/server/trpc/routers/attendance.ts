import { z } from "zod"

import * as service from "@/server/modules/attendance/attendance.service"
import { actorFromSession } from "@/server/modules/shared/actor"
import { idSchema, localDateSchema, periodSchema } from "@/server/modules/shared/schemas"

import { createTRPCRouter, memberProcedure, staffProcedure } from "../init"

const entrySchema = z.object({ memberId: idSchema, memberName: z.string(), present: z.boolean() })

export const attendanceRouter = createTRPCRouter({
  byDate: staffProcedure
    .input(z.object({ date: localDateSchema }))
    .output(
      z.object({
        date: localDateSchema,
        periodClosed: z.boolean(),
        closedPayoutId: idSchema.nullable(),
        recorded: z.boolean(),
        entries: z.array(entrySchema),
      }),
    )
    .query(({ ctx, input }) => service.byDate(ctx.db, actorFromSession(ctx.session), input.date)),

  saveDaily: staffProcedure
    .input(
      z.object({
        date: localDateSchema,
        entries: z
          .array(z.object({ memberId: idSchema, present: z.boolean(), note: z.string().max(500).optional() }))
          .min(1)
          .max(500)
          .refine((entries) => new Set(entries.map((e) => e.memberId)).size === entries.length, "Cooperado repetido na chamada"),
      }),
    )
    .output(z.object({ saved: z.number().int(), presentCount: z.number().int() }))
    .mutation(({ ctx, input }) => service.saveDaily(ctx.db, actorFromSession(ctx.session), input)),

  mine: memberProcedure
    .input(z.object({ period: periodSchema }))
    .output(z.object({ period: periodSchema, workedDays: z.number().int(), days: z.array(z.object({ date: localDateSchema, present: z.boolean() })) }))
    .query(({ ctx, input }) => service.mine(ctx.db, actorFromSession(ctx.session), input.period)),
})
