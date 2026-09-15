"use client"

import { useRequiredSession } from "@/lib/session"

/** Who is looking at the screen. Mutations are attributed on the server from the session. */
export function useActor() {
  const { session } = useRequiredSession()
  return { userId: session.userId, name: session.name, isManager: session.activeRole === "manager" }
}
