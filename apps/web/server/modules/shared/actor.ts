/** Who is calling a use case, derived from the session (never from the input). */
export type Actor = {
  cooperativeId: string
  userId: string
  userName: string
  timezone: string
  roles: ("manager" | "operator" | "member")[]
  memberId: string | null
}

export function actorFromSession(session: {
  user: { id: string; name: string; cooperativeId: string; roles: ("manager" | "operator" | "member")[]; memberId: string | null }
  cooperative: { timezone: string }
}): Actor {
  return {
    cooperativeId: session.user.cooperativeId,
    userId: session.user.id,
    userName: session.user.name,
    timezone: session.cooperative.timezone,
    roles: session.user.roles,
    memberId: session.user.memberId,
  }
}
