import type { Metadata } from "next"

import { HomeScreen } from "@/components/screens/home-screen"

export const metadata: Metadata = { title: "Início" }

export default function Page() {
  return <HomeScreen />
}
