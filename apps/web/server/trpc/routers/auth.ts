import { z } from "zod"

import { login, logout, sessionCookieHeader, signup } from "@/server/modules/auth/auth.service"

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init"

const roleSchema = z.enum(["manager", "operator", "member"])

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(roleSchema),
  memberId: z.string().nullable(),
  cooperative: z.object({ id: z.string(), name: z.string(), timezone: z.string() }),
})

export type SessionUser = z.infer<typeof sessionUserSchema>

function toSessionUser(session: NonNullable<Awaited<ReturnType<typeof login>>>): SessionUser {
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: session.user.roles,
    memberId: session.user.memberId,
    cooperative: session.cooperative,
  }
}

export const authRouter = createTRPCRouter({
  session: publicProcedure.output(z.object({ user: sessionUserSchema }).nullable()).query(({ ctx }) => {
    if (!ctx.session) return null
    return { user: toSessionUser(ctx.session) }
  }),

  login: publicProcedure
    .input(z.object({ email: z.email(), password: z.string().min(1).max(128) }))
    .output(z.object({ user: sessionUserSchema }))
    .mutation(async ({ ctx, input }) => {
      const session = await login(ctx.db, input)
      ctx.resHeaders.append("Set-Cookie", sessionCookieHeader(session.token))
      return { user: toSessionUser(session) }
    }),

  signup: publicProcedure
    .input(
      z.object({
        cooperativeName: z.string().trim().min(2).max(200),
        managerName: z.string().trim().min(2).max(200),
        email: z.email(),
        password: z.string().min(6).max(128),
      }),
    )
    .output(z.object({ user: sessionUserSchema }))
    .mutation(async ({ ctx, input }) => {
      const session = await signup(ctx.db, input)
      ctx.resHeaders.append("Set-Cookie", sessionCookieHeader(session.token))
      return { user: toSessionUser(session) }
    }),

  logout: protectedProcedure.output(z.object({ ok: z.literal(true) })).mutation(async ({ ctx }) => {
    await logout(ctx.db, ctx.session)
    ctx.resHeaders.append("Set-Cookie", sessionCookieHeader(null))
    return { ok: true as const }
  }),
})
