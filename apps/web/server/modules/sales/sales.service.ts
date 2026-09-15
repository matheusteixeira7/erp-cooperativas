/**
 * Sales (RN-011, RN-015, RN-016, RN-022, RN-030).
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { buyers, materialTypes, saleItems, sales } from "@/server/db/schema"
import type { Actor } from "@/server/modules/shared/actor"
import { computeItems, decodeCursor, encodeCursor, type ItemInput } from "@/server/modules/shared/items"
import { assertPeriodOpen, periodStatus } from "@/server/modules/shared/period-lock"
import { audit } from "@/server/shared/audit"
import { firstDayOf, lastDayOf, nowIso, todayIso } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"

export type SaleDto = {
  id: string
  buyerId: string
  buyerName: string
  soldOn: string
  totalAmount: number
  totalWeightKg: number
  invoiceNumber: string
  note: string
  createdAt: string
  items: { id: string; materialTypeId: string; materialTypeName: string; condition: "loose" | "baled"; weightKg: number; pricePerKg: number; subtotal: number }[]
}

async function loadSales(db: DbClient, cooperativeId: string, ids: string[]): Promise<SaleDto[]> {
  if (ids.length === 0) return []
  const rows = await db.query.sales.findMany({
    where: and(eq(sales.cooperativeId, cooperativeId), inArray(sales.id, ids)),
    with: { buyer: true, items: { with: { materialType: true }, orderBy: asc(saleItems.position) } },
  })
  const byId = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        buyerId: row.buyerId,
        buyerName: row.buyer.name,
        soldOn: row.soldOn,
        totalAmount: row.totalAmount,
        totalWeightKg: row.totalWeightKg,
        invoiceNumber: row.invoiceNumber ?? "",
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
      } satisfies SaleDto,
    ]),
  )
  return ids.map((id) => byId.get(id)).filter((s): s is SaleDto => Boolean(s))
}

export type ListSalesInput = { period?: string; buyerId?: string; materialTypeId?: string; cursor?: string | null; limit: number }

export async function listSales(db: DbClient, actor: Actor, input: ListSalesInput) {
  const conditions = [eq(sales.cooperativeId, actor.cooperativeId), isNull(sales.deletedAt)]
  if (input.period) conditions.push(gte(sales.soldOn, firstDayOf(input.period)), lte(sales.soldOn, lastDayOf(input.period)))
  if (input.buyerId) conditions.push(eq(sales.buyerId, input.buyerId))
  if (input.materialTypeId) {
    conditions.push(sql`exists(select 1 from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.materialTypeId} = ${input.materialTypeId})`)
  }
  const where = and(...conditions)

  const pageConditions = [where]
  const cursor = decodeCursor(input.cursor)
  if (cursor) pageConditions.push(sql`(${sales.soldOn}, ${sales.createdAt}, ${sales.id}) < (${cursor.on}::date, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`)

  const [page, totals, byMaterial, status] = await Promise.all([
    db
      .select({ id: sales.id, soldOn: sales.soldOn, createdAt: sales.createdAt })
      .from(sales)
      .where(and(...pageConditions))
      .orderBy(desc(sales.soldOn), desc(sales.createdAt), desc(sales.id))
      .limit(input.limit + 1),
    db
      .select({ amount: sql<number>`coalesce(sum(${sales.totalAmount}), 0)::float8`, weightKg: sql<number>`coalesce(sum(${sales.totalWeightKg}), 0)::float8`, count: sql<number>`count(*)::int` })
      .from(sales)
      .where(where),
    db
      .select({
        materialTypeId: saleItems.materialTypeId,
        materialTypeName: materialTypes.name,
        condition: saleItems.condition,
        amount: sql<number>`sum(${saleItems.subtotal})::float8`,
        weightKg: sql<number>`sum(${saleItems.weightKg})::float8`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(materialTypes, eq(materialTypes.id, saleItems.materialTypeId))
      .where(where)
      .groupBy(saleItems.materialTypeId, materialTypes.name, saleItems.condition)
      .orderBy(desc(sql`sum(${saleItems.subtotal})`)),
    input.period ? periodStatus(db, actor.cooperativeId, input.period) : Promise.resolve(null),
  ])

  const hasMore = page.length > input.limit
  const rows = hasMore ? page.slice(0, input.limit) : page
  const last = rows[rows.length - 1]
  const items = await loadSales(db, actor.cooperativeId, rows.map((r) => r.id))

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ on: last.soldOn, createdAt: last.createdAt, id: last.id }) : null,
    totals: { amount: totals[0]?.amount ?? 0, weightKg: totals[0]?.weightKg ?? 0, count: totals[0]?.count ?? 0 },
    byMaterial,
    periodClosed: status?.closed ?? false,
    closedPayoutId: status?.payoutId ?? null,
  }
}

export async function getSale(db: DbClient, actor: Actor, id: string) {
  const [sale] = await loadSales(db, actor.cooperativeId, [id])
  if (!sale) throw new DomainError("SALE_NOT_FOUND")
  return sale
}

export type CreateSaleInput = { buyerId: string; soldOn: string; items: ItemInput[]; invoiceNumber?: string; note?: string }

export async function createSale(db: DbClient, actor: Actor, input: CreateSaleInput) {
  if (input.items.length === 0) throw new DomainError("SALE_NO_ITEMS")
  if (input.soldOn > todayIso(actor.timezone)) throw new DomainError("VALIDATION", "A data da venda não pode ser futura.")
  await assertPeriodOpen(db, actor.cooperativeId, input.soldOn)

  const [buyer] = await db
    .select({ id: buyers.id })
    .from(buyers)
    .where(and(eq(buyers.cooperativeId, actor.cooperativeId), eq(buyers.id, input.buyerId), eq(buyers.active, true)))
    .limit(1)
  if (!buyer) throw new DomainError("REFERENCE_NOT_FOUND")
  const materialIds = [...new Set(input.items.map((i) => i.materialTypeId))]
  const found = await db
    .select({ id: materialTypes.id })
    .from(materialTypes)
    .where(and(eq(materialTypes.cooperativeId, actor.cooperativeId), inArray(materialTypes.id, materialIds)))
  if (found.length !== materialIds.length) throw new DomainError("REFERENCE_NOT_FOUND")

  const computed = computeItems(input.items)

  const saleId = await db.transaction(async (tx) => {
    const [sale] = await tx
      .insert(sales)
      .values({
        cooperativeId: actor.cooperativeId,
        buyerId: input.buyerId,
        soldOn: input.soldOn,
        totalAmount: computed.totalAmount,
        totalWeightKg: computed.totalWeightKg,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        note: input.note?.trim() || null,
        createdBy: actor.userId,
      })
      .returning({ id: sales.id })
    if (!sale) throw new Error("sale insert returned nothing")
    await tx.insert(saleItems).values(computed.items.map((item) => ({ ...item, saleId: sale.id })))
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "sales", entityId: sale.id, after: { ...input, ...computed } })
    return sale.id
  })

  return getSale(db, actor, saleId)
}

export async function deleteSale(db: DbClient, actor: Actor, id: string, reason?: string) {
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.cooperativeId, actor.cooperativeId), eq(sales.id, id), isNull(sales.deletedAt)))
    .limit(1)
  if (!sale) throw new DomainError("SALE_NOT_FOUND")
  await assertPeriodOpen(db, actor.cooperativeId, sale.soldOn)
  await db.transaction(async (tx) => {
    await tx.update(sales).set({ deletedAt: nowIso() }).where(eq(sales.id, id))
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "delete", entity: "sales", entityId: id, before: sale, after: { reason: reason ?? null } })
  })
  return { ok: true as const }
}
