import { createTRPCRouter } from "./init"
import { attendanceRouter } from "./routers/attendance"
import { authRouter } from "./routers/auth"
import { buyersRouter, materialTypesRouter, suppliersRouter } from "./routers/catalog"
import { dashboardRouter } from "./routers/dashboard"
import { advancesRouter, expensesRouter } from "./routers/finance"
import { membersRouter } from "./routers/members"
import { payoutSettingsRouter } from "./routers/payout-settings"
import { payoutsRouter } from "./routers/payouts"
import { purchasesRouter } from "./routers/purchases"
import { salesRouter } from "./routers/sales"
import { systemRouter } from "./routers/system"

export const appRouter = createTRPCRouter({
  system: systemRouter,
  auth: authRouter,
  members: membersRouter,
  attendance: attendanceRouter,
  materialTypes: materialTypesRouter,
  buyers: buyersRouter,
  suppliers: suppliersRouter,
  sales: salesRouter,
  purchases: purchasesRouter,
  expenses: expensesRouter,
  advances: advancesRouter,
  payoutSettings: payoutSettingsRouter,
  payouts: payoutsRouter,
  dashboard: dashboardRouter,
})

export type AppRouter = typeof appRouter
