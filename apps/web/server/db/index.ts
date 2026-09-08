import "server-only"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "@/env"

import * as schema from "./schema"

const globalForDatabase = globalThis as typeof globalThis & {
  databasePool?: Pool
}

const pool =
  globalForDatabase.databasePool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.databasePool = pool
}

export const db = drizzle({ client: pool, schema })
