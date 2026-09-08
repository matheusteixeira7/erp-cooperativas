// Date helpers working on "YYYY-MM-DD" and "YYYY-MM" strings to avoid timezone drift.

export function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function todayIso() {
  return toIsoDate(new Date())
}

export function currentPeriod() {
  return todayIso().slice(0, 7)
}

export function periodOf(isoDate: string) {
  return isoDate.slice(0, 7)
}

export function firstDayOf(period: string) {
  return `${period}-01`
}

export function lastDayOf(period: string) {
  const [year, month] = period.split("-").map(Number)
  const last = new Date(year ?? 1970, month ?? 1, 0).getDate()
  return `${period}-${String(last).padStart(2, "0")}`
}

export function daysInPeriod(period: string) {
  const [year, month] = period.split("-").map(Number)
  return new Date(year ?? 1970, month ?? 1, 0).getDate()
}

export function addMonths(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number)
  const date = new Date((year ?? 1970), (month ?? 1) - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function isoToDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

/** Weekday 0 (Sunday) .. 6 (Saturday). */
export function weekdayOf(isoDate: string) {
  return isoToDate(isoDate).getDay()
}

export function isInPeriod(isoDate: string, period: string) {
  return isoDate.startsWith(period)
}

/** Periods from `from` up to `to` (inclusive), newest first. */
export function periodRange(from: string, to: string) {
  const list: string[] = []
  let cursor = to
  while (cursor >= from) {
    list.push(cursor)
    cursor = addMonths(cursor, -1)
  }
  return list
}

export function nowIso() {
  return new Date().toISOString()
}
