/**
 * Append-only audit trail (PL-006). Called inside the same transaction as the
 * mutation it describes.
 */
import type { DbClient } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

export type AuditAction = (typeof auditLogs.$inferInsert)["action"]

export async function audit(
  db: DbClient,
  entry: {
    cooperativeId: string
    userId: string | null
    action: AuditAction
    entity: string
    entityId: string
    before?: unknown
    after?: unknown
  },
) {
  await db.insert(auditLogs).values({
    cooperativeId: entry.cooperativeId,
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  })
}
