import type { Metadata } from "next"

import { StatementScreen } from "@/components/screens/statement-screen"

export const metadata: Metadata = { title: "Meu extrato" }

export default function Page() {
  return <StatementScreen />
}
