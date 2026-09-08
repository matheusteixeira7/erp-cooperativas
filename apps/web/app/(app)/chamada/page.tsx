import type { Metadata } from "next"

import { AttendanceScreen } from "@/components/screens/attendance-screen"

export const metadata: Metadata = { title: "Chamada" }

export default function Page() {
  return <AttendanceScreen />
}
