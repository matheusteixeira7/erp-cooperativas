/**
 * Members (cooperados) use cases: RN-007, RN-029, PL-003, PL-005.
 */
import { eq } from "drizzle-orm"

import type { DbClient } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { emailExists } from "@/server/modules/auth/auth.repository"
import { audit } from "@/server/shared/audit"
import { todayIso } from "@/server/shared/dates"
import { DomainError } from "@/server/shared/errors"
import { hashPassword } from "@/server/shared/password"

import * as repo from "./members.repository"

import type { Actor } from "@/server/modules/shared/actor"

export type MemberDto = {
  id: string
  name: string
  cpfMasked: string
  /** Full CPF: only in byId for managers (PL-005). */
  cpf: string | null
  pixKey: string | null
  phone: string
  admittedOn: string
  leftOn: string | null
  active: boolean
  inssWithheld: boolean
  notes: string
  hasRecords: boolean
  hasAccess: boolean
  accessEmail: string | null
}

export function toMemberDto(row: repo.MemberWithFlags, options: { today: string; manager: boolean; fullCpf?: boolean }): MemberDto {
  return {
    id: row.id,
    name: row.name,
    cpfMasked: `***.${row.cpf.slice(3, 6)}.${row.cpf.slice(6, 9)}-**`,
    cpf: options.fullCpf ? row.cpf : null,
    pixKey: options.manager ? (row.pixKey ?? "") : null,
    phone: row.phone ?? "",
    admittedOn: row.admittedOn,
    leftOn: row.leftOn,
    active: !row.leftOn || row.leftOn >= options.today,
    inssWithheld: row.inssWithheld,
    notes: row.notes ?? "",
    hasRecords: row.hasRecords,
    hasAccess: row.accessActive,
    accessEmail: row.accessEmail,
  }
}

async function requireMember(db: DbClient, cooperativeId: string, id: string) {
  const member = await repo.findMember(db, cooperativeId, id)
  if (!member) throw new DomainError("MEMBER_NOT_FOUND")
  return member
}

export async function listMembers(
  db: DbClient,
  actor: Actor & { manager: boolean },
  input: { activeOn?: string; includeInactive?: boolean; search?: string },
) {
  const today = todayIso(actor.timezone)
  const rows = await repo.listMembers(db, {
    cooperativeId: actor.cooperativeId,
    activeOn: input.activeOn,
    includeInactive: input.includeInactive ?? false,
    search: input.search,
    today,
  })
  return rows.map((row) => toMemberDto(row, { today, manager: actor.manager }))
}

export async function getMember(db: DbClient, actor: Actor, id: string) {
  const member = await requireMember(db, actor.cooperativeId, id)
  return toMemberDto(member, { today: todayIso(actor.timezone), manager: true, fullCpf: true })
}

export type AccessInput = { email: string; password?: string } | null

export type CreateMemberInput = {
  name: string
  cpf: string
  pixKey: string
  phone: string
  admittedOn?: string
  inssWithheld?: boolean
  notes?: string
  /** Statement access for the member (role "member"). Omit to leave unchanged; null revokes. */
  access?: AccessInput
}

/** Creates/updates/revokes the login linked to a member. */
async function syncAccess(db: DbClient, actor: Actor, memberId: string, memberName: string, access: AccessInput | undefined) {
  if (access === undefined) return
  const existing = await repo.findAccessUser(db, memberId)
  if (access === null) {
    if (existing && existing.active) {
      await db.update(users).set({ active: false }).where(eq(users.id, existing.id))
      await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "users", entityId: existing.id, before: { active: true }, after: { active: false } })
    }
    return
  }
  const email = access.email.trim().toLowerCase()
  if (existing) {
    if (existing.email !== email && (await emailExists(db, email))) throw new DomainError("EMAIL_TAKEN")
    await db
      .update(users)
      .set({
        email,
        name: memberName,
        active: true,
        ...(access.password ? { passwordHash: await hashPassword(access.password) } : {}),
      })
      .where(eq(users.id, existing.id))
    return
  }
  if (!access.password) throw new DomainError("VALIDATION", "Informe uma senha para criar o acesso do cooperado.")
  if (await emailExists(db, email)) throw new DomainError("EMAIL_TAKEN")
  const [created] = await db
    .insert(users)
    .values({ cooperativeId: actor.cooperativeId, email, name: memberName, roles: ["member"], memberId, passwordHash: await hashPassword(access.password) })
    .returning()
  if (created) {
    await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "users", entityId: created.id, after: { email, memberId } })
  }
}

