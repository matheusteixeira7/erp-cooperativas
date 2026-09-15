/**
 * Server-side "today" in the cooperative's timezone (NF-002). The server may
 * run in UTC; a sale entered at 23h30 in São Paulo must land on the right day.
 */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo"

export function todayIso(timeZone: string = process.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE, now: Date = new Date()) {
  // en-CA yields YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function currentPeriod(timeZone?: string) {
  return todayIso(timeZone).slice(0, 7)
}

export function periodOf(isoDate: string) {
  return isoDate.slice(0, 7)
}

export function firstDayOf(period: string) {
  return `${period}-01`
}

export function lastDayOf(period: string) {
  const [year, month] = period.split("-").map(Number)
  const last = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate()
  return `${period}-${String(last).padStart(2, "0")}`
}

export function addMonths(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export function nowIso() {
  return new Date().toISOString()
}
