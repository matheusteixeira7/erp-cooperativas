/**
 * Catalogs: material types, buyers and suppliers. Small aggregates that share
 * the same shape of use cases (list + create), grouped in one module.
 */
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { buyers, materialTypes, purchaseItems, purchases, saleItems, sales, suppliers } from "@/server/db/schema"
import type { Actor } from "@/server/modules/shared/actor"
import { maskCpf } from "@/server/modules/shared/schemas"
import { audit } from "@/server/shared/audit"
import { DomainError } from "@/server/shared/errors"

// ---------- material types ----------

export async function listMaterialTypes(db: DbClient, actor: Actor, includeInactive: boolean) {
  const conditions = [eq(materialTypes.cooperativeId, actor.cooperativeId)]
  if (!includeInactive) conditions.push(eq(materialTypes.active, true))
  return db
    .select()
    .from(materialTypes)
    .where(and(...conditions))
    .orderBy(asc(materialTypes.sortOrder), asc(materialTypes.name))
}

export async function createMaterialType(
  db: DbClient,
  actor: Actor,
  input: { name: string; category: (typeof materialTypes.$inferInsert)["category"]; defaultCondition?: "loose" | "baled" },
) {
  const existing = await db
    .select({ id: materialTypes.id })
    .from(materialTypes)
    .where(and(eq(materialTypes.cooperativeId, actor.cooperativeId), ilike(materialTypes.name, input.name.trim())))
    .limit(1)
  if (existing.length > 0) throw new DomainError("MATERIAL_NAME_TAKEN")
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${materialTypes.sortOrder}), 0)` })
    .from(materialTypes)
    .where(eq(materialTypes.cooperativeId, actor.cooperativeId))
  const [row] = await db
    .insert(materialTypes)
    .values({
      cooperativeId: actor.cooperativeId,
      name: input.name.trim(),
      category: input.category,
      defaultCondition: input.defaultCondition ?? "baled",
      sortOrder: Number(maxRow?.max ?? 0) + 1,
    })
    .returning()
  if (!row) throw new Error("material type insert returned nothing")
  await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "material_types", entityId: row.id, after: row })
  return row
}

/** RN-030 / API-materialTypes-lastPrice: last price with the same buyer or supplier for material + condition. */
export async function lastPrice(
  db: DbClient,
  actor: Actor,
  input: { materialTypeId: string; condition: "loose" | "baled"; buyerId?: string; supplierId?: string },
) {
  if (input.buyerId) {
    const rows = await db
      .select({ pricePerKg: saleItems.pricePerKg, on: sales.soldOn })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(
        and(
          eq(sales.cooperativeId, actor.cooperativeId),
          eq(sales.buyerId, input.buyerId),
          sql`${sales.deletedAt} is null`,
          eq(saleItems.materialTypeId, input.materialTypeId),
          eq(saleItems.condition, input.condition),
        ),
      )
      .orderBy(desc(sales.soldOn), desc(sales.createdAt))
      .limit(1)
    return rows[0] ?? null
  }
  if (input.supplierId) {
    const rows = await db
      .select({ pricePerKg: purchaseItems.pricePerKg, on: purchases.purchasedOn })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
      .where(
        and(
          eq(purchases.cooperativeId, actor.cooperativeId),
          eq(purchases.supplierId, input.supplierId),
          sql`${purchases.deletedAt} is null`,
          eq(purchaseItems.materialTypeId, input.materialTypeId),
          eq(purchaseItems.condition, input.condition),
        ),
      )
      .orderBy(desc(purchases.purchasedOn), desc(purchases.createdAt))
      .limit(1)
    return rows[0] ?? null
  }
  return null
}

// ---------- buyers ----------

export async function listBuyers(db: DbClient, actor: Actor, input: { search?: string; includeInactive?: boolean }) {
  const conditions = [eq(buyers.cooperativeId, actor.cooperativeId)]
  if (!input.includeInactive) conditions.push(eq(buyers.active, true))
  if (input.search) conditions.push(ilike(buyers.name, `%${input.search.trim()}%`))
  const rows = await db
    .select()
    .from(buyers)
    .where(and(...conditions))
    .orderBy(asc(buyers.name))
  return rows.map((b) => ({ id: b.id, name: b.name, cnpj: b.cnpj ?? "", contact: b.contact ?? "", active: b.active }))
}

export async function createBuyer(db: DbClient, actor: Actor, input: { name: string; cnpj?: string; contact?: string }) {
  const name = input.name.trim()
  const existing = await db
    .select({ id: buyers.id })
    .from(buyers)
    .where(and(eq(buyers.cooperativeId, actor.cooperativeId), ilike(buyers.name, name)))
    .limit(1)
  if (existing.length > 0) throw new DomainError("BUYER_NAME_TAKEN")
  const [row] = await db
    .insert(buyers)
    .values({ cooperativeId: actor.cooperativeId, name, cnpj: input.cnpj || null, contact: input.contact?.trim() || null })
    .returning()
  if (!row) throw new Error("buyer insert returned nothing")
  await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "buyers", entityId: row.id, after: row })
  return { id: row.id, name: row.name, cnpj: row.cnpj ?? "", contact: row.contact ?? "", active: row.active }
}

// ---------- suppliers ----------

export type SupplierDto = {
  id: string
  kind: "individual" | "company"
  name: string
  cpfMasked: string | null
  cnpj: string
  pixKey: string | null
  phone: string
  active: boolean
  /** "CPF ***.456.789-**", "CNPJ 12345678000190" or the kind label fallback handled by the UI. */
  document: string | null
}

export function toSupplierDto(row: typeof suppliers.$inferSelect, manager: boolean): SupplierDto {
  const cpfMasked = maskCpf(row.cpf)
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    cpfMasked,
    cnpj: row.cnpj ?? "",
    pixKey: manager ? (row.pixKey ?? "") : null,
    phone: row.phone ?? "",
    active: row.active,
    document: row.kind === "company" ? (row.cnpj ? `CNPJ ${row.cnpj}` : null) : cpfMasked ? `CPF ${cpfMasked}` : null,
  }
}

export async function listSuppliers(
  db: DbClient,
  actor: Actor,
  input: { search?: string; kind?: "individual" | "company"; includeInactive?: boolean },
) {
  const conditions = [eq(suppliers.cooperativeId, actor.cooperativeId)]
  if (!input.includeInactive) conditions.push(eq(suppliers.active, true))
  if (input.kind) conditions.push(eq(suppliers.kind, input.kind))
  if (input.search) {
    const digits = input.search.replace(/\D/g, "")
    const term = `%${input.search.trim()}%`
    conditions.push(digits.length >= 3 ? or(ilike(suppliers.name, term), ilike(suppliers.cpf, `%${digits}%`), ilike(suppliers.cnpj, `%${digits}%`))! : ilike(suppliers.name, term))
  }
  const rows = await db
    .select()
    .from(suppliers)
    .where(and(...conditions))
    .orderBy(asc(suppliers.name))
  const manager = actor.roles.includes("manager")
  return rows.map((row) => toSupplierDto(row, manager))
}

export async function createSupplier(
  db: DbClient,
  actor: Actor,
  input: { kind: "individual" | "company"; name: string; cpf?: string; cnpj?: string; pixKey?: string; phone?: string },
) {
  const cpf = input.kind === "individual" && input.cpf ? input.cpf : null
  const cnpj = input.kind === "company" ? (input.cnpj ?? null) : null
  if (input.kind === "company" && !cnpj) throw new DomainError("VALIDATION", "Informe o CNPJ da empresa.")

  // Same document already registered: return the existing supplier instead of duplicating (API-suppliers-create).
  if (cpf || cnpj) {
    const existing = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.cooperativeId, actor.cooperativeId), cpf ? eq(suppliers.cpf, cpf) : eq(suppliers.cnpj, cnpj!)))
      .limit(1)
    if (existing[0]) return toSupplierDto(existing[0], actor.roles.includes("manager"))
  }

  const [row] = await db
    .insert(suppliers)
    .values({
      cooperativeId: actor.cooperativeId,
      kind: input.kind,
      name: input.name.trim(),
      cpf,
      cnpj,
      pixKey: input.pixKey?.trim() || null,
      phone: input.phone || null,
      createdBy: actor.userId,
    })
    .returning()
  if (!row) throw new Error("supplier insert returned nothing")
  await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "suppliers", entityId: row.id, after: row })
  return toSupplierDto(row, actor.roles.includes("manager"))
}
