"use client"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"

import { currentPeriod, periodRange } from "@/lib/dates"
import { formatPeriod } from "@/lib/format"

export function PeriodSelect({
  value,
  onValueChange,
  from = "2026-01",
  to = currentPeriod(),
  disabled,
  className,
  id,
}: {
  value: string
  onValueChange: (period: string) => void
  from?: string
  to?: string
  disabled?: boolean
  className?: string
  id?: string
}) {
  const periods = periodRange(from, to)
  const items = periods.map((p) => ({ value: p, label: formatPeriod(p) }))
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className ?? "w-44"} aria-label="Mês">
        <SelectValue placeholder="Escolha o mês" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
