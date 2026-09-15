import { TRPCError, initTRPC } from "@trpc/server"
import { ZodError } from "zod"

import { DomainError, ERROR_CATALOG, type DomainCode } from "@/server/shared/errors"

import type { Role, TRPCContext } from "./context"

const t = initTRPC.context<TRPCContext>().create({
  isDev: process.env.NODE_ENV === "development",
  errorFormatter({ shape, error }) {
    const zodError = error.code === "BAD_REQUEST" && error.cause instanceof ZodError ? error.cause.flatten() : null
    const domainCode: DomainCode | null =
      error.cause instanceof DomainError
        ? error.cause.code
        : zodError
          ? "VALIDATION"
          : error.code === "INTERNAL_SERVER_ERROR"
            ? "INTERNAL"
            : error.code === "UNAUTHORIZED"
              ? "UNAUTHENTICATED"
              : error.code === "FORBIDDEN"
                ? "FORBIDDEN_ROLE"
                : null

    // The message is the only text that reaches the user: always pt-BR, and
    // never the raw database/driver message (NF-009).
    const message = error.cause instanceof DomainError ? error.cause.message : domainCode ? ERROR_CATALOG[domainCode].message : shape.message

    return {
      ...shape,
      message,
      data: {
        ...shape.data,
        domainCode,
        zodError,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

/**
 * Translates DomainError thrown by use cases into a typed TRPCError with the
 * catalog code (50-api/erros.json). Anything else stays INTERNAL_SERVER_ERROR
 * and is logged by the route handler.
 */
const domainErrorMiddleware = t.middleware(async ({ next }) => {
  const result = await next()
  if (!result.ok) {
    const cause = result.error.cause
    if (cause instanceof DomainError && result.error.code !== cause.trpcCode) {
      throw new TRPCError({ code: cause.trpcCode, message: cause.message, cause })
    }
  }
  return result
})

export const publicProcedure = t.procedure.use(domainErrorMiddleware)

/** Procedures that require an authenticated user. */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", cause: new DomainError("UNAUTHENTICATED") })
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  })
})

/** Role guard (PL-001). The user must hold at least one of the given roles. */
export function requireRole(...roles: Role[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!roles.some((role) => ctx.session.user.roles.includes(role))) {
      throw new TRPCError({ code: "FORBIDDEN", cause: new DomainError("FORBIDDEN_ROLE") })
    }
    return next()
  })
}

export const managerProcedure = requireRole("manager")
export const staffProcedure = requireRole("manager", "operator")
export const memberProcedure = requireRole("member")
