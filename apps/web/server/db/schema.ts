/**
 * Drizzle schema. One table per spec entity (estudo/spec/20-entidades).
 * Every business table carries cooperative_id (DEC-005); repositories always
 * filter by it using the tenant from the session, never from the client.
 */
import { relations, sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// ---------- enums (10-tipos/enums.json) ----------

export const roleEnum = pgEnum("role", ["manager", "operator", "member"])
export const materialCategoryEnum = pgEnum("material_category", ["plastic", "paper", "metal", "glass", "waste", "other"])
export const materialConditionEnum = pgEnum("material_condition", ["loose", "baled"])
export const supplierKindEnum = pgEnum("supplier_kind", ["individual", "company"])
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "pix"])
export const advanceKindEnum = pgEnum("advance_kind", ["cash_advance", "purchase", "carry_over", "other"])
export const advanceStatusEnum = pgEnum("advance_status", ["pending", "deducted", "cancelled"])
export const payoutStatusEnum = pgEnum("payout_status", ["closed", "reopened"])
export const negativeBalancePolicyEnum = pgEnum("negative_balance_policy", ["carry_over", "forgive"])
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "close", "reopen", "login", "logout", "export"])

// ---------- helpers ----------

const id = () => uuid("id").primaryKey().defaultRandom()
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date().toISOString())
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" })
const weight = (name: string) => numeric(name, { precision: 10, scale: 2, mode: "number" })
const pricePerKg = (name: string) => numeric(name, { precision: 10, scale: 4, mode: "number" })
const fraction = (name: string) => numeric(name, { precision: 5, scale: 4, mode: "number" })
const localDate = (name: string) => date(name, { mode: "string" })
const cooperativeId = () =>
  uuid("cooperative_id")
    .notNull()
    .references(() => cooperatives.id)

// ---------- tenant, users, sessions ----------

export const cooperatives = pgTable("cooperatives", {
  id: id(),
  legalName: varchar("legal_name", { length: 200 }).notNull(),
  tradeName: varchar("trade_name", { length: 200 }),
  cnpj: varchar("cnpj", { length: 14 }).unique(),
  timezone: varchar("timezone", { length: 64 }).notNull().default("America/Sao_Paulo"),
  createdAt: createdAt(),
})

export const users = pgTable(
  "users",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    roles: roleEnum("roles").array().notNull(),
    memberId: uuid("member_id"),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_cooperative_idx").on(t.cooperativeId), uniqueIndex("users_member_idx").on(t.memberId).where(sql`${t.memberId} IS NOT NULL`)],
)

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
)

// ---------- members ----------

export const members = pgTable(
  "members",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    name: varchar("name", { length: 200 }).notNull(),
    cpf: varchar("cpf", { length: 11 }).notNull(),
    pixKey: varchar("pix_key", { length: 77 }),
    phone: varchar("phone", { length: 20 }),
    admittedOn: localDate("admitted_on").notNull(),
    leftOn: localDate("left_on"),
    inssWithheld: boolean("inss_withheld").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("members_cooperative_cpf_idx").on(t.cooperativeId, t.cpf), index("members_cooperative_left_idx").on(t.cooperativeId, t.leftOn)],
)

// ---------- catalogs ----------

export const materialTypes = pgTable(
  "material_types",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    name: varchar("name", { length: 200 }).notNull(),
    category: materialCategoryEnum("category").notNull(),
    defaultCondition: materialConditionEnum("default_condition").notNull().default("baled"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("material_types_cooperative_name_idx").on(t.cooperativeId, t.name)],
)

export const buyers = pgTable(
  "buyers",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    name: varchar("name", { length: 200 }).notNull(),
    cnpj: varchar("cnpj", { length: 14 }),
    contact: varchar("contact", { length: 200 }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("buyers_cooperative_name_idx").on(t.cooperativeId, t.name)],
)

export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    kind: supplierKindEnum("kind").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    cpf: varchar("cpf", { length: 11 }),
    cnpj: varchar("cnpj", { length: 14 }),
    pixKey: varchar("pix_key", { length: 77 }),
    phone: varchar("phone", { length: 20 }),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("suppliers_cooperative_cpf_idx").on(t.cooperativeId, t.cpf).where(sql`${t.cpf} IS NOT NULL`),
    uniqueIndex("suppliers_cooperative_cnpj_idx").on(t.cooperativeId, t.cnpj).where(sql`${t.cnpj} IS NOT NULL`),
    index("suppliers_cooperative_name_idx").on(t.cooperativeId, t.name),
  ],
)

