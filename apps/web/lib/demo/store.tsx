"use client"

// Demo store. Simulates the API layer: latency, validation, business rules.
// Data is kept in localStorage so the prototype survives a page reload (see resetDemo to start over).

import * as React from "react"

import { currentPeriod, firstDayOf, lastDayOf, nowIso, periodOf, addMonths } from "@/lib/dates"
import {
  LEGAL_DEFAULT_SETTINGS,
  itemSubtotal,
  simulatePayout,
  type PayoutSettings,
  type SimulationOutcome,
} from "@/lib/domain/payout"
import { DemoError } from "@/lib/demo/errors"
import { createSeed } from "@/lib/demo/seed"
import type {
  Advance,
  AdvanceKind,
  Buyer,
  DemoData,
  Expense,
  ExpenseCategory,
  Member,
  Payout,
  PayoutSettingsVersion,
  Sale,
} from "@/lib/demo/types"

const LATENCY_MS = 650
const DATA_KEY = "erp-cooperativas.demo-data"
/** Bump when the seed changes so stale browser data is discarded. */
const SEED_VERSION = 1

// --- localStorage-backed external store (SSR safe via useSyncExternalStore) ---

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(DATA_KEY)
  } catch {
    return null
  }
}

function getServerSnapshot(): string | null {
  return null
}

function persist(data: DemoData | null) {
  try {
    if (data) window.localStorage.setItem(DATA_KEY, JSON.stringify({ v: SEED_VERSION, data }))
    else window.localStorage.removeItem(DATA_KEY)
  } catch {
    // storage full or unavailable: keep going in memory
  }
  listeners.forEach((listener) => listener())
}

