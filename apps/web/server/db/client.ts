/**
 * Database client types shared by repositories. Repositories receive the
 * client (or a transaction) as a parameter so the same code runs against the
 * app database, a test database, or inside `db.transaction`.
 */
import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PgTransaction } from "drizzle-orm/pg-core"
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres"

import type * as schema from "./schema"

export type Database = NodePgDatabase<typeof schema>
export type Transaction = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
export type DbClient = Database | Transaction
