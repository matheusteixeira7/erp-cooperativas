import type { Metadata } from "next"

import { MembersScreen } from "@/components/screens/members-screen"

export const metadata: Metadata = { title: "Cooperados" }

export default function Page() {
  return <MembersScreen />
}
