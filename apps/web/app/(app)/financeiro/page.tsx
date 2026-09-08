import type { Metadata } from "next"

import { FinanceScreen } from "@/components/screens/finance-screen"

export const metadata: Metadata = { title: "Despesas e vales" }

export default function Page() {
  return <FinanceScreen />
}