// ---------- sales ----------

export const sales = pgTable(
  "sales",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => buyers.id),
    soldOn: localDate("sold_on").notNull(),
    totalAmount: money("total_amount").notNull(),
    totalWeightKg: weight("total_weight_kg").notNull(),
    invoiceNumber: varchar("invoice_number", { length: 50 }),
    note: text("note"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sales_cooperative_sold_on_idx").on(t.cooperativeId, t.soldOn)],
)

export const saleItems = pgTable(
  "sale_items",
  {
    id: id(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    materialTypeId: uuid("material_type_id")
      .notNull()
      .references(() => materialTypes.id),
    condition: materialConditionEnum("condition").notNull(),
    weightKg: weight("weight_kg").notNull(),
    pricePerKg: pricePerKg("price_per_kg").notNull(),
    subtotal: money("subtotal").notNull(),
    baleCount: integer("bale_count"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("sale_items_material_condition_idx").on(t.materialTypeId, t.condition), index("sale_items_sale_idx").on(t.saleId)],
)

// ---------- purchases ----------

export const purchases = pgTable(
  "purchases",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    purchasedOn: localDate("purchased_on").notNull(),
    totalAmount: money("total_amount").notNull(),
    totalWeightKg: weight("total_weight_kg").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    paidOn: localDate("paid_on"),
    note: text("note"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("purchases_cooperative_purchased_on_idx").on(t.cooperativeId, t.purchasedOn), index("purchases_cooperative_supplier_idx").on(t.cooperativeId, t.supplierId)],
)

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: id(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    materialTypeId: uuid("material_type_id")
      .notNull()
      .references(() => materialTypes.id),
    condition: materialConditionEnum("condition").notNull(),
    weightKg: weight("weight_kg").notNull(),
    pricePerKg: pricePerKg("price_per_kg").notNull(),
    subtotal: money("subtotal").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("purchase_items_material_condition_idx").on(t.materialTypeId, t.condition), index("purchase_items_purchase_idx").on(t.purchaseId)],
)

// ---------- expenses, advances, attendance ----------

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    description: varchar("description", { length: 200 }).notNull(),
    category: varchar("category", { length: 50 }),
    amount: money("amount").notNull(),
    incurredOn: localDate("incurred_on").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("expenses_cooperative_incurred_on_idx").on(t.cooperativeId, t.incurredOn)],
)

export const advances = pgTable(
  "advances",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    kind: advanceKindEnum("kind").notNull().default("cash_advance"),
    description: varchar("description", { length: 200 }).notNull(),
    amount: money("amount").notNull(),
    grantedOn: localDate("granted_on").notNull(),
    status: advanceStatusEnum("status").notNull().default("pending"),
    deductedInPayoutId: uuid("deducted_in_payout_id"),
    originAdvanceId: uuid("origin_advance_id"),
    generatedByPayoutId: uuid("generated_by_payout_id"),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("advances_cooperative_member_status_idx").on(t.cooperativeId, t.memberId, t.status), index("advances_cooperative_granted_on_idx").on(t.cooperativeId, t.grantedOn)],
)

export const attendances = pgTable(
  "attendances",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    date: localDate("date").notNull(),
    present: boolean("present").notNull().default(true),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("attendances_member_date_idx").on(t.memberId, t.date), index("attendances_cooperative_date_idx").on(t.cooperativeId, t.date)],
)

// ---------- payout settings and payouts ----------

