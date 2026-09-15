/**
 * Test database helpers. Tests run against a real PostgreSQL
 * (TEST_DATABASE_URL, default erp_cooperativas_test). The vitest global setup
 * creates the database and applies migrations; each test file resets and
 * seeds the demo data it needs.
 */
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import type { Database } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { DEMO_PASSWORD, ids } from "@/server/db/seed-data"
import { resetAndSeed } from "@/server/db/seed-runner"
import { hashPassword } from "@/server/shared/password"
import { createInnerTRPCContext, type Session } from "@/server/trpc/context"
import { appRouter } from "@/server/trpc/root"

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/erp_cooperativas_test"

let pool: Pool | null = null
let db: Database | null = null

export function testDb(): Database {
  if (!db) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 })
    db = drizzle({ client: pool, schema })
  }
  return db
}

export async function closeTestDb() {
  await pool?.end()
  pool = null
  db = null
}

/** True when the test database answers; used to skip DB suites when Postgres is down. */
export async function databaseAvailable() {
  if (process.env.DB_TESTS === "skip") return false
  try {
    const probe = new Pool({ connectionString: TEST_DATABASE_URL, connectionTimeoutMillis: 1500, max: 1 })
    try {
      await probe.query("select 1")
      return true
    } finally {
      await probe.end()
    }
  } catch {
    return false
  }
}

let cachedHash: string | null = null

export async function seedTestDatabase() {
  cachedHash ??= await hashPassword(DEMO_PASSWORD)
  return resetAndSeed(testDb(), cachedHash)
}

const cooperative = { id: ids.cooperative, name: "Cooperativa Recicla Vida", timezone: "America/Sao_Paulo" }

export const sessions = {
  manager: {
    user: { id: ids.user("u-marta"), name: "Marta Ribeiro", email: "marta@reciclavida.coop", cooperativeId: ids.cooperative, roles: ["manager", "operator"], memberId: null },
    cooperative,
    token: "test-manager",
  },
  operator: {
    user: { id: ids.user("u-jorge"), name: "Jorge Nascimento", email: "jorge@reciclavida.coop", cooperativeId: ids.cooperative, roles: ["operator"], memberId: null },
    cooperative,
    token: "test-operator",
  },
  member: {
    user: { id: ids.user("u-ana"), name: "Ana Maria Silva", email: "ana@reciclavida.coop", cooperativeId: ids.cooperative, roles: ["member"], memberId: ids.member("m1") },
    cooperative,
    token: "test-member",
  },
  /** A different cooperative: nothing from the seed must be visible (RN-027). */
  otherTenant: {
    user: { id: "00000000-0000-4000-a000-000000000001", name: "Outra", email: "outra@coop.test", cooperativeId: "00000000-0000-4000-a000-000000000002", roles: ["manager"], memberId: null },
    cooperative: { id: "00000000-0000-4000-a000-000000000002", name: "Outra Cooperativa", timezone: "America/Sao_Paulo" },
    token: "test-other",
  },
} satisfies Record<string, NonNullable<Session>>

export function callerFor(session: Session, resHeaders?: Headers) {
  return appRouter.createCaller(createInnerTRPCContext({ session, db: testDb(), resHeaders }))
}
