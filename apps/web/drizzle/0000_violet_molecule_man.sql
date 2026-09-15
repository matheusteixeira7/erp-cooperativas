CREATE TYPE "public"."advance_kind" AS ENUM('cash_advance', 'purchase', 'carry_over', 'other');--> statement-breakpoint
CREATE TYPE "public"."advance_status" AS ENUM('pending', 'deducted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'close', 'reopen', 'login', 'logout', 'export');--> statement-breakpoint
CREATE TYPE "public"."material_category" AS ENUM('plastic', 'paper', 'metal', 'glass', 'waste', 'other');--> statement-breakpoint
CREATE TYPE "public"."material_condition" AS ENUM('loose', 'baled');--> statement-breakpoint
CREATE TYPE "public"."negative_balance_policy" AS ENUM('carry_over', 'forgive');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'pix');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('manager', 'operator', 'member');--> statement-breakpoint
CREATE TYPE "public"."supplier_kind" AS ENUM('individual', 'company');--> statement-breakpoint
CREATE TABLE "advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "advance_kind" DEFAULT 'cash_advance' NOT NULL,
	"description" varchar(200) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"granted_on" date NOT NULL,
	"status" "advance_status" DEFAULT 'pending' NOT NULL,
	"deducted_in_payout_id" uuid,
	"origin_advance_id" uuid,
	"generated_by_payout_id" uuid,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"present" boolean DEFAULT true NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_id" varchar(60) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"cnpj" varchar(14),
	"contact" varchar(200),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooperatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"trade_name" varchar(200),
	"cnpj" varchar(14),
	"timezone" varchar(64) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cooperatives_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"description" varchar(200) NOT NULL,
	"category" varchar(50),
	"amount" numeric(12, 2) NOT NULL,
	"incurred_on" date NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" "material_category" NOT NULL,
	"default_condition" "material_condition" DEFAULT 'baled' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"cpf" varchar(11) NOT NULL,
	"pix_key" varchar(77),
	"phone" varchar(20),
	"admitted_on" date NOT NULL,
	"left_on" date,
	"inss_withheld" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name_snapshot" varchar(200) NOT NULL,
	"member_cpf_snapshot" varchar(11) NOT NULL,
	"worked_days" integer NOT NULL,
	"gross_amount" numeric(12, 2) NOT NULL,
	"inss_base" numeric(12, 2) DEFAULT 0 NOT NULL,
	"inss_rate" numeric(5, 4) DEFAULT 0 NOT NULL,
	"inss_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"deductions_amount" numeric(12, 2) NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"carry_over_debt" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payout_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"legal_reserve_rate" numeric(5, 4) DEFAULT 0.1 NOT NULL,
	"fates_rate" numeric(5, 4) DEFAULT 0.05 NOT NULL,
	"other_funds_rate" numeric(5, 4) DEFAULT 0 NOT NULL,
	"inss_rate" numeric(5, 4) DEFAULT 0.075 NOT NULL,
	"negative_balance_policy" "negative_balance_policy" DEFAULT 'carry_over' NOT NULL,
	"include_members_left_in_period" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_by_name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"period" date NOT NULL,
	"status" "payout_status" DEFAULT 'closed' NOT NULL,
	"gross_revenue" numeric(12, 2) NOT NULL,
	"total_purchases" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_expenses" numeric(12, 2) NOT NULL,
	"surplus" numeric(12, 2) NOT NULL,
	"legal_reserve_amount" numeric(12, 2) NOT NULL,
	"fates_amount" numeric(12, 2) NOT NULL,
	"other_funds_amount" numeric(12, 2) NOT NULL,
	"distributable_surplus" numeric(12, 2) NOT NULL,
	"total_worked_days" integer NOT NULL,
	"day_value" numeric(12, 2) NOT NULL,
	"distributed_total" numeric(12, 2) NOT NULL,
	"rounding_residual" numeric(12, 2) NOT NULL,
	"inss_total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_deductions" numeric(12, 2) NOT NULL,
	"total_net" numeric(12, 2) NOT NULL,
	"settings_snapshot" jsonb NOT NULL,
	"closed_by" uuid,
	"closed_by_name" varchar(200) NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reopened_by" uuid,
	"reopened_by_name" varchar(200),
	"reopened_at" timestamp with time zone,
	"reopen_reason" text
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"material_type_id" uuid NOT NULL,
	"condition" "material_condition" NOT NULL,
	"weight_kg" numeric(10, 2) NOT NULL,
	"price_per_kg" numeric(10, 4) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchased_on" date NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"total_weight_kg" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"paid_on" date,
	"note" text,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"material_type_id" uuid NOT NULL,
	"condition" "material_condition" NOT NULL,
	"weight_kg" numeric(10, 2) NOT NULL,
	"price_per_kg" numeric(10, 4) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"bale_count" integer,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"sold_on" date NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"total_weight_kg" numeric(10, 2) NOT NULL,
	"invoice_number" varchar(50),
	"note" text,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"kind" "supplier_kind" NOT NULL,
	"name" varchar(200) NOT NULL,
	"cpf" varchar(11),
	"cnpj" varchar(14),
	"pix_key" varchar(77),
	"phone" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" varchar(200) NOT NULL,
	"roles" "role"[] NOT NULL,
	"member_id" uuid,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_types" ADD CONSTRAINT "material_types_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_settings" ADD CONSTRAINT "payout_settings_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_settings" ADD CONSTRAINT "payout_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_material_type_id_material_types_id_fk" FOREIGN KEY ("material_type_id") REFERENCES "public"."material_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_material_type_id_material_types_id_fk" FOREIGN KEY ("material_type_id") REFERENCES "public"."material_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advances_cooperative_member_status_idx" ON "advances" USING btree ("cooperative_id","member_id","status");--> statement-breakpoint
