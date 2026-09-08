"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCheckIcon, DownloadIcon, FileTextIcon, RotateCcwIcon, SearchXIcon, UnlockIcon } from "lucide-react"

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
import { TableCell, TableHead } from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { PayoutSummaryCards, PayoutTable } from "@/components/payout-summary"
import { useDetailLabel } from "@/components/shell-context"
import { errorMessage } from "@/lib/demo/errors"
import { toPayoutSettings, useDemo } from "@/lib/demo/store"
import { PAYOUT_STATUS_LABEL } from "@/lib/demo/types"
import { formatDateTime, formatMoney, formatPercent, formatPeriod } from "@/lib/format"
import { useActor } from "@/lib/use-actor"

export function PayoutDetailScreen({ id }: { id: string }) {
  const { data, actions } = useDemo()
  const actor = useActor()
  const payout = data.payouts.find((p) => p.id === id)
  useDetailLabel(payout ? formatPeriod(payout.period) : undefined)

  const [reopenOpen, setReopenOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [busyItem, setBusyItem] = React.useState<string | null>(null)
  const [busyAll, setBusyAll] = React.useState(false)

  if (!payout) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Fechamento não encontrado</EmptyTitle>
          <EmptyDescription>O link pode estar errado ou os dados de demonstração foram redefinidos.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/fechamento/historico" />} nativeButton={false}>
            Voltar ao histórico
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const settings = toPayoutSettings(payout.settingsSnapshot)
  const isClosed = payout.status === "closed"
  const payable = payout.items.filter((i) => i.netAmount > 0)
  const paidCount = payable.filter((i) => i.paidAt).length
  const paidPercent = payable.length ? Math.round((paidCount / payable.length) * 100) : 0
  const deductedAdvances = data.advances.filter((a) => a.deductedInPayoutId === payout.id)

  async function togglePaid(itemId: string, paid: boolean) {
    setBusyItem(itemId)
    try {
      await actions.setItemPaid(payout!.id, itemId, paid)
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível atualizar", description: errorMessage(error) })
    } finally {
      setBusyItem(null)
    }
  }

  async function markAll() {
    setBusyAll(true)
    try {
      await actions.setAllPaid(payout!.id)
      toast.add({ type: "success", title: "Todos marcados como pagos" })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível atualizar", description: errorMessage(error) })
    } finally {
      setBusyAll(false)
    }
  }

  async function handleReopen() {
    try {
      await actions.reopenPayout(payout!.id, reason, actor)
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

  function exportCsv() {
    const header = ["Cooperado", "Dias", "Bruto", "Vales", "Liquido", "Saldo devedor", "Pago em"]
    const lines = payout!.items.map((i) =>
      [
        i.memberNameSnapshot,
        i.workedDays,
        i.grossAmount.toFixed(2).replace(".", ","),
        i.deductionsAmount.toFixed(2).replace(".", ","),
        i.netAmount.toFixed(2).replace(".", ","),
        i.carryOverDebt.toFixed(2).replace(".", ","),
        i.paidAt ? formatDateTime(i.paidAt) : "",
      ].join(";"),
    )
    const csv = [header.join(";"), ...lines].join("\n")
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `rateio-${payout!.period}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.add({ type: "success", title: "CSV exportado", description: `rateio-${payout!.period}.csv` })
  }

  function exportPdf() {
    const toastId = toast.add({ type: "loading", title: "Gerando PDF do demonstrativo…" })
    setTimeout(() => {
      toast.update(toastId, {
        type: "info",
        title: "PDF simulado",
        description: "No produto final, o demonstrativo abre aqui pronto para enviar ao contador.",
      })
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Fechamento de ${formatPeriod(payout.period)}`} description={`Fechado em ${formatDateTime(payout.closedAt)} por ${payout.closedBy}.`}>
        <Badge variant={isClosed ? "default" : "outline"}>{PAYOUT_STATUS_LABEL[payout.status]}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <DownloadIcon data-icon="inline-start" />
            Exportar
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={exportCsv}>
                <FileTextIcon />
                Planilha (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}>
                <FileTextIcon />
                Demonstrativo (PDF)
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
              <Button variant="outline" size="sm" onClick={markAll} disabled={busyAll || paidCount === payable.length}>
                <CheckCheckIcon data-icon="inline-start" />
                Marcar todos como pagos
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <PayoutTable
            totals={payout}
            rows={payout.items.map((item) => ({
              key: item.id,
              memberName: item.memberNameSnapshot,
              workedDays: item.workedDays,
              grossAmount: item.grossAmount,
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
                      disabled={!isClosed || busyItem === item.id || busyAll}
                      onCheckedChange={(checked) => void togglePaid(item.id, checked)}
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
              <p className="text-sm text-muted-foreground">Nenhum vale foi descontado.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {deductedAdvances.map((advance) => (
                  <li key={advance.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {data.members.find((m) => m.id === advance.memberId)?.name ?? "—"} · {advance.description}
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
