import { z } from "zod"

import { createTRPCRouter, publicProcedure } from "../init"

/**
 * Router técnico, deliberadamente pequeno. Os routers de produto devem ficar
 * em arquivos irmãos, um por domínio (por exemplo, `cooperatives.ts`).
 */
export const systemRouter = createTRPCRouter({
  ping: publicProcedure
    .output(z.object({ ok: z.literal(true) }))
    .query(() => ({ ok: true })),
})
