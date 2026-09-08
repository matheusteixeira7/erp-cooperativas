"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2Icon, LockIcon, RefreshCwIcon, TriangleAlertIcon, TrendingDownIcon, UserXIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "@workspace/ui/components/toast"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { PayoutSummaryCards, PayoutTable } from "@/components/payout-summary"
import { PeriodSelect } from "@/components/period-select"
import { addMonths, currentPeriod } from "@/lib/dates"
import { errorMessage } from "@/lib/demo/errors"
import { closedPayoutFor, settingsForPeriod, toPayoutSettings, useDemo } from "@/lib/demo/store"
import type { Payout } from "@/lib/demo/types"
import type { SimulationOutcome } from "@/lib/domain/payout"
import { formatMoney, formatPeriod } from "@/lib/format"
import { useActor } from "@/lib/use-actor"

export function PayoutScreen() {
  const { data, actions, resetCount } = useDemo()
  const actor = useActor()
  const current = currentPeriod()
  const [period, setPeriod] = React.useState(addMonths(current, -1))
  const [request, setRequest] = React.useState(0)
  // A fresh token whenever anything that affects the simulation changes; the outcome carries the token it answered.
  const token = React.useMemo(
    () => ({ period }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, request, resetCount, data.sales, data.expenses, data.attendances, data.advances, data.settingsHistory],
  )
  const [answer, setAnswer] = React.useState<{ token: { period: string }; outcome: SimulationOutcome } | null>(null)
  const outcome = answer?.token === token ? answer.outcome : null
  const loading = outcome === null
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [lastClosed, setLastClosed] = React.useState<Payout | null>(null)
  const justClosed = lastClosed && lastClosed.period === period && closedPayoutFor(data, period)?.id === lastClosed.id ? lastClosed : null

  const closed = closedPayoutFor(data, period)
  const settingsVersion = settingsForPeriod(data.settingsHistory, period)
  const settings = toPayoutSettings(settingsVersion)
  const isCurrentMonth = period === current

  React.useEffect(() => {
    let cancelled = false
    void actions.simulate(token.period).then((result) => {
      if (!cancelled) setAnswer({ token, outcome: result })
    })
    return () => {
      cancelled = true
    }
  }, [actions, token])

  function refresh() {
    setRequest((n) => n + 1)
  }

  async function handleClose() {
    try {
      const payout = await actions.closePayout(period, actor)
      setLastClosed(payout)
      toast.add({
        type: "success",
        title: `${formatPeriod(period)} fechado`,
        description: `${formatMoney(payout.distributedTotal)} rateados entre ${payout.items.filter((i) => i.workedDays > 0).length} cooperados.`,
      })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível fechar o mês", description: errorMessage(error) })
      throw error
    }
  }

  const simulated = outcome?.ok ? outcome.result : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fechamento e rateio" description="Simule quantas vezes quiser. Só o botão “Fechar mês” grava.">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="payout-period">Mês</FieldLabel>
          <PeriodSelect id="payout-period" value={period} onValueChange={setPeriod} />
        </Field>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          Atualizar
        </Button>
      </PageHeader>

      {closed && (
        <Alert>
          {justClosed ? <CheckCircle2Icon /> : <LockIcon />}
          <AlertTitle>{justClosed ? `${formatPeriod(period)} foi fechado com sucesso` : `${formatPeriod(period)} já está fechado`}</AlertTitle>
          <AlertDescription>
            <p>
              Diária de {formatMoney(closed.dayValue)} · {formatMoney(closed.distributedTotal)} distribuídos entre {closed.items.filter((i) => i.workedDays > 0).length} cooperados. Lançamentos do mês estão bloqueados.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" render={<Link href={`/fechamento/${closed.id}`} />} nativeButton={false}>
                Ver demonstrativo e marcar pagamentos
              </Button>
              <Button size="sm" variant="outline" render={<Link href="/fechamento/historico" />} nativeButton={false}>
                Histórico
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <>
          <PayoutSummaryCards totals={null} settings={settings} loading />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </CardContent>
          </Card>
        </>
      ) : outcome && !outcome.ok ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{outcome.code === "NO_SURPLUS" ? <TrendingDownIcon /> : <UserXIcon />}</EmptyMedia>
            <EmptyTitle>
              {outcome.code === "NO_SURPLUS" ? "Não há sobra para ratear" : "Nenhuma presença registrada"}
            </EmptyTitle>
            <EmptyDescription>
              {outcome.code === "NO_SURPLUS"
                ? `Em ${formatPeriod(period)} a receita foi ${formatMoney(outcome.details.grossRevenue)} e as despesas ${formatMoney(outcome.details.totalExpenses)} (sobra ${formatMoney(outcome.details.surplus)}). Confira se faltou lançar alguma venda ou se há despesa lançada errada.`
                : `Não existe chamada em ${formatPeriod(period)}. Sem dias trabalhados não é possível calcular a diária.`}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">
              {outcome.code === "NO_SURPLUS" ? (
                <>
                  <Button render={<Link href="/vendas" />} nativeButton={false}>
                    Lançar vendas
                  </Button>
                  <Button variant="outline" render={<Link href="/financeiro" />} nativeButton={false}>
                    Revisar despesas
                  </Button>
                </>
              ) : (
                <Button render={<Link href="/chamada" />} nativeButton={false}>
                  Fazer chamada
                </Button>
              )}
            </div>
          </EmptyContent>
        </Empty>
      ) : simulated ? (
        <>
          <PayoutSummaryCards totals={simulated} settings={settings} showSettingsLink />

          {simulated.warnings.length > 0 && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>Confira antes de fechar</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {simulated.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{closed ? "Simulação atual (não é o oficial)" : `Simulação de ${formatPeriod(period)}`}</CardTitle>
              <CardDescription>
                {closed
                  ? "O demonstrativo oficial está no fechamento gravado. Estes números só mudam se o mês for reaberto."
                  : "Bruto = dias × diária. Vales pendentes até o fim do mês são descontados. Líquido nunca fica negativo."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutTable
                totals={simulated}
                rows={simulated.items.map((item) => ({
                  key: item.memberId,
                  memberName: item.memberName,
                  workedDays: item.workedDays,
                  grossAmount: item.grossAmount,
                  deductionsAmount: item.deductionsAmount,
                  netAmount: item.netAmount,
                  carryOverDebt: item.carryOverDebt,
                }))}
              />
            </CardContent>
          </Card>

          {!closed && (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                <p className="font-medium">Pronto para oficializar {formatPeriod(period)}?</p>
                <p className="text-muted-foreground">
                  Percentuais vigentes: Reserva Legal {Math.round(settings.legalReserveRate * 100)}%, FATES {Math.round(settings.fatesRate * 100)}%
                  {settingsVersion.isLegalDefault ? " (mínimos legais)" : ""}. Depois de fechar, o mês fica bloqueado.
                </p>
              </div>
              <Button size="lg" onClick={() => setConfirmOpen(true)}>
                <LockIcon data-icon="inline-start" />
                Fechar mês
              </Button>
            </div>
          )}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setAcknowledged(false)
        }}
        title={`Fechar ${formatPeriod(period)}?`}
        description={
          simulated
            ? `${formatMoney(simulated.distributedTotal)} serão rateados entre ${simulated.items.filter((i) => i.workedDays > 0).length} cooperados com diária de ${formatMoney(simulated.dayValue)}. Vales pendentes (${formatMoney(simulated.totalDeductions)}) serão descontados. Esta ação bloqueia chamada, vendas, despesas e vales do mês.`
            : ""
        }
        confirmLabel="Fechar mês"
        disabled={isCurrentMonth && !acknowledged}
        onConfirm={handleClose}
      >
        {isCurrentMonth && (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>O mês ainda não terminou</AlertTitle>
            <AlertDescription>
              <p>Presenças e vendas depois de hoje ficarão de fora. Para incluir, será preciso reabrir.</p>
              <Field orientation="horizontal" className="pt-2">
                <Checkbox id="ack-current" checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked)} />
                <FieldLabel htmlFor="ack-current" className="font-normal">
                  Entendi, quero fechar mesmo assim
                </FieldLabel>
              </Field>
            </AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  )
}
