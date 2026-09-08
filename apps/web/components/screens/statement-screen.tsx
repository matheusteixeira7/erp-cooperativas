"use client"

import * as React from "react"
import { ptBR } from "date-fns/locale"
import { CalendarDaysIcon, CircleDashedIcon, InfoIcon, ReceiptIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Calendar } from "@workspace/ui/components/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHeader } from "@/components/page-header"
import { PeriodSelect } from "@/components/period-select"
import { StatCard } from "@/components/stat-card"
import { currentPeriod, isInPeriod, isoToDate, periodOf } from "@/lib/dates"
import { useRequiredSession } from "@/lib/demo/session"
import { useDemo, useSimulatedLoading } from "@/lib/demo/store"
import { ADVANCE_KIND_LABEL } from "@/lib/demo/types"
import { formatDate, formatDateTime, formatMoney, formatPeriod, formatPeriodLong } from "@/lib/format"

export function StatementScreen() {
  const { data, resetCount } = useDemo()
  const { session } = useRequiredSession()
  const current = currentPeriod()
  const [period, setPeriod] = React.useState(current)
  const loading = useSimulatedLoading(`statement-${period}-${resetCount}`)

  const member = data.members.find((m) => m.id === session.memberId)
  const from = member ? periodOf(member.admittedOn) : "2026-01"

  const presences = React.useMemo(
    () => data.attendances.filter((a) => a.memberId === member?.id && a.present && isInPeriod(a.date, period)).map((a) => a.date).sort(),
    [data.attendances, member?.id, period],
  )
  const payout = data.payouts.find((p) => p.period === period && p.status === "closed")
  const item = payout?.items.find((i) => i.memberId === member?.id)
  const deducted = payout ? data.advances.filter((a) => a.deductedInPayoutId === payout.id && a.memberId === member?.id) : []
  const pendingAdvances = data.advances.filter((a) => a.memberId === member?.id && a.status === "pending" && a.grantedOn <= `${period}-31`)

  if (!member) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ReceiptIcon />
          </EmptyMedia>
          <EmptyTitle>Seu usuário não está ligado a um cooperado</EmptyTitle>
          <EmptyDescription>Peça ao gestor para vincular seu acesso ao seu cadastro.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const monthStart = isoToDate(`${period}-01`)
  const selectedDates = presences.map(isoToDate)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu extrato" description={`${member.name} · ${session.cooperativeName}`}>
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="statement-period">Mês</FieldLabel>
          <PeriodSelect id="statement-period" value={period} onValueChange={setPeriod} from={from} />
        </Field>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : payout && item ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Mês fechado</Badge>
            {item.paidAt ? <Badge variant="secondary">Pago em {formatDate(item.paidAt.slice(0, 10))}</Badge> : <Badge variant="outline">Aguardando pagamento</Badge>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Dias trabalhados" value={item.workedDays} hint={`de ${payout.totalWorkedDays} diárias da cooperativa`} />
            <StatCard label="Valor da diária" value={formatMoney(payout.dayValue)} hint="igual para todos os cooperados" />
            <StatCard label="Bruto" value={formatMoney(item.grossAmount)} hint={`${item.workedDays} dias × ${formatMoney(payout.dayValue)}`} />
            <StatCard label="Vales descontados" value={item.deductionsAmount > 0 ? `− ${formatMoney(item.deductionsAmount)}` : formatMoney(0)} hint={`${deducted.length} vale(s)`} />
            <StatCard highlight className="sm:col-span-2" label="Líquido a receber" value={formatMoney(item.netAmount)} hint={item.carryOverDebt > 0 ? `Saldo devedor de ${formatMoney(item.carryOverDebt)} passa para o próximo mês.` : `Fechado em ${formatDateTime(payout.closedAt)}.`} />
          </div>
          {deducted.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vales descontados</CardTitle>
                <CardDescription>Adiantamentos e compras abatidos neste mês.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {deducted.map((advance) => (
                    <li key={advance.id} className="flex items-center justify-between gap-2">
                      <span className="flex flex-col">
                        <span>{advance.description}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(advance.grantedOn)} · {ADVANCE_KIND_LABEL[advance.kind]}
                        </span>
                      </span>
                      <span className="tabular-nums">− {formatMoney(advance.amount)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      ) : presences.length === 0 && pendingAdvances.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleDashedIcon />
            </EmptyMedia>
            <EmptyTitle>Sem registros em {formatPeriod(period)}</EmptyTitle>
            <EmptyDescription>Nenhuma presença ou vale seu neste mês.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Alert>
            <InfoIcon />
            <AlertTitle>{period === current ? "Mês em andamento" : "Mês ainda não fechado"}</AlertTitle>
            <AlertDescription>
              O valor da diária só existe depois que o gestor fecha o mês. Até lá, você acompanha seus dias trabalhados.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Dias trabalhados até agora" value={presences.length} hint={formatPeriodLong(period)} />
            <StatCard
              label="Vales pendentes"
              value={pendingAdvances.length > 0 ? `− ${formatMoney(pendingAdvances.reduce((s, a) => s + a.amount, 0))}` : formatMoney(0)}
              hint={pendingAdvances.length > 0 ? "serão descontados no fechamento" : "nada a descontar"}
            />
          </div>
        </>
      )}

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4" />
              Presenças em {formatPeriod(period)}
            </CardTitle>
            <CardDescription>Dias marcados são os que você esteve presente na chamada.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="multiple"
              month={monthStart}
              selected={selectedDates}
              disableNavigation
              locale={ptBR}
              showOutsideDays={false}
              className="[--cell-size:--spacing(10)]"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
