"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery } from "@tanstack/react-query"
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
import { QueryError } from "@/components/query-error"
import { addMonths, currentPeriod } from "@/lib/dates"
import { LEGAL_DEFAULT_SETTINGS, type PayoutSettings } from "@/lib/domain/payout"
import { formatMoney, formatPercent, formatPeriod } from "@/lib/format"
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client"
import { errorMessage } from "@/lib/trpc/errors"
import { useInvalidateAll } from "@/lib/trpc/hooks"

type Payout = RouterOutputs["payouts"]["close"]

export function PayoutScreen() {
  const trpc = useTRPC()
  const invalidateAll = useInvalidateAll()
  const current = currentPeriod()
  const [period, setPeriod] = React.useState(addMonths(current, -1))
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [lastClosed, setLastClosed] = React.useState<Payout | null>(null)

  const simulation = useQuery(trpc.payouts.simulate.queryOptions({ period }))
  const closedQuery = useQuery(trpc.payouts.byId.queryOptions({ id: simulation.data?.closedPayoutId ?? "" }, { enabled: Boolean(simulation.data?.closedPayoutId) }))
  const closeMutation = useMutation(trpc.payouts.close.mutationOptions())

  const loading = simulation.isPending
  const outcome = simulation.data?.outcome ?? null
  const settingsVersion = simulation.data?.settings ?? null
  const settings: PayoutSettings = settingsVersion
    ? {
        legalReserveRate: settingsVersion.legalReserveRate,
        fatesRate: settingsVersion.fatesRate,
        otherFundsRate: settingsVersion.otherFundsRate,
        inssRate: settingsVersion.inssRate,
        negativeBalancePolicy: settingsVersion.negativeBalancePolicy,
        includeMembersLeftInPeriod: settingsVersion.includeMembersLeftInPeriod,
      }
    : LEGAL_DEFAULT_SETTINGS
  const closed = simulation.data?.periodClosed ? (closedQuery.data ?? null) : null
  const closedId = simulation.data?.closedPayoutId ?? null
  const justClosed = lastClosed && lastClosed.period === period && closedId === lastClosed.id ? lastClosed : null
  const isCurrentMonth = period === current
  const simulated = outcome?.ok ? outcome.result : null

  function refresh() {
    void simulation.refetch()
  }

  async function handleClose() {
    if (!simulated) return
    try {
      const payout = await closeMutation.mutateAsync({ period, confirmDistributableSurplus: simulated.distributableSurplus })
      setLastClosed(payout)
      await invalidateAll()
      toast.add({
        type: "success",
        title: `${formatPeriod(period)} fechado`,
        description: `${formatMoney(payout.distributedTotal)} rateados entre ${payout.items.filter((i) => i.workedDays > 0).length} cooperados.`,
      })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível fechar o mês", description: errorMessage(error) })
      void simulation.refetch()
      throw error
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fechamento e rateio" description="Simule quantas vezes quiser. Só o botão “Fechar mês” grava.">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="payout-period">Mês</FieldLabel>
          <PeriodSelect id="payout-period" value={period} onValueChange={setPeriod} />
        </Field>
        <Button variant="outline" onClick={refresh} disabled={simulation.isFetching}>
          <RefreshCwIcon data-icon="inline-start" className={simulation.isFetching ? "animate-spin" : undefined} />
          Atualizar
        </Button>
      </PageHeader>

      {closedId && (
        <Alert>
          {justClosed ? <CheckCircle2Icon /> : <LockIcon />}
          <AlertTitle>{justClosed ? `${formatPeriod(period)} foi fechado com sucesso` : `${formatPeriod(period)} já está fechado`}</AlertTitle>
          <AlertDescription>
            {closed ? (
              <p>
                Diária de {formatMoney(closed.dayValue)} · {formatMoney(closed.distributedTotal)} distribuídos entre {closed.items.filter((i) => i.workedDays > 0).length} cooperados. Lançamentos do mês estão bloqueados.
              </p>
            ) : (
              <p>Lançamentos do mês estão bloqueados.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" render={<Link href={`/fechamento/${closedId}`} />} nativeButton={false}>
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
      ) : simulation.isError ? (
        <QueryError error={simulation.error} onRetry={refresh} retrying={simulation.isFetching} title="Não foi possível simular o rateio" />
      ) : outcome && !outcome.ok ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{outcome.code === "NO_SURPLUS" ? <TrendingDownIcon /> : <UserXIcon />}</EmptyMedia>
            <EmptyTitle>
              {outcome.code === "NO_SURPLUS" ? "Não há sobra para ratear" : "Nenhuma presença registrada"}
            </EmptyTitle>
            <EmptyDescription>
              {outcome.code === "NO_SURPLUS"
                ? `Em ${formatPeriod(period)} a receita foi ${formatMoney(outcome.details.grossRevenue)}, as compras de material ${formatMoney(outcome.details.totalPurchases)} e as despesas ${formatMoney(outcome.details.totalExpenses)} (sobra ${formatMoney(outcome.details.surplus)}). Confira se faltou lançar alguma venda ou se há compra ou despesa lançada errada.`
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
              <CardTitle>{closedId ? "Simulação atual (não é o oficial)" : `Simulação de ${formatPeriod(period)}`}</CardTitle>
              <CardDescription>
                {closedId
                  ? "O demonstrativo oficial está no fechamento gravado. Estes números só mudam se o mês for reaberto."
                  : settings.inssRate > 0
                    ? `Bruto = dias × diária. INSS de ${formatPercent(settings.inssRate)} sai do bruto, depois os vales pendentes. Líquido nunca fica negativo.`
                    : "Bruto = dias × diária. Vales pendentes até o fim do mês são descontados. Líquido nunca fica negativo."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutTable
                totals={simulated}
                showInss={settings.inssRate > 0 || simulated.inssTotal > 0}
                rows={simulated.items.map((item) => ({
                  key: item.memberId,
                  memberName: item.memberName,
                  workedDays: item.workedDays,
                  grossAmount: item.grossAmount,
                  inssRate: item.inssRate,
                  inssAmount: item.inssAmount,
                  deductionsAmount: item.deductionsAmount,
                  netAmount: item.netAmount,
                  carryOverDebt: item.carryOverDebt,
                }))}
              />
            </CardContent>
          </Card>

          {!closedId && (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                <p className="font-medium">Pronto para oficializar {formatPeriod(period)}?</p>
                <p className="text-muted-foreground">
                  Percentuais vigentes: Reserva Legal {formatPercent(settings.legalReserveRate)}, FATES {formatPercent(settings.fatesRate)}
                  {settingsVersion?.isLegalDefault ? " (mínimos legais)" : ""}, INSS {formatPercent(settings.inssRate)}. Depois de fechar, o mês fica bloqueado.
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
            ? `${formatMoney(simulated.distributedTotal)} serão rateados entre ${simulated.items.filter((i) => i.workedDays > 0).length} cooperados com diária de ${formatMoney(simulated.dayValue)}.${simulated.inssTotal > 0 ? ` ${formatMoney(simulated.inssTotal)} de INSS serão retidos para a cooperativa recolher.` : ""} Vales pendentes (${formatMoney(simulated.totalDeductions)}) serão descontados. Esta ação bloqueia chamada, vendas, compras, despesas e vales do mês.`
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
