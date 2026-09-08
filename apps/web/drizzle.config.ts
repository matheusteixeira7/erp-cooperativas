import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

loadEnvConfig(process.cwd())

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle Kit")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
})
