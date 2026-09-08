import type { Metadata } from "next"

import { PayoutScreen } from "@/components/screens/payout-screen"

export const metadata: Metadata = { title: "Fechamento" }

export default function Page() {
  return <PayoutScreen />
}
