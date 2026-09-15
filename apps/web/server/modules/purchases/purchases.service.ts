/**
 * Material purchases (DEC-008, FL-008). Mirror of sales: same catalog, same
 * server-side totals, same soft delete and closed-month lock.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { materialTypes, purchaseItems, purchases, suppliers } from "@/server/db/schema"
import { toSupplierDto } from "@/server/modules/catalog/catalog.service"
import type { Actor } from "@/server/modules/shared/actor"
import { computeItems, decodeCursor, encodeCursor, type ItemInput } from "@/server/modules/shared/items"
import { assertPeriodOpen, periodStatus } from "@/server/modules/shared/period-lock"
import { audit } from "@/server/shared/audit"
import { firstDayOf, lastDayOf, nowIso, todayIso } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

export type PurchaseDto = {
  id: string
  supplierId: string
  supplierName: string
  supplierKind: "individual" | "company"
  /** "CPF ***.456.789-**" / "CNPJ 1234..." or null when the supplier gave no document. */
  supplierDocument: string | null
  purchasedOn: string
  totalAmount: number
  totalWeightKg: number
  paymentMethod: "cash" | "pix"
  paidOn: string | null
  note: string
  createdAt: string
  items: { id: string; materialTypeId: string; materialTypeName: string; condition: "loose" | "baled"; weightKg: number; pricePerKg: number; subtotal: number }[]
}

async function loadPurchases(db: DbClient, cooperativeId: string, ids: string[]): Promise<PurchaseDto[]> {
  if (ids.length === 0) return []
  const rows = await db.query.purchases.findMany({
    where: and(eq(purchases.cooperativeId, cooperativeId), inArray(purchases.id, ids)),
    with: { supplier: true, items: { with: { materialType: true }, orderBy: asc(purchaseItems.position) } },
  })
  const byId = new Map(
    rows.map((row) => {
      const supplier = toSupplierDto(row.supplier, false)
      return [
        row.id,
        {
          id: row.id,
          supplierId: row.supplierId,
          supplierName: row.supplier.name,
          supplierKind: row.supplier.kind,
          supplierDocument: supplier.document,
          purchasedOn: row.purchasedOn,
          totalAmount: row.totalAmount,
          totalWeightKg: row.totalWeightKg,
          paymentMethod: row.paymentMethod,
          paidOn: row.paidOn,
          note: row.note ?? "",
          createdAt: row.createdAt,
          items: row.items.map((item) => ({
            id: item.id,
            materialTypeId: item.materialTypeId,
            materialTypeName: item.materialType.name,
            condition: item.condition,
            weightKg: item.weightKg,
            pricePerKg: item.pricePerKg,
            subtotal: item.subtotal,
          })),
        } satisfies PurchaseDto,
      ]
    }),
  )
  return ids.map((id) => byId.get(id)).filter((p): p is PurchaseDto => Boolean(p))
}

export type ListPurchasesInput = { period?: string; supplierId?: string; materialTypeId?: string; cursor?: string | null; limit: number }

export async function listPurchases(db: DbClient, actor: Actor, input: ListPurchasesInput) {
  const conditions = [eq(purchases.cooperativeId, actor.cooperativeId), isNull(purchases.deletedAt)]
  if (input.period) conditions.push(gte(purchases.purchasedOn, firstDayOf(input.period)), lte(purchases.purchasedOn, lastDayOf(input.period)))
  if (input.supplierId) conditions.push(eq(purchases.supplierId, input.supplierId))
  if (input.materialTypeId) {
    conditions.push(sql`exists(select 1 from ${purchaseItems} where ${purchaseItems.purchaseId} = ${purchases.id} and ${purchaseItems.materialTypeId} = ${input.materialTypeId})`)
  }
  const where = and(...conditions)

  const pageConditions = [where]
  const cursor = decodeCursor(input.cursor)
  if (cursor) {
    pageConditions.push(sql`(${purchases.purchasedOn}, ${purchases.createdAt}, ${purchases.id}) < (${cursor.on}::date, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`)
  }

  const [page, totals, bySupplier, byMaterial, status] = await Promise.all([
    db
      .select({ id: purchases.id, purchasedOn: purchases.purchasedOn, createdAt: purchases.createdAt })
      .from(purchases)
      .where(and(...pageConditions))
      .orderBy(desc(purchases.purchasedOn), desc(purchases.createdAt), desc(purchases.id))
      .limit(input.limit + 1),
    db
      .select({ amount: sql<number>`coalesce(sum(${purchases.totalAmount}), 0)::float8`, weightKg: sql<number>`coalesce(sum(${purchases.totalWeightKg}), 0)::float8`, count: sql<number>`count(*)::int` })
      .from(purchases)
      .where(where),
    db
      .select({
        supplierId: purchases.supplierId,
        supplierName: suppliers.name,
        amount: sql<number>`sum(${purchases.totalAmount})::float8`,
        weightKg: sql<number>`sum(${purchases.totalWeightKg})::float8`,
        count: sql<number>`count(*)::int`,
      })
      .from(purchases)
      .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
      .where(where)
      .groupBy(purchases.supplierId, suppliers.name)
      .orderBy(desc(sql`sum(${purchases.totalAmount})`)),
    db
      .select({
        materialTypeId: purchaseItems.materialTypeId,
        materialTypeName: materialTypes.name,
        condition: purchaseItems.condition,
        amount: sql<number>`sum(${purchaseItems.subtotal})::float8`,
        weightKg: sql<number>`sum(${purchaseItems.weightKg})::float8`,
      })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
      .innerJoin(materialTypes, eq(materialTypes.id, purchaseItems.materialTypeId))
      .where(where)
      .groupBy(purchaseItems.materialTypeId, materialTypes.name, purchaseItems.condition)
      .orderBy(desc(sql`sum(${purchaseItems.subtotal})`)),
    input.period ? periodStatus(db, actor.cooperativeId, input.period) : Promise.resolve(null),
  ])

  const hasMore = page.length > input.limit
  const rows = hasMore ? page.slice(0, input.limit) : page
  const last = rows[rows.length - 1]
  const items = await loadPurchases(db, actor.cooperativeId, rows.map((r) => r.id))

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ on: last.purchasedOn, createdAt: last.createdAt, id: last.id }) : null,
    totals: { amount: totals[0]?.amount ?? 0, weightKg: totals[0]?.weightKg ?? 0, count: totals[0]?.count ?? 0 },
    bySupplier,
    byMaterial,
    periodClosed: status?.closed ?? false,
    closedPayoutId: status?.payoutId ?? null,
  }
}

