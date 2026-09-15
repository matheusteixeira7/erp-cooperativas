import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    /** IANA timezone used for "today" and month competence (NF-002). */
    APP_TIMEZONE: z.string().min(1).default("America/Sao_Paulo"),
  },
  experimental__runtimeEnv: process.env,
})
