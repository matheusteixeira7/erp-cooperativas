"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckCheckIcon, DownloadIcon, FileTextIcon, LandmarkIcon, RotateCcwIcon, SearchXIcon, UnlockIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TableCell, TableHead } from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { PayoutSummaryCards, PayoutTable } from "@/components/payout-summary"
import { QueryError } from "@/components/query-error"
import { useDetailLabel } from "@/components/shell-context"
import { PAYOUT_STATUS_LABEL } from "@/lib/domain/enums"
import type { PayoutSettings } from "@/lib/domain/payout"
import { downloadBase64File } from "@/lib/download"
import { formatDateTime, formatMoney, formatPercent, formatPeriod } from "@/lib/format"
import { useTRPC, useTRPCClient } from "@/lib/trpc/client"
import { domainCodeOf, errorMessage } from "@/lib/trpc/errors"
import { useInvalidateAll } from "@/lib/trpc/hooks"

export function PayoutDetailScreen({ id }: { id: string }) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const invalidateAll = useInvalidateAll()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const query = useQuery(trpc.payouts.byId.queryOptions({ id }, { enabled: isUuid, retry: false }))
  const payout = query.data ?? null
  useDetailLabel(payout ? formatPeriod(payout.period) : undefined)

  const markPaid = useMutation(trpc.payouts.markPaid.mutationOptions())
  const markAllPaid = useMutation(trpc.payouts.markAllPaid.mutationOptions())
  const reopen = useMutation(trpc.payouts.reopen.mutationOptions())

  const [reopenOpen, setReopenOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [busyItem, setBusyItem] = React.useState<string | null>(null)
  const [exporting, setExporting] = React.useState<string | null>(null)

  if (!isUuid || (query.isError && domainCodeOf(query.error) === "PAYOUT_NOT_FOUND")) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Fechamento não encontrado</EmptyTitle>
          <EmptyDescription>O link pode estar errado ou o fechamento pertence a outra cooperativa.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/fechamento/historico" />} nativeButton={false}>
            Voltar ao histórico
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (query.isError) {
    return <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} title="Não foi possível carregar o fechamento" className="flex-1 border" />
  }

  if (!payout) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const settings: PayoutSettings = {
    legalReserveRate: payout.settingsSnapshot.legalReserveRate,
    fatesRate: payout.settingsSnapshot.fatesRate,
    otherFundsRate: payout.settingsSnapshot.otherFundsRate,
    inssRate: payout.settingsSnapshot.inssRate,
    negativeBalancePolicy: payout.settingsSnapshot.negativeBalancePolicy,
    includeMembersLeftInPeriod: payout.settingsSnapshot.includeMembersLeftInPeriod,
  }
  const isClosed = payout.status === "closed"
  const payable = payout.items.filter((i) => i.netAmount > 0)
  const paidCount = payable.filter((i) => i.paidAt).length
  const paidPercent = payable.length ? Math.round((paidCount / payable.length) * 100) : 0
  const deductedAdvances = payout.deductedAdvances

  async function togglePaid(memberId: string, itemId: string, paid: boolean) {
    setBusyItem(itemId)
    try {
      await markPaid.mutateAsync({ payoutId: id, memberIds: [memberId], paid })
      await invalidateAll()
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível atualizar", description: errorMessage(error) })
    } finally {
      setBusyItem(null)
    }
  }

  async function markAll() {
    try {
      await markAllPaid.mutateAsync({ payoutId: id })
      await invalidateAll()
      toast.add({ type: "success", title: "Todos marcados como pagos" })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível atualizar", description: errorMessage(error) })
    }
  }

  async function handleReopen() {
    try {
      await reopen.mutateAsync({ id, reason })
      await invalidateAll()
      toast.add({
        type: "success",
        title: `${formatPeriod(payout!.period)} reaberto`,
        description: "Lançamentos liberados. Vales voltaram a pendentes. Feche o mês novamente quando terminar.",
      })
      setReason("")
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível reabrir", description: errorMessage(error) })
      throw error
    }
  }

  async function exportFile(format: "csv" | "pdf", report: "payout" | "inss") {
    const key = `${report}-${format}`
    setExporting(key)
    const toastId = toast.add({ type: "loading", title: report === "inss" ? "Gerando relatório de INSS…" : format === "pdf" ? "Gerando PDF do demonstrativo…" : "Gerando planilha…" })
    try {
      const file = await client.payouts.export.query({ id, format, report })
      downloadBase64File(file)
      toast.update(toastId, { type: "success", title: "Arquivo gerado", description: file.filename })
    } catch (error) {
      toast.update(toastId, { type: "error", title: "Não foi possível exportar", description: errorMessage(error) })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Fechamento de ${formatPeriod(payout.period)}`} description={`Fechado em ${formatDateTime(payout.closedAt)} por ${payout.closedBy}.`}>
        <Badge variant={isClosed ? "default" : "outline"}>{PAYOUT_STATUS_LABEL[payout.status]}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={exporting !== null} />}>
            <DownloadIcon data-icon="inline-start" />
            Exportar
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void exportFile("csv", "payout")}>
                <FileTextIcon />
                Planilha (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportFile("pdf", "payout")}>
                <FileTextIcon />
                Demonstrativo (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportFile("csv", "inss")} disabled={payout.inssTotal === 0}>
                <LandmarkIcon />
                INSS do mês para o contador (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportFile("pdf", "inss")} disabled={payout.inssTotal === 0}>
                <LandmarkIcon />
                INSS do mês para o contador (PDF)
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {isClosed && (
          <Button variant="outline" onClick={() => setReopenOpen(true)}>
            <UnlockIcon data-icon="inline-start" />
            Reabrir mês
          </Button>
        )}
      </PageHeader>

      {!isClosed && (
        <Alert>
          <RotateCcwIcon />
          <AlertTitle>Este fechamento foi reaberto</AlertTitle>
          <AlertDescription>
            <p>
              {payout.reopenedBy} reabriu em {payout.reopenedAt ? formatDateTime(payout.reopenedAt) : "—"}. Motivo: “{payout.reopenReason}”.
            </p>
            <p>Os valores abaixo são o registro histórico. O mês precisa ser fechado novamente.</p>
            <div className="pt-2">
              <Button size="sm" render={<Link href="/fechamento" />} nativeButton={false}>
                Fechar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <PayoutSummaryCards totals={payout} settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle>Demonstrativo por cooperado</CardTitle>
          <CardDescription>
            Depois de fazer o PIX, marque cada cooperado como pago. {payout.roundingResidual > 0 && `Resíduo de arredondamento: ${formatMoney(payout.roundingResidual)}.`}
          </CardDescription>
          {isClosed && (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Progress value={paidPercent} className="max-w-xs">
                <ProgressLabel>
                  {paidCount} de {payable.length} pagos
                </ProgressLabel>
              </Progress>
              <Button variant="outline" size="sm" onClick={markAll} disabled={markAllPaid.isPending || paidCount === payable.length}>
                <CheckCheckIcon data-icon="inline-start" />
                Marcar todos como pagos
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <PayoutTable
            totals={payout}
            showInss={settings.inssRate > 0 || payout.inssTotal > 0}
            rows={payout.items.map((item) => ({
              key: item.id,
              memberName: item.memberNameSnapshot,
              workedDays: item.workedDays,
              grossAmount: item.grossAmount,
              inssRate: item.inssRate,
              inssAmount: item.inssAmount,
              deductionsAmount: item.deductionsAmount,
              netAmount: item.netAmount,
              carryOverDebt: item.carryOverDebt,
            }))}
            headStart={<TableHead className="w-16">Pago</TableHead>}
            renderRowStart={(row) => {
              const item = payout.items.find((i) => i.id === row.key)!
              return (
                <TableCell>
                  {item.netAmount > 0 ? (
                    <Checkbox
                      aria-label={`Marcar ${item.memberNameSnapshot} como pago`}
                      checked={Boolean(item.paidAt)}
                      disabled={!isClosed || busyItem === item.id || markAllPaid.isPending}
                      onCheckedChange={(checked) => void togglePaid(item.memberId, item.id, checked)}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros usados</CardTitle>
            <CardDescription>Copiados no momento do fechamento. Mudanças futuras não alteram este mês.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Reserva Legal</dt>
              <dd className="text-right tabular-nums">{formatPercent(settings.legalReserveRate)}</dd>
              <dt className="text-muted-foreground">FATES</dt>
              <dd className="text-right tabular-nums">{formatPercent(settings.fatesRate)}</dd>
              <dt className="text-muted-foreground">Outros fundos</dt>
              <dd className="text-right tabular-nums">{formatPercent(settings.otherFundsRate)}</dd>
              <dt className="text-muted-foreground">INSS do cooperado</dt>
              <dd className="text-right tabular-nums">{settings.inssRate > 0 ? `${formatPercent(settings.inssRate)} sobre o bruto` : "Sem desconto"}</dd>
              <dt className="text-muted-foreground">Vale maior que o bruto</dt>
              <dd className="text-right">{settings.negativeBalancePolicy === "carry_over" ? "Passa para o próximo mês" : "Perdoado"}</dd>
              <dt className="text-muted-foreground">Desligados no mês</dt>
              <dd className="text-right">{settings.includeMembersLeftInPeriod ? "Recebem pelos dias trabalhados" : "Ficam fora"}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vales descontados neste fechamento</CardTitle>
            <CardDescription>{deductedAdvances.length} vale(s) somando {formatMoney(deductedAdvances.reduce((s, a) => s + a.amount, 0))}.</CardDescription>
          </CardHeader>
          <CardContent>
            {deductedAdvances.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isClosed ? "Nenhum vale foi descontado." : "Os vales voltaram a pendentes quando o mês foi reaberto."}</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {deductedAdvances.map((advance) => (
                  <li key={advance.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {advance.memberName} · {advance.description}
                    </span>
                    <span className="tabular-nums">{formatMoney(advance.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={(open) => {
          setReopenOpen(open)
          if (!open) setReason("")
        }}
        title={`Reabrir ${formatPeriod(payout.period)}?`}
        description="Os lançamentos do mês voltam a ficar editáveis, os vales descontados voltam a pendentes e saldos devedores gerados são cancelados. Este registro permanece no histórico como “Reaberto” e um novo fechamento será criado quando você fechar de novo."
        confirmLabel="Reabrir mês"
        destructive
        disabled={reason.trim().length < 10}
        onConfirm={handleReopen}
      >
        <Field data-invalid={reason.length > 0 && reason.trim().length < 10 ? true : undefined}>
          <FieldLabel htmlFor="reopen-reason">Motivo da reabertura</FieldLabel>
          <Textarea id="reopen-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: faltou lançar a venda do dia 28" />
          <FieldDescription>Mínimo de 10 caracteres. Fica registrado na auditoria.</FieldDescription>
          <FieldError>{reason.length > 0 && reason.trim().length < 10 ? "Descreva melhor o motivo." : null}</FieldError>
        </Field>
      </ConfirmDialog>
    </div>
  )
}