CREATE INDEX "advances_cooperative_granted_on_idx" ON "advances" USING btree ("cooperative_id","granted_on");--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_member_date_idx" ON "attendances" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "attendances_cooperative_date_idx" ON "attendances" USING btree ("cooperative_id","date");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("cooperative_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("cooperative_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "buyers_cooperative_name_idx" ON "buyers" USING btree ("cooperative_id","name");--> statement-breakpoint
CREATE INDEX "expenses_cooperative_incurred_on_idx" ON "expenses" USING btree ("cooperative_id","incurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "material_types_cooperative_name_idx" ON "material_types" USING btree ("cooperative_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "members_cooperative_cpf_idx" ON "members" USING btree ("cooperative_id","cpf");--> statement-breakpoint
CREATE INDEX "members_cooperative_left_idx" ON "members" USING btree ("cooperative_id","left_on");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_items_payout_member_idx" ON "payout_items" USING btree ("payout_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_settings_cooperative_effective_idx" ON "payout_settings" USING btree ("cooperative_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_cooperative_period_closed_idx" ON "payouts" USING btree ("cooperative_id","period") WHERE "payouts"."status" = 'closed';--> statement-breakpoint
CREATE INDEX "payouts_cooperative_period_idx" ON "payouts" USING btree ("cooperative_id","period");--> statement-breakpoint
CREATE INDEX "purchase_items_material_condition_idx" ON "purchase_items" USING btree ("material_type_id","condition");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchases_cooperative_purchased_on_idx" ON "purchases" USING btree ("cooperative_id","purchased_on");--> statement-breakpoint
CREATE INDEX "purchases_cooperative_supplier_idx" ON "purchases" USING btree ("cooperative_id","supplier_id");--> statement-breakpoint
CREATE INDEX "sale_items_material_condition_idx" ON "sale_items" USING btree ("material_type_id","condition");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_cooperative_sold_on_idx" ON "sales" USING btree ("cooperative_id","sold_on");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cooperative_cpf_idx" ON "suppliers" USING btree ("cooperative_id","cpf") WHERE "suppliers"."cpf" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cooperative_cnpj_idx" ON "suppliers" USING btree ("cooperative_id","cnpj") WHERE "suppliers"."cnpj" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "suppliers_cooperative_name_idx" ON "suppliers" USING btree ("cooperative_id","name");--> statement-breakpoint
CREATE INDEX "users_cooperative_idx" ON "users" USING btree ("cooperative_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_member_idx" ON "users" USING btree ("member_id") WHERE "users"."member_id" IS NOT NULL;