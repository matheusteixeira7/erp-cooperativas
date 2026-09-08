"use client"

import * as React from "react"
import { ReceiptTextIcon, Trash2Icon, WalletIcon, XCircleIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { ClosedMonthAlert } from "@/components/closed-month-alert"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { PeriodSelect } from "@/components/period-select"
import { TableSkeleton } from "@/components/table-skeleton"
import { currentPeriod, isInPeriod, periodOf, todayIso } from "@/lib/dates"
import { errorMessage } from "@/lib/demo/errors"
import { useRequiredSession } from "@/lib/demo/session"
import { activeMembersOn, closedPayoutFor, useDemo, useSimulatedLoading } from "@/lib/demo/store"
import {
  ADVANCE_KIND_LABEL,
  ADVANCE_STATUS_LABEL,
  EXPENSE_CATEGORY_LABEL,
  type Advance,
  type AdvanceKind,
  type AdvanceStatus,
  type Expense,
  type ExpenseCategory,
} from "@/lib/demo/types"
import { formatDate, formatMoney, formatPeriod, parseDecimal } from "@/lib/format"
import { useActor } from "@/lib/use-actor"

export function FinanceScreen() {
  const { data, resetCount } = useDemo()
  const [period, setPeriod] = React.useState(currentPeriod())
  const [tab, setTab] = React.useState("expenses")
  const loading = useSimulatedLoading(`finance-${period}-${tab}-${resetCount}`)
  const closed = closedPayoutFor(data, period)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Despesas e vales" description="Custos do galpão e adiantamentos aos cooperados. Tudo entra pela data do lançamento.">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="finance-period">Mês</FieldLabel>
          <PeriodSelect id="finance-period" value={period} onValueChange={setPeriod} />
        </Field>
      </PageHeader>

      {closed && <ClosedMonthAlert period={period} payoutId={closed.id} />}

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList>
          <TabsTrigger value="expenses">
            <ReceiptTextIcon data-icon="inline-start" />
            Despesas
          </TabsTrigger>
          <TabsTrigger value="advances">
            <WalletIcon data-icon="inline-start" />
            Vales
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <ExpensesTab period={period} loading={loading} readOnly={Boolean(closed)} />
        </TabsContent>
        <TabsContent value="advances">
          <AdvancesTab period={period} loading={loading} readOnly={Boolean(closed)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------- Despesas ----------------

function ExpensesTab({ period, loading, readOnly }: { period: string; loading: boolean; readOnly: boolean }) {
  const { data, actions } = useDemo()
  const { session } = useRequiredSession()
  const actor = useActor()
  const isManager = session.activeRole === "manager"
  const today = todayIso()

  const [description, setDescription] = React.useState("")
  const [category, setCategory] = React.useState<ExpenseCategory | null>(null)
  const [amount, setAmount] = React.useState("")
  const [incurredOn, setIncurredOn] = React.useState(today)
  const [errors, setErrors] = React.useState<{ description?: string; category?: string; amount?: string; date?: string }>({})
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Expense | null>(null)

  const expenses = React.useMemo(
    () => data.expenses.filter((e) => !e.deletedAt && isInPeriod(e.incurredOn, period)).sort((a, b) => b.incurredOn.localeCompare(a.incurredOn)),
    [data.expenses, period],
  )
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const formClosed = closedPayoutFor(data, periodOf(incurredOn))
  const categoryItems = (Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const value = parseDecimal(amount)
    const next: typeof errors = {}
    if (description.trim().length < 2) next.description = "Descreva a despesa."
    if (!category) next.category = "Escolha a categoria."
    if (value === null || value <= 0) next.amount = "Valor deve ser maior que zero."
    if (!incurredOn || incurredOn > today) next.date = "A data não pode ser futura."
    setErrors(next)
    if (Object.keys(next).length > 0 || !category || value === null) return
    setSaving(true)
    try {
      const created = await actions.createExpense({ description, category, amount: value, incurredOn }, actor)
      toast.add({ type: "success", title: "Despesa lançada", description: `${created.description} · ${formatMoney(created.amount)}` })
      setDescription("")
      setCategory(null)
      setAmount("")
      setIncurredOn(today)
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível lançar a despesa", description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await actions.deleteExpense(deleting.id)
      toast.add({ type: "success", title: "Despesa excluída", description: deleting.description })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível excluir", description: errorMessage(error) })
      throw error
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Lançar despesa</CardTitle>
          <CardDescription>Aluguel, energia, combustível, manutenção, aterro…</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              {formClosed && periodOf(incurredOn) !== period && <ClosedMonthAlert period={periodOf(incurredOn)} payoutId={formClosed.id} />}
              <Field data-invalid={errors.description ? true : undefined}>
                <FieldLabel htmlFor="expense-description">Descrição</FieldLabel>
                <Input id="expense-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Energia elétrica" disabled={saving} aria-invalid={errors.description ? true : undefined} />
                <FieldError>{errors.description}</FieldError>
              </Field>
              <Field data-invalid={errors.category ? true : undefined}>
                <FieldLabel htmlFor="expense-category">Categoria</FieldLabel>
                <Select items={categoryItems} value={category} onValueChange={(v) => setCategory(v)} disabled={saving}>
                  <SelectTrigger id="expense-category" className="w-full" aria-invalid={errors.category ? true : undefined}>
                    <SelectValue placeholder="Escolha a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categoryItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.category}</FieldError>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={errors.amount ? true : undefined}>
                  <FieldLabel htmlFor="expense-amount">Valor (R$)</FieldLabel>
                  <Input id="expense-amount" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={saving} aria-invalid={errors.amount ? true : undefined} />
                  <FieldError>{errors.amount}</FieldError>
                </Field>
                <Field data-invalid={errors.date ? true : undefined}>
                  <FieldLabel htmlFor="expense-date">Data</FieldLabel>
                  <Input id="expense-date" type="date" max={today} value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} disabled={saving} aria-invalid={errors.date ? true : undefined} />
                  <FieldError>{errors.date}</FieldError>
                </Field>
              </div>
              <Field>
                <Button type="submit" disabled={saving || Boolean(formClosed)}>
                  {saving && <Spinner data-icon="inline-start" />}
                  Lançar despesa
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Despesas de {formatPeriod(period)}</CardTitle>
          <CardDescription>Saem da receita antes do rateio.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : expenses.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptTextIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma despesa em {formatPeriod(period)}</EmptyTitle>
                <EmptyDescription>Lance as contas do galpão pelo formulário ao lado.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {isManager && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(expense.incurredOn)}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">{EXPENSE_CATEGORY_LABEL[expense.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(expense.amount)}</TableCell>
                    {isManager && (
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="Excluir despesa" disabled={readOnly} onClick={() => setDeleting(expense)}>
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={isManager ? 3 : 3} className="font-medium">
                    Total do mês
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
                  {isManager && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir esta despesa?"
        description={deleting ? `${deleting.description}, ${formatDate(deleting.incurredOn)}, ${formatMoney(deleting.amount)}. Ela sai dos cálculos do mês.` : ""}
        confirmLabel="Excluir despesa"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ---------------- Vales ----------------

function AdvancesTab({ period, loading, readOnly }: { period: string; loading: boolean; readOnly: boolean }) {
  const { data, actions } = useDemo()
  const { session } = useRequiredSession()
  const actor = useActor()
  const isManager = session.activeRole === "manager"
  const today = todayIso()

  const [memberId, setMemberId] = React.useState<string | null>(null)
  const [kind, setKind] = React.useState<AdvanceKind | null>(null)
  const [description, setDescription] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [grantedOn, setGrantedOn] = React.useState(today)
  const [errors, setErrors] = React.useState<{ member?: string; kind?: string; amount?: string; date?: string }>({})
  const [saving, setSaving] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<AdvanceStatus>("pending")
  const [cancelling, setCancelling] = React.useState<Advance | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")

  const members = activeMembersOn(data.members, today).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const memberItems = members.map((m) => ({ value: m.id, label: m.name }))
  const kindItems = (["cash_advance", "purchase", "other"] as AdvanceKind[]).map((k) => ({ value: k, label: ADVANCE_KIND_LABEL[k] }))
  const memberName = (id: string) => data.members.find((m) => m.id === id)?.name ?? "—"

  const advances = React.useMemo(
    () =>
      data.advances
        .filter((a) => isInPeriod(a.grantedOn, period) && a.status === statusFilter)
        .sort((a, b) => b.grantedOn.localeCompare(a.grantedOn)),
    [data.advances, period, statusFilter],
  )
  const total = advances.reduce((sum, a) => sum + a.amount, 0)
  const formClosed = closedPayoutFor(data, periodOf(grantedOn))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const value = parseDecimal(amount)
    const next: typeof errors = {}
    if (!memberId) next.member = "Escolha o cooperado."
    if (!kind) next.kind = "Escolha o tipo."
    if (value === null || value <= 0) next.amount = "Valor deve ser maior que zero."
    if (!grantedOn || grantedOn > today) next.date = "A data não pode ser futura."
    setErrors(next)
    if (Object.keys(next).length > 0 || !memberId || !kind || value === null) return
    setSaving(true)
    try {
      const created = await actions.createAdvance(
        { memberId, kind, description: description || ADVANCE_KIND_LABEL[kind], amount: value, grantedOn },
        actor,
      )
      toast.add({
        type: "success",
        title: "Vale registrado",
        description: `${memberName(created.memberId)} · ${formatMoney(created.amount)} · desconta em ${formatPeriod(periodOf(created.grantedOn))}`,
      })
      setMemberId(null)
      setKind(null)
      setDescription("")
      setAmount("")
      setGrantedOn(today)
      setStatusFilter("pending")
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível registrar o vale", description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!cancelling) return
    try {
      await actions.cancelAdvance(cancelling.id, cancelReason)
      toast.add({ type: "success", title: "Vale cancelado", description: `${memberName(cancelling.memberId)} · ${formatMoney(cancelling.amount)}` })
      setCancelReason("")
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível cancelar", description: errorMessage(error) })
      throw error
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Registrar vale</CardTitle>
          <CardDescription>Adiantamento ou compra individual, descontado no fechamento do mês da data.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              {formClosed && periodOf(grantedOn) !== period && <ClosedMonthAlert period={periodOf(grantedOn)} payoutId={formClosed.id} />}
              <Field data-invalid={errors.member ? true : undefined}>
                <FieldLabel htmlFor="advance-member">Cooperado</FieldLabel>
                <Select items={memberItems} value={memberId} onValueChange={(v) => setMemberId(v)} disabled={saving}>
                  <SelectTrigger id="advance-member" className="w-full" aria-invalid={errors.member ? true : undefined}>
                    <SelectValue placeholder="Escolha o cooperado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {memberItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.member}</FieldError>
              </Field>
              <Field data-invalid={errors.kind ? true : undefined}>
                <FieldLabel htmlFor="advance-kind">Tipo</FieldLabel>
                <Select items={kindItems} value={kind} onValueChange={(v) => setKind(v)} disabled={saving}>
                  <SelectTrigger id="advance-kind" className="w-full" aria-invalid={errors.kind ? true : undefined}>
                    <SelectValue placeholder="Escolha o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {kindItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.kind}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="advance-description">Descrição</FieldLabel>
                <Input id="advance-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Vale mercado" disabled={saving} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={errors.amount ? true : undefined}>
                  <FieldLabel htmlFor="advance-amount">Valor (R$)</FieldLabel>
                  <Input id="advance-amount" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={saving} aria-invalid={errors.amount ? true : undefined} />
                  <FieldError>{errors.amount}</FieldError>
                </Field>
                <Field data-invalid={errors.date ? true : undefined}>
                  <FieldLabel htmlFor="advance-date">Data</FieldLabel>
                  <Input id="advance-date" type="date" max={today} value={grantedOn} onChange={(e) => setGrantedOn(e.target.value)} disabled={saving} aria-invalid={errors.date ? true : undefined} />
                  <FieldError>{errors.date}</FieldError>
                </Field>
              </div>
              <Field>
                <Button type="submit" disabled={saving || Boolean(formClosed)}>
                  {saving && <Spinner data-icon="inline-start" />}
                  Confirmar vale
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Vales de {formatPeriod(period)}</CardTitle>
          <CardDescription>Pendentes são descontados no fechamento deste mês.</CardDescription>
          <div className="pt-2">
            <ToggleGroup
              value={[statusFilter]}
              onValueChange={(value) => {
                const next = value[0] as AdvanceStatus | undefined
                if (next) setStatusFilter(next)
              }}
              variant="outline"
              aria-label="Filtrar por situação"
            >
              <ToggleGroupItem value="pending">Pendentes</ToggleGroupItem>
              <ToggleGroupItem value="deducted">Descontados</ToggleGroupItem>
              <ToggleGroupItem value="cancelled">Cancelados</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : advances.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WalletIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum vale {ADVANCE_STATUS_LABEL[statusFilter].toLowerCase()} em {formatPeriod(period)}</EmptyTitle>
                <EmptyDescription>
                  {statusFilter === "pending" ? "Registre um vale pelo formulário ao lado." : "Troque o filtro para ver outras situações."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cooperado</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {isManager && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(advance.grantedOn)}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {memberName(advance.memberId)}
                        {advance.kind === "carry_over" && <Badge variant="outline">saldo de mês anterior</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex flex-col">
                        <span>{advance.description}</span>
                        <span className="text-xs text-muted-foreground">
                          {ADVANCE_KIND_LABEL[advance.kind]}
                          {advance.status === "cancelled" && advance.cancelReason ? ` · Motivo: ${advance.cancelReason}` : ""}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(advance.amount)}</TableCell>
                    {isManager && (
                      <TableCell>
                        {advance.status === "pending" && (
                          <Button variant="ghost" size="icon-sm" aria-label="Cancelar vale" disabled={readOnly} onClick={() => setCancelling(advance)}>
                            <XCircleIcon />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    {statusFilter === "pending" ? "Total a descontar" : "Total"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(total)}</TableCell>
                  {isManager && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null)
            setCancelReason("")
          }
        }}
        title="Cancelar este vale?"
        description={
          cancelling
            ? `${memberName(cancelling.memberId)}, ${formatMoney(cancelling.amount)}, ${formatDate(cancelling.grantedOn)}. O vale deixa de ser descontado no fechamento.`
            : ""
        }
        confirmLabel="Cancelar vale"
        destructive
        disabled={cancelReason.trim().length < 5}
        onConfirm={handleCancel}
      >
        <Field data-invalid={cancelReason.length > 0 && cancelReason.trim().length < 5 ? true : undefined}>
          <FieldLabel htmlFor="cancel-reason">Motivo</FieldLabel>
          <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex.: lançado em duplicidade" rows={3} />
          <FieldError>{cancelReason.length > 0 && cancelReason.trim().length < 5 ? "Descreva o motivo com pelo menos 5 caracteres." : null}</FieldError>
        </Field>
      </ConfirmDialog>
    </div>
  )
}
