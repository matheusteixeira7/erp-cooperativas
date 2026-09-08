import type { Metadata } from "next"

import { SalesScreen } from "@/components/screens/sales-screen"

export const metadata: Metadata = { title: "Vendas" }

export default function Page() {
  return <SalesScreen />
}
