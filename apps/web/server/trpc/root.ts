import { createTRPCRouter } from "./init"
import { systemRouter } from "./routers/system"

export const appRouter = createTRPCRouter({
  system: systemRouter,
})

export type AppRouter = typeof appRouter
