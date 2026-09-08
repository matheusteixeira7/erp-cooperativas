// Formatting helpers. Everything the user sees is pt-BR (DEC-004).

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})

const kg = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const pricePerKg = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const integer = new Intl.NumberFormat("pt-BR")

export function formatMoney(value: number) {
  return brl.format(value)
}

export function formatWeight(value: number) {
  return `${kg.format(value)} kg`
}

export function formatPricePerKg(value: number) {
  return `${pricePerKg.format(value)}/kg`
}

export function formatInteger(value: number) {
  return integer.format(value)
}

export function formatPercent(rate: number) {
  return `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
}

/** "2026-08-05" -> "05/08/2026" */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

/** "2026-08-05" -> "05/08" */
export function formatShortDate(isoDate: string) {
  const [, month, day] = isoDate.split("-")
  return `${day}/${month}`
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

/** "2026-08" -> "agosto/2026" */
export function formatPeriod(period: string) {
  const [year, month] = period.split("-")
  const index = Number(month) - 1
  return `${MONTH_NAMES[index] ?? month}/${year}`
}

/** "2026-08" -> "Agosto de 2026" */
export function formatPeriodLong(period: string) {
  const [year, month] = period.split("-")
  const index = Number(month) - 1
  const name = MONTH_NAMES[index] ?? month ?? ""
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`
}

/** "2026-08-05T14:03:00" -> "05/08/2026 às 14:03" */
export function formatDateTime(iso: string) {
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${day}/${month}/${date.getFullYear()} às ${hours}:${minutes}`
}

/** "52601815906" -> "526.018.159-06" */
export function formatCpf(digits: string) {
  const d = digits.replace(/\D/g, "").padEnd(11, "_")
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

/** "52601815906" -> "***.018.159-**" (LGPD: masked in lists) */
export function maskCpf(digits: string) {
  const d = digits.replace(/\D/g, "")
  if (d.length !== 11) return digits
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

export function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase()
}

/** Parses "1.234,56" or "1234.56" typed by the user into a number. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