function parseStored(raw: string | null): DemoData | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { v?: number; data?: DemoData }
    return parsed.v === SEED_VERSION && parsed.data ? parsed.data : null
  } catch {
    return null
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

let idCounter = 0
function newId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

// ---------- Pure selectors (also used by pages) ----------

/** RN-026: the settings row with greatest effectiveFrom <= period, else legal defaults. */
export function settingsForPeriod(history: PayoutSettingsVersion[], period: string): PayoutSettingsVersion {
  const applicable = history
    .filter((s) => s.effectiveFrom <= period)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  const found = applicable[0]
  if (found) return found
  return {
    id: "legal-default",
    effectiveFrom: "1970-01",
    ...LEGAL_DEFAULT_SETTINGS,
    createdBy: "sistema",
    createdAt: "1970-01-01T00:00:00",
    isLegalDefault: true,
  }
}

export function toPayoutSettings(version: PayoutSettingsVersion): PayoutSettings {
  return {
    legalReserveRate: version.legalReserveRate,
    fatesRate: version.fatesRate,
    otherFundsRate: version.otherFundsRate,
    negativeBalancePolicy: version.negativeBalancePolicy,
    includeMembersLeftInPeriod: version.includeMembersLeftInPeriod,
  }
}

export function closedPayoutFor(data: DemoData, period: string) {
  return data.payouts.find((p) => p.period === period && p.status === "closed")
}

export function isPeriodClosed(data: DemoData, period: string) {
  return Boolean(closedPayoutFor(data, period))
}

export function activeMembersOn(members: Member[], date: string) {
  return members.filter((m) => m.admittedOn <= date && (!m.leftOn || m.leftOn >= date))
}

export function runSimulation(data: DemoData, period: string): SimulationOutcome {
  return simulatePayout({
    period,
    sales: data.sales,
    expenses: data.expenses,
    attendances: data.attendances,
    members: data.members,
    advances: data.advances,
    settings: toPayoutSettings(settingsForPeriod(data.settingsHistory, period)),
  })
}

// ---------- Store ----------

export type SaleDraftItem = { materialTypeId: string; weightKg: number; pricePerKg: number }

type Actor = { userId: string; name: string }

export type DemoActions = {
  saveAttendance(date: string, entries: { memberId: string; present: boolean }[]): Promise<{ present: number }>
  createBuyer(input: { name: string; cnpj: string; contact: string }): Promise<Buyer>
  createSale(input: { buyerId: string; soldOn: string; items: SaleDraftItem[]; invoiceNumber: string; note: string }, actor: Actor): Promise<Sale>
  deleteSale(id: string): Promise<void>
  createExpense(input: { description: string; category: ExpenseCategory; amount: number; incurredOn: string }, actor: Actor): Promise<Expense>
  deleteExpense(id: string): Promise<void>
  createAdvance(input: { memberId: string; kind: AdvanceKind; description: string; amount: number; grantedOn: string }, actor: Actor): Promise<Advance>
  cancelAdvance(id: string, reason: string): Promise<void>
  simulate(period: string): Promise<SimulationOutcome>
  closePayout(period: string, actor: Actor): Promise<Payout>
  reopenPayout(id: string, reason: string, actor: Actor): Promise<Payout>
  setItemPaid(payoutId: string, itemId: string, paid: boolean): Promise<void>
  setAllPaid(payoutId: string): Promise<void>
  createMember(input: Omit<Member, "id" | "leftOn">): Promise<Member>
  updateMember(id: string, input: Partial<Omit<Member, "id">>): Promise<Member>
  deactivateMember(id: string, leftOn: string): Promise<void>
  saveSettings(input: Omit<PayoutSettingsVersion, "id" | "createdAt" | "isLegalDefault">): Promise<PayoutSettingsVersion>
}

type DemoContextValue = {
  data: DemoData
  actions: DemoActions
  failNext: boolean
  setFailNext: (value: boolean) => void
  resetDemo: () => void
  resetCount: number
}

const DemoContext = React.createContext<DemoContextValue | null>(null)

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [seed] = React.useState<DemoData>(() => createSeed())
  const raw = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const data = React.useMemo(() => parseStored(raw) ?? seed, [raw, seed])
  // In-memory fallback used when localStorage is unavailable.
  const [memory, setMemory] = React.useState<DemoData | null>(null)
  const effective = raw === null && memory ? memory : data
  const setData = React.useCallback((next: DemoData) => {
    setMemory(next)
    persist(next)
  }, [])
  const [failNext, setFailNext] = React.useState(false)
  const [resetCount, setResetCount] = React.useState(0)
  const dataRef = React.useRef(effective)
  const failRef = React.useRef(failNext)
  React.useEffect(() => {
    dataRef.current = effective
  }, [effective])
  React.useEffect(() => {
    failRef.current = failNext
  }, [failNext])

  /** Runs a "server" mutation: latency, optional forced failure, then commit. */
  const run = React.useCallback(
    async <T,>(fn: (current: DemoData) => { next: DemoData; result: T }): Promise<T> => {
      await wait(LATENCY_MS)
      if (failRef.current) {
        setFailNext(false)
        throw new DemoError("ERR-SYS-001")
      }
      const { next, result } = fn(dataRef.current)
      dataRef.current = next
      setData(next)
      return result
    },
    [setData],
  )

  const assertOpen = (current: DemoData, date: string) => {
    if (isPeriodClosed(current, periodOf(date))) throw new DemoError("ERR-PAYOUT-003")
  }

  const actions = React.useMemo<DemoActions>(
    () => ({
      async saveAttendance(date, entries) {
        return run((current) => {
          assertOpen(current, date)
          if (entries.length === 0) throw new DemoError("ERR-VAL-001")
          const others = current.attendances.filter((a) => a.date !== date)
          const kept = current.attendances.filter((a) => a.date === date)
          const upserted = entries.map((entry) => {
            const existing = kept.find((a) => a.memberId === entry.memberId)
            return existing
              ? { ...existing, present: entry.present }
              : { id: `att-${entry.memberId}-${date}`, memberId: entry.memberId, date, present: entry.present }
          })
          const untouched = kept.filter((a) => !entries.some((e) => e.memberId === a.memberId))
          return {
            next: { ...current, attendances: [...others, ...untouched, ...upserted] },
            result: { present: entries.filter((e) => e.present).length },
          }
        })
      },

      async createBuyer(input) {
        return run((current) => {
          const buyer: Buyer = { id: newId("b"), name: input.name.trim(), cnpj: input.cnpj, contact: input.contact, active: true }
          return { next: { ...current, buyers: [...current.buyers, buyer] }, result: buyer }
        })
      },

      async createSale(input, actor) {
        return run((current) => {
          assertOpen(current, input.soldOn)
          if (input.items.length === 0) throw new DemoError("ERR-SALE-001")
          if (!current.buyers.some((b) => b.id === input.buyerId)) throw new DemoError("ERR-SALE-002")
          const id = newId("s")
          const items = input.items.map((item, index) => ({
            id: `${id}-i${index + 1}`,
            materialTypeId: item.materialTypeId,
            weightKg: item.weightKg,
            pricePerKg: item.pricePerKg,
            subtotal: itemSubtotal(item.weightKg, item.pricePerKg),
          }))
          const sale: Sale = {
            id,
            buyerId: input.buyerId,
            soldOn: input.soldOn,
            items,
            totalAmount: round2(items.reduce((sum, i) => sum + i.subtotal, 0)),
            totalWeightKg: round2(items.reduce((sum, i) => sum + i.weightKg, 0)),
            invoiceNumber: input.invoiceNumber.trim(),
            note: input.note.trim(),
            deletedAt: null,
            createdBy: actor.userId,
            createdAt: nowIso(),
          }
          return { next: { ...current, sales: [sale, ...current.sales] }, result: sale }
        })
      },

      async deleteSale(id) {
        return run((current) => {
          const sale = current.sales.find((s) => s.id === id && !s.deletedAt)
          if (!sale) throw new DemoError("ERR-SALE-003")
          assertOpen(current, sale.soldOn)
          return {
            next: { ...current, sales: current.sales.map((s) => (s.id === id ? { ...s, deletedAt: nowIso() } : s)) },
            result: undefined,
          }
        })
      },

      async createExpense(input, actor) {
        return run((current) => {
          assertOpen(current, input.incurredOn)
          if (input.amount <= 0) throw new DemoError("ERR-VAL-001")
          const expense: Expense = {
            id: newId("e"),
            description: input.description.trim(),
            category: input.category,
            amount: round2(input.amount),
            incurredOn: input.incurredOn,
            deletedAt: null,
            createdBy: actor.userId,
            createdAt: nowIso(),
          }
          return { next: { ...current, expenses: [expense, ...current.expenses] }, result: expense }
        })
      },

      async deleteExpense(id) {
        return run((current) => {
          const expense = current.expenses.find((e) => e.id === id && !e.deletedAt)
          if (!expense) throw new DemoError("ERR-EXPENSE-001")
          assertOpen(current, expense.incurredOn)
          return {
            next: { ...current, expenses: current.expenses.map((e) => (e.id === id ? { ...e, deletedAt: nowIso() } : e)) },
            result: undefined,
          }
        })
      },

      async createAdvance(input, actor) {
        return run((current) => {
          assertOpen(current, input.grantedOn)
          if (input.amount <= 0) throw new DemoError("ERR-VAL-001")
          if (!current.members.some((m) => m.id === input.memberId)) throw new DemoError("ERR-MEMBER-002")
          const created: Advance = {
            id: newId("a"),
            memberId: input.memberId,
            kind: input.kind,
            description: input.description.trim(),
            amount: round2(input.amount),
            grantedOn: input.grantedOn,
            status: "pending",
            deductedInPayoutId: null,
            originAdvanceId: null,
            generatedByPayoutId: null,
            cancelReason: null,
            createdBy: actor.userId,
            createdAt: nowIso(),
          }
          return { next: { ...current, advances: [created, ...current.advances] }, result: created }
        })
      },

      async cancelAdvance(id, reason) {
        return run((current) => {
          const found = current.advances.find((a) => a.id === id)
          if (!found) throw new DemoError("ERR-ADVANCE-002")
          if (found.status !== "pending") throw new DemoError("ERR-ADVANCE-001")
          assertOpen(current, found.grantedOn)
          return {
            next: {
              ...current,
              advances: current.advances.map((a) =>
                a.id === id ? { ...a, status: "cancelled", cancelReason: reason.trim() } : a,
              ),
            },
            result: undefined,
          }
        })
      },

      async simulate(period) {
        await wait(LATENCY_MS)
        return runSimulation(dataRef.current, period)
      },

      async closePayout(period, actor) {
        return run((current) => {
          if (period > currentPeriod()) throw new DemoError("ERR-PAYOUT-005")
          if (isPeriodClosed(current, period)) throw new DemoError("ERR-PAYOUT-004")
          const outcome = runSimulation(current, period)
          if (!outcome.ok) {
            throw new DemoError(outcome.code === "NO_SURPLUS" ? "ERR-PAYOUT-001" : "ERR-PAYOUT-002")
          }
          const result = outcome.result
          const payoutId = newId("p")
          const settings = settingsForPeriod(current.settingsHistory, period)
          const deductedIds = new Set(result.items.flatMap((i) => i.advanceIds))
          const nextPeriodStart = firstDayOf(addMonths(period, 1))

          const carryOvers: Advance[] = result.items
            .filter((i) => i.carryOverDebt > 0)
            .map((item) => ({
              id: newId("a"),
              memberId: item.memberId,
              kind: "carry_over",
              description: `Saldo devedor de ${period}`,
              amount: item.carryOverDebt,
              grantedOn: nextPeriodStart,
              status: "pending",
              deductedInPayoutId: null,
              originAdvanceId: item.advanceIds[0] ?? null,
              generatedByPayoutId: payoutId,
              cancelReason: null,
              createdBy: "sistema",
              createdAt: nowIso(),
            }))

          const payout: Payout = {
            id: payoutId,
            period,
            status: "closed",
            grossRevenue: result.grossRevenue,
            totalExpenses: result.totalExpenses,
            surplus: result.surplus,
            legalReserveAmount: result.legalReserveAmount,
            fatesAmount: result.fatesAmount,
            otherFundsAmount: result.otherFundsAmount,
            distributableSurplus: result.distributableSurplus,
            totalWorkedDays: result.totalWorkedDays,
            dayValue: result.dayValue,
            distributedTotal: result.distributedTotal,
            roundingResidual: result.roundingResidual,
            totalDeductions: result.totalDeductions,
            totalNet: result.totalNet,
            settingsSnapshot: settings,
            closedBy: actor.name,
            closedAt: nowIso(),
            reopenedBy: null,
            reopenedAt: null,
            reopenReason: null,
            items: result.items.map((item, index) => ({
              id: `${payoutId}-i${index + 1}`,
              payoutId,
              memberId: item.memberId,
              memberNameSnapshot: item.memberName,
              workedDays: item.workedDays,
              grossAmount: item.grossAmount,
              deductionsAmount: item.deductionsAmount,
              netAmount: item.netAmount,
              carryOverDebt: item.carryOverDebt,
              paidAt: null,
            })),
          }

          return {
            next: {
              ...current,
              payouts: [payout, ...current.payouts],
              advances: [
                ...current.advances.map((a) =>
                  deductedIds.has(a.id) ? { ...a, status: "deducted" as const, deductedInPayoutId: payoutId } : a,
                ),
                ...carryOvers,
              ],
            },
            result: payout,
          }
        })
      },

      async reopenPayout(id, reason, actor) {
        return run((current) => {
          const payout = current.payouts.find((p) => p.id === id)
          if (!payout) throw new DemoError("ERR-PAYOUT-006")
          if (payout.status !== "closed") throw new DemoError("ERR-PAYOUT-007")
          const reopened: Payout = {
            ...payout,
            status: "reopened",
            reopenedBy: actor.name,
            reopenedAt: nowIso(),
            reopenReason: reason.trim(),
          }
          return {
            next: {
              ...current,
              payouts: current.payouts.map((p) => (p.id === id ? reopened : p)),
              advances: current.advances.map((a) => {
                if (a.deductedInPayoutId === id) return { ...a, status: "pending" as const, deductedInPayoutId: null }
                if (a.generatedByPayoutId === id) return { ...a, status: "cancelled" as const, cancelReason: "Mês de origem reaberto" }
                return a
              }),
            },
            result: reopened,
          }
        })
      },

      async setItemPaid(payoutId, itemId, paid) {
        return run((current) => ({
          next: {
            ...current,
            payouts: current.payouts.map((p) =>
              p.id === payoutId
                ? { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, paidAt: paid ? nowIso() : null } : i)) }
                : p,
            ),
          },
          result: undefined,
        }))
      },

      async setAllPaid(payoutId) {
        return run((current) => ({
          next: {
            ...current,
            payouts: current.payouts.map((p) =>
              p.id === payoutId
                ? { ...p, items: p.items.map((i) => (i.netAmount > 0 ? { ...i, paidAt: i.paidAt ?? nowIso() } : i)) }
                : p,
            ),
          },
          result: undefined,
        }))
      },

      async createMember(input) {
        return run((current) => {
          if (current.members.some((m) => m.cpf === input.cpf)) throw new DemoError("ERR-MEMBER-001")
          const member: Member = { id: newId("m"), leftOn: null, ...input, name: input.name.trim() }
          return { next: { ...current, members: [...current.members, member] }, result: member }
        })
      },

      async updateMember(id, input) {
        return run((current) => {
          const existing = current.members.find((m) => m.id === id)
          if (!existing) throw new DemoError("ERR-MEMBER-002")
          if (input.cpf && current.members.some((m) => m.id !== id && m.cpf === input.cpf)) throw new DemoError("ERR-MEMBER-001")
          const updated = { ...existing, ...input }
          return { next: { ...current, members: current.members.map((m) => (m.id === id ? updated : m)) }, result: updated }
        })
      },

      async deactivateMember(id, leftOn) {
        return run((current) => {
          const existing = current.members.find((m) => m.id === id)
          if (!existing) throw new DemoError("ERR-MEMBER-002")
          if (leftOn < existing.admittedOn) throw new DemoError("ERR-VAL-001")
          return {
            next: { ...current, members: current.members.map((m) => (m.id === id ? { ...m, leftOn } : m)) },
            result: undefined,
          }
        })
      },

      async saveSettings(input) {
        return run((current) => {
          if (input.legalReserveRate < 0.1 || input.fatesRate < 0.05) throw new DemoError("ERR-SETTINGS-001")
          if (input.legalReserveRate + input.fatesRate + input.otherFundsRate >= 1) throw new DemoError("ERR-VAL-001")
          const version: PayoutSettingsVersion = {
            id: newId("ps"),
            ...input,
            createdAt: nowIso(),
            isLegalDefault:
              input.legalReserveRate === 0.1 && input.fatesRate === 0.05 && input.otherFundsRate === 0,
          }
          return {
            next: { ...current, settingsHistory: [version, ...current.settingsHistory] },
            result: version,
          }
        })
      },
    }),
    [run],
  )

  const resetDemo = React.useCallback(() => {
    const fresh = createSeed()
    dataRef.current = fresh
    setMemory(null)
    persist(null)
    setFailNext(false)
    setResetCount((n) => n + 1)
  }, [])

  const value = React.useMemo<DemoContextValue>(
    () => ({ data: effective, actions, failNext, setFailNext, resetDemo, resetCount }),
    [effective, actions, failNext, resetDemo, resetCount],
  )

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = React.useContext(DemoContext)
  if (!context) throw new Error("useDemo must be used within DemoProvider")
  return context
}

/**
 * Simulates the initial fetch of a screen: returns `true` for a short time whenever `key` changes.
 * Pages render Skeletons while it is true.
 */
export function useSimulatedLoading(key: string, ms = 550) {
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null)
  React.useEffect(() => {
    const timer = setTimeout(() => setLoadedKey(key), ms)
    return () => clearTimeout(timer)
  }, [key, ms])
  return loadedKey !== key
}

export { lastDayOf }