export async function createMember(db: DbClient, actor: Actor, input: CreateMemberInput) {
  const today = todayIso(actor.timezone)
  const admittedOn = input.admittedOn ?? today
  if (admittedOn > today) throw new DomainError("VALIDATION", "A admissão não pode ser futura.")
  if (await repo.cpfTaken(db, actor.cooperativeId, input.cpf)) throw new DomainError("MEMBER_CPF_TAKEN")

  return db.transaction(async (tx) => {
    const row = await repo.insertMember(tx, {
      cooperativeId: actor.cooperativeId,
      name: input.name.trim(),
      cpf: input.cpf,
      pixKey: input.pixKey.trim() || null,
      phone: input.phone || null,
      admittedOn,
      inssWithheld: input.inssWithheld ?? true,
      notes: input.notes?.trim() || null,
    })
    await syncAccess(tx, actor, row.id, row.name, input.access)
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "create", entity: "members", entityId: row.id, after: row })
    return getMember(tx, actor, row.id)
  })
}

export type UpdateMemberInput = {
  name?: string
  pixKey?: string
  phone?: string
  admittedOn?: string
  inssWithheld?: boolean
  notes?: string
  access?: AccessInput
}

export async function updateMember(db: DbClient, actor: Actor, id: string, input: UpdateMemberInput) {
  const existing = await requireMember(db, actor.cooperativeId, id)
  const today = todayIso(actor.timezone)
  if (input.admittedOn && input.admittedOn > today) throw new DomainError("VALIDATION", "A admissão não pode ser futura.")
  if (input.admittedOn && existing.leftOn && input.admittedOn > existing.leftOn) {
    throw new DomainError("VALIDATION", "A admissão não pode ser depois do desligamento.")
  }

  const patch = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.pixKey !== undefined ? { pixKey: input.pixKey.trim() || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    ...(input.admittedOn !== undefined ? { admittedOn: input.admittedOn } : {}),
    ...(input.inssWithheld !== undefined ? { inssWithheld: input.inssWithheld } : {}),
    ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
  }

  return db.transaction(async (tx) => {
    // Only the access may have changed: nothing to update on the member row itself.
    const row = Object.keys(patch).length > 0 ? await repo.updateMember(tx, actor.cooperativeId, id, patch) : existing
    if (!row) throw new DomainError("MEMBER_NOT_FOUND")
    await syncAccess(tx, actor, row.id, row.name, input.access)
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "members", entityId: row.id, before: existing, after: row })
    return getMember(tx, actor, row.id)
  })
}

export async function deactivateMember(db: DbClient, actor: Actor, id: string, leftOn: string) {
  const existing = await requireMember(db, actor.cooperativeId, id)
  if (leftOn < existing.admittedOn) throw new DomainError("VALIDATION", "O desligamento não pode ser antes da admissão.")
  if (leftOn > todayIso(actor.timezone)) throw new DomainError("VALIDATION", "O desligamento não pode ser futuro.")
  return db.transaction(async (tx) => {
    const row = await repo.updateMember(tx, actor.cooperativeId, id, { leftOn })
    if (!row) throw new DomainError("MEMBER_NOT_FOUND")
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "members", entityId: id, before: { leftOn: existing.leftOn }, after: { leftOn } })
    return getMember(tx, actor, id)
  })
}

export async function reactivateMember(db: DbClient, actor: Actor, id: string) {
  const existing = await requireMember(db, actor.cooperativeId, id)
  if (!existing.leftOn) throw new DomainError("MEMBER_NOT_LEFT")
  return db.transaction(async (tx) => {
    const row = await repo.updateMember(tx, actor.cooperativeId, id, { leftOn: null })
    if (!row) throw new DomainError("MEMBER_NOT_FOUND")
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "update", entity: "members", entityId: id, before: { leftOn: existing.leftOn }, after: { leftOn: null } })
    return getMember(tx, actor, id)
  })
}

export async function deleteMember(db: DbClient, actor: Actor, id: string) {
  const existing = await requireMember(db, actor.cooperativeId, id)
  if (existing.hasRecords) throw new DomainError("MEMBER_HAS_RECORDS")
  await db.transaction(async (tx) => {
    await audit(tx, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "delete", entity: "members", entityId: id, before: existing })
    await repo.deleteMember(tx, actor.cooperativeId, id)
  })
  return { ok: true as const }
}
