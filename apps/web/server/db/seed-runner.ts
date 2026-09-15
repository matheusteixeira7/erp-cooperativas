/**
 * Inserts the demo dataset into a database. Shared by the CLI seed script and
 * the router tests. Deletes everything first: this is demo data, not a
 * migration.
 */
import { sql } from "drizzle-orm"

import type { DbClient } from "./client"
import * as schema from "./schema"
import { buildSeed } from "./seed-data"

export async function truncateAll(db: DbClient) {
  await db.execute(sql`
    truncate table
      audit_logs, sessions, payout_items, payouts, payout_settings, attendances, advances,
      expenses, purchase_items, purchases, sale_items, sales, suppliers, buyers, material_types,
      users, members, cooperatives
    restart identity cascade
  `)
}

export async function insertSeed(db: DbClient, passwordHash: string) {
  const data = buildSeed(passwordHash)
  await db.insert(schema.cooperatives).values(data.cooperative)
  await db.insert(schema.members).values(data.members)
  await db.insert(schema.users).values(data.users)
  await db.insert(schema.buyers).values(data.buyers)
  await db.insert(schema.suppliers).values(data.suppliers)
  await db.insert(schema.materialTypes).values(data.materialTypes)
  await db.insert(schema.sales).values(data.sales)
  await db.insert(schema.saleItems).values(data.saleItems)
  await db.insert(schema.purchases).values(data.purchases)
  await db.insert(schema.purchaseItems).values(data.purchaseItems)
  await db.insert(schema.expenses).values(data.expenses)
  await db.insert(schema.payoutSettings).values(data.payoutSettings)
  await db.insert(schema.payouts).values(data.payouts)
  await db.insert(schema.payoutItems).values(data.payoutItems)
  await db.insert(schema.advances).values(data.advances)
  await db.insert(schema.attendances).values(data.attendances)
  return data
}

export async function resetAndSeed(db: DbClient, passwordHash: string) {
  await truncateAll(db)
  return insertSeed(db, passwordHash)
}