export async function getPurchase(db: DbClient, actor: Actor, id: string) {
  const [purchase] = await loadPurchases(db, actor.cooperativeId, [id])
  if (!purchase) throw new DomainError("PURCHASE_NOT_FOUND")
  return purchase
}

export type CreatePurchaseInput = {
  supplierId: string
  purchasedOn: string
  items: ItemInput[]
  paymentMethod: "cash" | "pix"
  paidOn?: string | null
  note?: string
}

export async function createPurchase(db: DbClient, actor: Actor, input: CreatePurchaseInput) {
  if (input.items.length === 0) throw new DomainError("PURCHASE_NO_ITEMS")
  if (input.purchasedOn > todayIso(actor.timezone)) throw new DomainError("VALIDATION", "A data da compra não pode ser futura.")
  await assertPeriodOpen(db, actor.cooperativeId, input.purchasedOn)

  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.cooperativeId, actor.cooperativeId), eq(suppliers.id, input.supplierId), eq(suppliers.active, true)))
    .limit(1)
  if (!supplier) throw new DomainError("PURCHASE_REFERENCE_NOT_FOUND")
  const materialIds = [...new Set(input.items.map((i) => i.materialTypeId))]
  const found = await db
    .select({ id: materialTypes.id })
    .from(materialTypes)
    .where(and(eq(materialTypes.cooperativeId, actor.cooperativeId), inArray(materialTypes.id, materialIds)))
  if (found.length !== materialIds.length) throw new DomainError("PURCHASE_REFERENCE_NOT_FOUND")

  const computed = computeItems(input.items)

  const purchaseId = await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(purchases)
      .values({
        cooperativeId: actor.cooperativeId,
        supplierId: input.supplierId,
        purchasedOn: input.purchasedOn,
        totalAmount: computed.totalAmount,
        totalWeightKg: computed.totalWeightKg,
        paymentMethod: input.paymentMethod,
        paidOn: input.paidOn ?? null,
        note: input.note?.trim() || null,
        createdBy: actor.userId,
      })
      .returning({ id: purchases.id })
    if (!purchase) throw new Error("purchase insert returned nothing")
    await tx.insert(purchaseItems).values(
      computed.items.map((item) => ({
        purchaseId: purchase.id,
        materialTypeId: item.materialTypeId,
        condition: item.condition,
        weightKg: item.weightKg,
        pricePerKg: item.pricePerKg,
        subtotal: item.subtotal,
        position: item.position,
      })),
    )
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "purchases", entityId: purchase.id, after: { ...input, ...computed } })
    return purchase.id
  })

  return getPurchase(db, actor, purchaseId)
}

export async function deletePurchase(db: DbClient, actor: Actor, id: string, reason?: string) {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.cooperativeId, actor.cooperativeId), eq(purchases.id, id), isNull(purchases.deletedAt)))
    .limit(1)
  if (!purchase) throw new DomainError("PURCHASE_NOT_FOUND")
  await assertPeriodOpen(db, actor.cooperativeId, purchase.purchasedOn)
  await db.transaction(async (tx) => {
    await tx.update(purchases).set({ deletedAt: nowIso() }).where(eq(purchases.id, id))
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "delete", entity: "purchases", entityId: id, before: purchase, after: { reason: reason ?? null } })
  })
  return { ok: true as const }
}
