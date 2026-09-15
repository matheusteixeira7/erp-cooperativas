/**
 * RN-015: totals are computed on the server from weight × price, never taken
 * from the client. Shared by sales and purchases.
 */
import { itemSubtotal, toCents, fromCents } from "@/lib/domain/payout"

export type ItemInput = { materialTypeId: string; condition: "loose" | "baled"; weightKg: number; pricePerKg: number; baleCount?: number | null }

export function computeItems(items: ItemInput[]) {
  const computed = items.map((item, index) => ({
    materialTypeId: item.materialTypeId,
    condition: item.condition,
    weightKg: Math.round(item.weightKg * 100) / 100,
    pricePerKg: Math.round(item.pricePerKg * 10000) / 10000,
    subtotal: itemSubtotal(item.weightKg, item.pricePerKg),
    baleCount: item.baleCount ?? null,
    position: index,
  }))
  const totalAmount = fromCents(computed.reduce((sum, i) => sum + toCents(i.subtotal), 0))
  const totalWeightKg = Math.round(computed.reduce((sum, i) => sum + i.weightKg, 0) * 100) / 100
  return { items: computed, totalAmount, totalWeightKg }
}

export type Cursor = { on: string; createdAt: string; id: string }

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>
    if (typeof parsed.on === "string" && typeof parsed.createdAt === "string" && typeof parsed.id === "string") return parsed as Cursor
    return null
  } catch {
    return null
  }
}
