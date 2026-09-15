"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
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
import { QueryError } from "@/components/query-error"
import { StatCard } from "@/components/stat-card"
import { currentPeriod, isoToDate, periodOf } from "@/lib/dates"
import { ADVANCE_KIND_LABEL } from "@/lib/domain/enums"
import { formatDate, formatDateTime, formatMoney, formatPercent, formatPeriod, formatPeriodLong } from "@/lib/format"
import { useRequiredSession } from "@/lib/session"
import { useTRPC } from "@/lib/trpc/client"

export function StatementScreen() {
  const trpc = useTRPC()
  const { session } = useRequiredSession()
  const current = currentPeriod()
  const [period, setPeriod] = React.useState(current)
  const query = useQuery(trpc.payouts.memberStatement.queryOptions({ period }, { enabled: Boolean(session.memberId) }))
  const statement = query.data ?? null
  const loading = query.isPending && Boolean(session.memberId)

  if (!session.memberId || (query.isSuccess && statement === null)) {
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

  const from = statement ? periodOf(statement.member.admittedOn) : "2026-01"
  const closed = statement?.closed ?? null
  const presences = statement?.presences ?? []
  const pendingAdvances = statement?.pendingAdvances ?? []
  const monthStart = isoToDate(`${period}-01`)
  const selectedDates = presences.map(isoToDate)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu extrato" description={`${statement?.member.name ?? session.name} · ${session.cooperativeName}`}>
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
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} title="Não foi possível carregar o extrato" />
      ) : closed ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Mês fechado</Badge>
            {closed.item.paidAt ? <Badge variant="secondary">Pago em {formatDate(closed.item.paidAt.slice(0, 10))}</Badge> : <Badge variant="outline">Aguardando pagamento</Badge>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Dias trabalhados" value={closed.item.workedDays} hint={`de ${closed.payout.totalWorkedDays} diárias da cooperativa`} />
            <StatCard label="Valor da diária" value={formatMoney(closed.payout.dayValue)} hint="igual para todos os cooperados" />
            <StatCard label="Bruto" value={formatMoney(closed.item.grossAmount)} hint={`${closed.item.workedDays} dias × ${formatMoney(closed.payout.dayValue)}`} />
            {(closed.payout.inssTotal > 0 || closed.item.inssAmount > 0) && (
              <StatCard
                label="INSS retido"
                value={closed.item.inssAmount > 0 ? `− ${formatMoney(closed.item.inssAmount)}` : "Sem desconto"}
                hint={closed.item.inssAmount > 0 ? `${formatPercent(closed.item.inssRate)} sobre o bruto. A cooperativa recolhe para você.` : "Você está marcado como quem recolhe por fora."}
              />
            )}
            <StatCard label="Vales descontados" value={closed.item.deductionsAmount > 0 ? `− ${formatMoney(closed.item.deductionsAmount)}` : formatMoney(0)} hint={`${closed.deductedAdvances.length} vale(s)`} />
            <StatCard
              highlight
              className="sm:col-span-2"
              label="Líquido a receber"
              value={formatMoney(closed.item.netAmount)}
              hint={closed.item.carryOverDebt > 0 ? `Saldo devedor de ${formatMoney(closed.item.carryOverDebt)} passa para o próximo mês.` : `Fechado em ${formatDateTime(closed.payout.closedAt)}.`}
            />
          </div>
          {closed.deductedAdvances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vales descontados</CardTitle>
                <CardDescription>Adiantamentos e compras abatidos neste mês.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {closed.deductedAdvances.map((advance) => (
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

      {!loading && !query.isError && (
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
