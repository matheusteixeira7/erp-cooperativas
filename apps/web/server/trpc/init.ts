import { TRPCError, initTRPC } from "@trpc/server"
import { ZodError } from "zod"

import type { TRPCContext } from "./context"

const t = initTRPC.context<TRPCContext>().create({
  isDev: process.env.NODE_ENV === "development",
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

/** Procedures that require an authenticated user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  })
})
