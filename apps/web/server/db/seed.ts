/**
 * CLI: `pnpm --filter web db:seed`. Replaces the database content with the
 * demo cooperative (3 users, 9 members, sales, purchases, a closed month).
 * Requires migrations applied (`pnpm --filter web db:migrate`).
 */
import nextEnv from "@next/env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { hashPassword } from "../shared/password"

import * as schema from "./schema"
import { DEMO_PASSWORD, DEMO_USERS } from "./seed-data"
import { resetAndSeed } from "./seed-runner"

nextEnv.loadEnvConfig(process.cwd())

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  const pool = new Pool({ connectionString: url })
  const db = drizzle({ client: pool, schema })
  try {
    const passwordHash = await hashPassword(DEMO_PASSWORD)
    await db.transaction(async (tx) => {
      await resetAndSeed(tx, passwordHash)
    })
    console.log("Seed applied. Demo accounts (password: %s):", DEMO_PASSWORD)
    for (const user of DEMO_USERS) console.log(`  ${user.email}  [${user.roles.join(", ")}]`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
