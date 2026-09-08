import type { Metadata } from "next"

import { PayoutSettingsScreen } from "@/components/screens/payout-settings-screen"

export const metadata: Metadata = { title: "Parâmetros de rateio" }

export default function Page() {
  return <PayoutSettingsScreen />
}