export const payoutSettings = pgTable(
  "payout_settings",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    /** First day of the month the version applies from (TP-MesAno stored as date). */
    effectiveFrom: localDate("effective_from").notNull(),
    legalReserveRate: fraction("legal_reserve_rate").notNull().default(0.1),
    fatesRate: fraction("fates_rate").notNull().default(0.05),
    otherFundsRate: fraction("other_funds_rate").notNull().default(0),
    inssRate: fraction("inss_rate").notNull().default(0.075),
    negativeBalancePolicy: negativeBalancePolicyEnum("negative_balance_policy").notNull().default("carry_over"),
    includeMembersLeftInPeriod: boolean("include_members_left_in_period").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdByName: varchar("created_by_name", { length: 200 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payout_settings_cooperative_effective_idx").on(t.cooperativeId, t.effectiveFrom)],
)

export type PayoutSettingsSnapshot = {
  id: string | null
  effectiveFrom: string
  legalReserveRate: number
  fatesRate: number
  otherFundsRate: number
  inssRate: number
  negativeBalancePolicy: "carry_over" | "forgive"
  includeMembersLeftInPeriod: boolean
  isLegalDefault: boolean
}

export const payouts = pgTable(
  "payouts",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    /** First day of the month (TP-MesAno stored as date). */
    period: localDate("period").notNull(),
    status: payoutStatusEnum("status").notNull().default("closed"),
    grossRevenue: money("gross_revenue").notNull(),
    totalPurchases: money("total_purchases").notNull().default(0),
    totalExpenses: money("total_expenses").notNull(),
    surplus: money("surplus").notNull(),
    legalReserveAmount: money("legal_reserve_amount").notNull(),
    fatesAmount: money("fates_amount").notNull(),
    otherFundsAmount: money("other_funds_amount").notNull(),
    distributableSurplus: money("distributable_surplus").notNull(),
    totalWorkedDays: integer("total_worked_days").notNull(),
    dayValue: money("day_value").notNull(),
    distributedTotal: money("distributed_total").notNull(),
    roundingResidual: money("rounding_residual").notNull(),
    inssTotal: money("inss_total").notNull().default(0),
    totalDeductions: money("total_deductions").notNull(),
    totalNet: money("total_net").notNull(),
    settingsSnapshot: jsonb("settings_snapshot").notNull().$type<PayoutSettingsSnapshot>(),
    closedBy: uuid("closed_by").references(() => users.id),
    closedByName: varchar("closed_by_name", { length: 200 }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    reopenedBy: uuid("reopened_by").references(() => users.id),
    reopenedByName: varchar("reopened_by_name", { length: 200 }),
    reopenedAt: timestamp("reopened_at", { withTimezone: true, mode: "string" }),
    reopenReason: text("reopen_reason"),
  },
  (t) => [
    uniqueIndex("payouts_cooperative_period_closed_idx").on(t.cooperativeId, t.period).where(sql`${t.status} = 'closed'`),
    index("payouts_cooperative_period_idx").on(t.cooperativeId, t.period),
  ],
)

export const payoutItems = pgTable(
  "payout_items",
  {
    id: id(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payouts.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    memberNameSnapshot: varchar("member_name_snapshot", { length: 200 }).notNull(),
    memberCpfSnapshot: varchar("member_cpf_snapshot", { length: 11 }).notNull(),
    workedDays: integer("worked_days").notNull(),
    grossAmount: money("gross_amount").notNull(),
    inssBase: money("inss_base").notNull().default(0),
    inssRate: fraction("inss_rate").notNull().default(0),
    inssAmount: money("inss_amount").notNull().default(0),
    deductionsAmount: money("deductions_amount").notNull(),
    netAmount: money("net_amount").notNull(),
    carryOverDebt: money("carry_over_debt").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [uniqueIndex("payout_items_payout_member_idx").on(t.payoutId, t.memberId)],
)

// ---------- audit ----------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    cooperativeId: cooperativeId(),
    userId: uuid("user_id").references(() => users.id),
    action: auditActionEnum("action").notNull(),
    entity: varchar("entity", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 60 }).notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.cooperativeId, t.entity, t.entityId), index("audit_logs_created_idx").on(t.cooperativeId, t.createdAt)],
)

// ---------- relations (used by the relational query API) ----------

export const salesRelations = relations(sales, ({ many, one }) => ({
  items: many(saleItems),
  buyer: one(buyers, { fields: [sales.buyerId], references: [buyers.id] }),
}))

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  materialType: one(materialTypes, { fields: [saleItems.materialTypeId], references: [materialTypes.id] }),
}))

export const purchasesRelations = relations(purchases, ({ many, one }) => ({
  items: many(purchaseItems),
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
}))

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchaseId], references: [purchases.id] }),
  materialType: one(materialTypes, { fields: [purchaseItems.materialTypeId], references: [materialTypes.id] }),
}))

export const payoutsRelations = relations(payouts, ({ many }) => ({
  items: many(payoutItems),
}))

export const payoutItemsRelations = relations(payoutItems, ({ one }) => ({
  payout: one(payouts, { fields: [payoutItems.payoutId], references: [payouts.id] }),
}))

export const advancesRelations = relations(advances, ({ one }) => ({
  member: one(members, { fields: [advances.memberId], references: [members.id] }),
}))
