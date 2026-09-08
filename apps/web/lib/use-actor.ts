"use client"

import { useRequiredSession } from "@/lib/demo/session"

/** Who is performing a mutation (created_by / closed_by). */
export function useActor() {
  const { session } = useRequiredSession()
  return { userId: session.userId, name: session.name }
}
