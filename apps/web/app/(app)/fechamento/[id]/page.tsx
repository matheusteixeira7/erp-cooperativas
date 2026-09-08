import type { Metadata } from "next"

import { PayoutDetailScreen } from "@/components/screens/payout-detail-screen"

export const metadata: Metadata = { title: "Detalhe do fechamento" }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PayoutDetailScreen id={id} />
}
