"use client"

import Link from "next/link"
import { InfoIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { StatCard } from "@/components/stat-card"
import { formatInteger, formatMoney, formatPercent } from "@/lib/format"
import type { PayoutSettings } from "@/lib/domain/payout"

export type PayoutTotals = {
  grossRevenue: number
  totalExpenses: number
  surplus: number
  legalReserveAmount: number
  fatesAmount: number
  otherFundsAmount: number
  distributableSurplus: number
  totalWorkedDays: number
  dayValue: number
  distributedTotal: number
  roundingResidual: number
  totalDeductions: number
  totalNet: number
}

export type PayoutRow = {
  key: string
  memberName: string
  workedDays: number
  grossAmount: number
  deductionsAmount: number
  netAmount: number
  carryOverDebt: number
}

export function PayoutSummaryCards({
  totals,
  settings,
  loading = false,
  showSettingsLink = false,
}: {
  totals: PayoutTotals | null
  settings: PayoutSettings
  loading?: boolean
  showSettingsLink?: boolean
}) {
  const t = totals
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard loading={loading} label="Receita de vendas" value={t ? formatMoney(t.grossRevenue) : "—"} hint="Vendas do mês, pela data da venda" />
      <StatCard loading={loading} label="Despesas" value={t ? formatMoney(t.totalExpenses) : "—"} hint={t ? `Sobra: ${formatMoney(t.surplus)}` : undefined} />
      <StatCard
        loading={loading}
        label="Fundos legais"
        value={t ? formatMoney(t.legalReserveAmount + t.fatesAmount + t.otherFundsAmount) : "—"}
        hint={
          <span className="flex flex-col gap-0.5">
            <span>Reserva Legal {formatPercent(settings.legalReserveRate)}: {t ? formatMoney(t.legalReserveAmount) : "—"}</span>
            <span>FATES {formatPercent(settings.fatesRate)}: {t ? formatMoney(t.fatesAmount) : "—"}</span>
            {settings.otherFundsRate > 0 && <span>Outros {formatPercent(settings.otherFundsRate)}: {t ? formatMoney(t.otherFundsAmount) : "—"}</span>}
            {showSettingsLink && (
              <Link href="/configuracoes/rateio" className="underline underline-offset-4">
                Ajustar percentuais
              </Link>
            )}
          </span>
        }
      />
      <StatCard loading={loading} label="Sobra distribuível" value={t ? formatMoney(t.distributableSurplus) : "—"} hint="Sobra menos fundos" />
      <StatCard
        loading={loading}
        highlight
        label="Valor da diária"
        value={t ? formatMoney(t.dayValue) : "—"}
        hint={t ? `baseado em ${formatInteger(t.totalWorkedDays)} diárias` : undefined}
      />
    </div>
  )
}

export function PayoutTable({
  rows,
  totals,
  renderRowStart,
  renderRowEnd,
  headStart,
  headEnd,
}: {
  rows: PayoutRow[]
  totals: PayoutTotals
  renderRowStart?: (row: PayoutRow) => React.ReactNode
  renderRowEnd?: (row: PayoutRow) => React.ReactNode
  headStart?: React.ReactNode
  headEnd?: React.ReactNode
}) {
  const hasDebt = rows.some((r) => r.carryOverDebt > 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headStart}
          <TableHead>Cooperado</TableHead>
          <TableHead className="text-right">Dias</TableHead>
          <TableHead className="text-right">Bruto</TableHead>
          <TableHead className="text-right">Vales</TableHead>
          <TableHead className="text-right">Líquido</TableHead>
          {hasDebt && <TableHead className="text-right">Saldo devedor</TableHead>}
          {headEnd}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key} className={cn(row.workedDays === 0 && "text-muted-foreground")}>
            {renderRowStart?.(row)}
            <TableCell className="font-medium">
              <span className="flex items-center gap-2">
                {row.memberName}
                {row.workedDays === 0 && <Badge variant="outline">sem presença</Badge>}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.workedDays}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.grossAmount)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.deductionsAmount > 0 ? `− ${formatMoney(row.deductionsAmount)}` : "—"}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(row.netAmount)}</TableCell>
            {hasDebt && (
              <TableCell className="text-right tabular-nums">
                {row.carryOverDebt > 0 ? <Badge variant="destructive">{formatMoney(row.carryOverDebt)}</Badge> : "—"}
              </TableCell>
            )}
            {renderRowEnd?.(row)}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          {headStart && <TableCell />}
          <TableCell className="font-medium">
            <span className="flex items-center gap-1.5">
              Total distribuído
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex text-muted-foreground" />}>
                  <InfoIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  Resíduo de arredondamento: {formatMoney(totals.roundingResidual)}. Fica com a cooperativa; nunca se distribui mais do que existe.
                </TooltipContent>
              </Tooltip>
            </span>
          </TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatInteger(totals.totalWorkedDays)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">{formatMoney(totals.distributedTotal)}</TableCell>
          <TableCell className="text-right font-medium tabular-nums">− {formatMoney(totals.totalDeductions)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{formatMoney(totals.totalNet)}</TableCell>
          {hasDebt && <TableCell />}
          {headEnd && <TableCell />}
        </TableRow>
      </TableFooter>
    </Table>
  )
}
