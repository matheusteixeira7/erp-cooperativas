/**
 * Vitest global setup: creates the test database if missing and applies the
 * Drizzle migrations. When PostgreSQL is not reachable the DB suites skip
 * themselves (see databaseAvailable), so pure domain tests still run.
 */
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/erp_cooperativas_test"

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL)
  const databaseName = url.pathname.slice(1)
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = "/postgres"

  const admin = new Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 2000, max: 1 })
  try {
    const exists = await admin.query("select 1 from pg_database where datname = $1", [databaseName])
    if (exists.rowCount === 0) await admin.query(`create database "${databaseName}"`)
  } catch (error) {
    console.warn(`[tests] PostgreSQL indisponível em ${adminUrl.host}: suites de banco serão puladas. (${(error as Error).message})`)
    process.env.DB_TESTS = "skip"
    return
  } finally {
    await admin.end().catch(() => undefined)
  }

  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 })
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" })
  } finally {
    await pool.end()
  }
}
