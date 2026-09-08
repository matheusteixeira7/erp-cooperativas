import type { Metadata } from "next"

import { PayoutHistoryScreen } from "@/components/screens/payout-history-screen"

export const metadata: Metadata = { title: "Histórico de fechamentos" }

export default function Page() {
  return <PayoutHistoryScreen />
}
