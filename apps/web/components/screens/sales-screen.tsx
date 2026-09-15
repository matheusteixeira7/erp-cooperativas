"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { EyeIcon, PackageIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { ClosedMonthAlert } from "@/components/closed-month-alert"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { MaterialSelect } from "@/components/material-select"
import { PageHeader } from "@/components/page-header"
import { PurchasesSection } from "@/components/screens/purchases-section"
import { PeriodSelect } from "@/components/period-select"
import { QueryError } from "@/components/query-error"
import { TableSkeleton } from "@/components/table-skeleton"
import { currentPeriod, periodOf, todayIso } from "@/lib/dates"
import { MATERIAL_CONDITION_LABEL, type MaterialCondition } from "@/lib/domain/enums"
import { itemSubtotal } from "@/lib/domain/payout"
import { formatDate, formatMoney, formatPricePerKg, formatShortDate, formatWeight, parseDecimal } from "@/lib/format"
import { useRequiredSession } from "@/lib/session"
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client"
import { errorMessage } from "@/lib/trpc/errors"
import { useInvalidateAll } from "@/lib/trpc/hooks"

type Buyer = RouterOutputs["buyers"]["list"][number]
type Sale = RouterOutputs["sales"]["list"]["items"][number]
type DraftItem = { key: string; materialTypeId: string; condition: MaterialCondition; weightKg: number; pricePerKg: number; subtotal: number }

export function SalesScreen() {
  const trpc = useTRPC()
  const invalidateAll = useInvalidateAll()
  const { session } = useRequiredSession()
  const today = todayIso()
  const isManager = session.activeRole === "manager"

  // --- list ---
  const [period, setPeriod] = React.useState(currentPeriod())
  const salesQuery = useQuery(trpc.sales.list.queryOptions({ period, limit: 100 }))
  const buyersQuery = useQuery(trpc.buyers.list.queryOptions({ includeInactive: false }))
  const materialsQuery = useQuery(trpc.materialTypes.list.queryOptions({ includeInactive: false }))
  const sales = salesQuery.data?.items ?? []
  const [viewing, setViewing] = React.useState<Sale | null>(null)
  const [deleting, setDeleting] = React.useState<Sale | null>(null)

  // --- form ---
  const [buyer, setBuyer] = React.useState<Buyer | null>(null)
  const [soldOn, setSoldOn] = React.useState(today)
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [materialTypeId, setMaterialTypeId] = React.useState<string | null>(null)
  const [condition, setCondition] = React.useState<MaterialCondition>("baled")
  const [weight, setWeight] = React.useState("")
  const [price, setPrice] = React.useState("")
  const [items, setItems] = React.useState<DraftItem[]>([])
  const [itemErrors, setItemErrors] = React.useState<{ material?: string; weight?: string; price?: string }>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [newBuyerOpen, setNewBuyerOpen] = React.useState(false)
  const weightRef = React.useRef<HTMLInputElement>(null)

  const formPeriod = periodOf(soldOn)
  const formStatusQuery = useQuery(trpc.payouts.periodStatus.queryOptions({ period: formPeriod }, { enabled: /^\d{4}-\d{2}$/.test(formPeriod) }))
  const formClosed = formStatusQuery.data?.closed ? formStatusQuery.data : null
  const listClosed = salesQuery.data?.periodClosed ? salesQuery.data : null
  const activeBuyers = buyersQuery.data ?? []
  const activeMaterials = materialsQuery.data ?? []
  const materialName = (id: string) => activeMaterials.find((m) => m.id === id)?.name ?? "—"
  const conditionLabel = (value: MaterialCondition) => MATERIAL_CONDITION_LABEL[value].toLowerCase()

  const suggestionQuery = useQuery(
    trpc.materialTypes.lastPrice.queryOptions(
      { materialTypeId: materialTypeId ?? "", condition, buyerId: buyer?.id ?? "" },
      { enabled: Boolean(buyer && materialTypeId) },
    ),
  )
  const priceSuggestion = buyer && materialTypeId ? (suggestionQuery.data ?? null) : null

  const createSale = useMutation(trpc.sales.create.mutationOptions())
  const deleteSale = useMutation(trpc.sales.delete.mutationOptions())
  const saving = createSale.isPending

  const totalWeight = items.reduce((sum, i) => sum + i.weightKg, 0)
  const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0)

  function addItem() {
    const weightKg = parseDecimal(weight)
    const pricePerKg = parseDecimal(price)
    const errors: typeof itemErrors = {}
    if (!materialTypeId) errors.material = "Escolha o material."
    if (weightKg === null || weightKg <= 0) errors.weight = "Peso deve ser maior que zero."
    if (pricePerKg === null || pricePerKg <= 0) errors.price = "Preço deve ser maior que zero."
    setItemErrors(errors)
    if (Object.keys(errors).length > 0 || !materialTypeId || weightKg === null || pricePerKg === null) return
    setItems((prev) => [
      ...prev,
      { key: `${Date.now()}-${prev.length}`, materialTypeId, condition, weightKg, pricePerKg, subtotal: itemSubtotal(weightKg, pricePerKg) },
    ])
    setWeight("")
    setPrice("")
    setFormError(null)
    weightRef.current?.focus()
  }

  function resetForm() {
    setBuyer(null)
    setSoldOn(today)
    setInvoiceNumber("")
    setMaterialTypeId(null)
    setWeight("")
    setPrice("")
    setItems([])
    setItemErrors({})
    setFormError(null)
  }

  async function handleSubmit() {
    if (!buyer) {
      setFormError("Escolha o comprador antes de finalizar.")
      return
    }
    if (items.length === 0) {
      setFormError("Adicione pelo menos um material.")
      return
    }
    try {
      const sale = await createSale.mutateAsync({
        buyerId: buyer.id,
        soldOn,
        items: items.map(({ materialTypeId, condition, weightKg, pricePerKg }) => ({ materialTypeId, condition, weightKg, pricePerKg })),
        invoiceNumber,
      })
      toast.add({
        type: "success",
        title: "Venda registrada",
        description: `${sale.buyerName} · ${formatWeight(sale.totalWeightKg)} · ${formatMoney(sale.totalAmount)}`,
      })
      resetForm()
      setPeriod(periodOf(sale.soldOn))
      await invalidateAll()
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível registrar a venda", description: errorMessage(error) })
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteSale.mutateAsync({ id: deleting.id })
      await invalidateAll()
      toast.add({ type: "success", title: "Venda excluída", description: `${deleting.buyerName} · ${formatDate(deleting.soldOn)}` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível excluir", description: errorMessage(error) })
      throw error
    }
  }

  const disabledForm = Boolean(formClosed) || saving

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendas e compras" description="Em cima, a saída de material para o comprador. Embaixo, o material comprado de catadores e outras cooperativas." />

      <Card>
        <CardHeader>
          <CardTitle>Nova venda</CardTitle>
          <CardDescription>Escolha o comprador, adicione cada material pesado e finalize.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {formClosed && <ClosedMonthAlert period={formPeriod} payoutId={formClosed.payoutId ?? undefined} />}
          {(buyersQuery.isError || materialsQuery.isError) && (
            <QueryError
              error={buyersQuery.error ?? materialsQuery.error}
              onRetry={() => {
                void buyersQuery.refetch()
                void materialsQuery.refetch()
              }}
              retrying={buyersQuery.isFetching || materialsQuery.isFetching}
              title="Não foi possível carregar compradores e materiais"
            />
          )}

          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
              <Field data-invalid={formError && !buyer ? true : undefined}>
                <FieldLabel htmlFor="sale-buyer">Comprador</FieldLabel>
                <div className="flex gap-2">
                  <Combobox
                    items={activeBuyers}
                    value={buyer}
                    onValueChange={(value) => {
                      setBuyer(value)
                      setFormError(null)
                    }}
                    itemToStringLabel={(item: Buyer) => item.name}
                    disabled={disabledForm || buyersQuery.isPending}
                  >
                    <ComboboxInput
                      id="sale-buyer"
                      placeholder={buyersQuery.isPending ? "Carregando compradores…" : "Buscar comprador..."}
                      className="flex-1"
                      showClear
                      aria-invalid={formError && !buyer ? true : undefined}
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>Nenhum comprador com esse nome. Use “Novo comprador”.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: Buyer) => (
                          <ComboboxItem key={item.id} value={item}>
                            <span className="flex flex-col">
                              <span>{item.name}</span>
                              {item.contact && <span className="text-xs text-muted-foreground">{item.contact}</span>}
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <Button type="button" variant="outline" onClick={() => setNewBuyerOpen(true)} disabled={disabledForm}>
                    <PlusIcon data-icon="inline-start" />
                    <span className="hidden sm:inline">Novo comprador</span>
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="sale-date">Data</FieldLabel>
                <Input id="sale-date" type="date" value={soldOn} max={today} onChange={(e) => setSoldOn(e.target.value)} disabled={saving} className="w-full md:w-40" />
              </Field>
              <Field>
                <FieldLabel htmlFor="sale-invoice">Nota fiscal</FieldLabel>
                <Input id="sale-invoice" placeholder="Opcional" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={disabledForm} className="w-full md:w-36" />
              </Field>
            </div>
          </FieldGroup>

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Adicionar material</p>
            <FieldGroup>
              <div className="grid gap-3 md:grid-cols-[2fr_auto_1fr_1fr_auto] md:items-start">
                <Field data-invalid={itemErrors.material ? true : undefined}>
                  <FieldLabel htmlFor="sale-material">Material</FieldLabel>
                  <MaterialSelect
                    id="sale-material"
                    materials={activeMaterials}
                    loading={materialsQuery.isPending}
                    value={materialTypeId}
                    onValueChange={(value) => {
                      setMaterialTypeId(value)
                      const chosen = value ? activeMaterials.find((m) => m.id === value) : undefined
                      if (chosen) setCondition(chosen.defaultCondition)
                      setItemErrors((e) => ({ ...e, material: undefined }))
                    }}
                    disabled={disabledForm}
                    invalid={Boolean(itemErrors.material)}
                  />
                  <FieldError>{itemErrors.material}</FieldError>
                </Field>
                <Field>
                  <FieldLabel id="sale-condition-label">Estado</FieldLabel>
                  <ToggleGroup
                    value={[condition]}
                    onValueChange={(value) => {
                      const next = value[0] as MaterialCondition | undefined
                      if (next) setCondition(next)
                    }}
                    variant="outline"
                    spacing={0}
                    aria-labelledby="sale-condition-label"
                    disabled={disabledForm}
                  >
                    <ToggleGroupItem value="loose" className="min-w-24">
                      {MATERIAL_CONDITION_LABEL.loose}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="baled" className="min-w-24">
                      {MATERIAL_CONDITION_LABEL.baled}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field data-invalid={itemErrors.weight ? true : undefined}>
                  <FieldLabel htmlFor="sale-weight">Peso (kg)</FieldLabel>
                  <Input
                    ref={weightRef}
                    id="sale-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    disabled={disabledForm}
                    aria-invalid={itemErrors.weight ? true : undefined}
                  />
                  <FieldError>{itemErrors.weight}</FieldError>
                </Field>
                <Field data-invalid={itemErrors.price ? true : undefined}>
                  <FieldLabel htmlFor="sale-price">Preço por kg (R$)</FieldLabel>
                  <Input
                    id="sale-price"
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    min="0.0001"
                    placeholder={priceSuggestion ? String(priceSuggestion.pricePerKg) : "0,0000"}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addItem()
                      }
                    }}
                    disabled={disabledForm}
                    aria-invalid={itemErrors.price ? true : undefined}
                  />
                  <FieldError>{itemErrors.price}</FieldError>
                </Field>
                <Field className="md:pt-6">
                  <Button type="button" onClick={addItem} disabled={disabledForm} className="w-full md:w-auto" aria-label="Adicionar material">
                    <PlusIcon data-icon="inline-start" />
                    Adicionar
                  </Button>
                </Field>
              </div>
              <FieldDescription>
                {priceSuggestion ? (
                  <>
                    Último preço com {buyer?.name} para {materialName(materialTypeId ?? "")} {conditionLabel(condition)}:{" "}
                    <button type="button" className="font-medium underline underline-offset-4" onClick={() => setPrice(String(priceSuggestion.pricePerKg))} disabled={disabledForm}>
                      {formatPricePerKg(priceSuggestion.pricePerKg)}
                    </button>{" "}
                    em {formatShortDate(priceSuggestion.on)}. Só sugestão.
                  </>
                ) : suggestionQuery.isFetching ? (
                  "Buscando o último preço praticado…"
                ) : (
                  "Pressione Enter no preço para adicionar rapidamente."
                )}
              </FieldDescription>
            </FieldGroup>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Peso</TableHead>
                <TableHead className="text-right">Preço/kg</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                    Nenhum material adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {materialName(item.materialTypeId)}
                        <Badge variant="outline">{conditionLabel(item.condition)}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatWeight(item.weightKg)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPricePerKg(item.pricePerKg)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(item.subtotal)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remover material"
                        disabled={saving}
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {items.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Total</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatWeight(totalWeight)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(totalAmount)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-muted-foreground">Total da venda</span>
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(totalAmount)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{formatWeight(totalWeight)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetForm} disabled={saving || (items.length === 0 && !buyer)}>
                Limpar
              </Button>
              <Button size="lg" onClick={handleSubmit} disabled={disabledForm || items.length === 0 || !buyer}>
                {saving && <Spinner data-icon="inline-start" />}
                Finalizar venda
              </Button>
            </div>
            {formError && <FieldError>{formError}</FieldError>}
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendas do mês</CardTitle>
          <CardDescription>Lançamentos por data de venda (regime de competência).</CardDescription>
          <div className="pt-2">
            <PeriodSelect value={period} onValueChange={setPeriod} />
          </div>
        </CardHeader>
        <CardContent>
          {listClosed && (
            <div className="mb-4">
              <ClosedMonthAlert period={period} payoutId={listClosed.closedPayoutId ?? undefined} />
            </div>
          )}
          {salesQuery.isPending ? (
            <TableSkeleton rows={3} columns={5} />
          ) : salesQuery.isError ? (
            <QueryError error={salesQuery.error} onRetry={() => void salesQuery.refetch()} retrying={salesQuery.isFetching} title="Não foi possível carregar as vendas" />
          ) : sales.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma venda em {period.slice(5)}/{period.slice(0, 4)}</EmptyTitle>
                <EmptyDescription>Quando um caminhão for carregado, registre a venda no formulário acima.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead className="hidden md:table-cell">Itens</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(sale.soldOn)}</TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium">{sale.buyerName}</span>
                        {sale.invoiceNumber && <span className="text-xs text-muted-foreground">NF {sale.invoiceNumber}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {sale.items.map((item) => (
                          <Badge key={item.id} variant="secondary">
                            {item.materialTypeName} · {conditionLabel(item.condition)}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatWeight(sale.totalWeightKg)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(sale.totalAmount)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Ver detalhes" onClick={() => setViewing(sale)}>
                          <EyeIcon />
                        </Button>
                        {isManager && (
                          <Button variant="ghost" size="icon-sm" aria-label="Excluir venda" disabled={Boolean(listClosed)} onClick={() => setDeleting(sale)}>
                            <Trash2Icon />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    {salesQuery.data.totals.count} venda(s)
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatWeight(salesQuery.data.totals.weightKg)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(salesQuery.data.totals.amount)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Compras</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <PurchasesSection />

      <NewBuyerDialog
        open={newBuyerOpen}
        onOpenChange={setNewBuyerOpen}
        onCreated={(created) => {
          setBuyer(created)
          setFormError(null)
        }}
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>Venda de {formatDate(viewing.soldOn)}</DialogTitle>
                <DialogDescription>
                  {viewing.buyerName}
                  {viewing.invoiceNumber ? ` · NF ${viewing.invoiceNumber}` : ""}
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="text-right">Preço/kg</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewing.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {item.materialTypeName}
                          <Badge variant="outline">{conditionLabel(item.condition)}</Badge>
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatWeight(item.weightKg)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPricePerKg(item.pricePerKg)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatWeight(viewing.totalWeightKg)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold tabular-nums">{formatMoney(viewing.totalAmount)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <DialogFooter showCloseButton />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir esta venda?"
        description={
          deleting
            ? `${deleting.buyerName}, ${formatDate(deleting.soldOn)}, ${formatMoney(deleting.totalAmount)}. A venda sai dos cálculos do mês. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir venda"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

function NewBuyerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (buyer: Buyer) => void
}) {
  const trpc = useTRPC()
  const invalidateAll = useInvalidateAll()
  const createBuyer = useMutation(trpc.buyers.create.mutationOptions())
  const [name, setName] = React.useState("")
  const [cnpj, setCnpj] = React.useState("")
  const [contact, setContact] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const saving = createBuyer.isPending

  function handleOpenChange(next: boolean) {
    if (saving) return
    if (!next) {
      setName("")
      setCnpj("")
      setContact("")
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError("Informe o nome do comprador.")
      return
    }
    const digits = cnpj.replace(/\D/g, "")
    if (digits && digits.length !== 14) {
      setError("CNPJ deve ter 14 dígitos ou ficar em branco.")
      return
    }
    try {
      const created = await createBuyer.mutateAsync({ name, cnpj: digits, contact })
      await invalidateAll()
      toast.add({ type: "success", title: "Comprador cadastrado", description: created.name })
      onCreated(created)
      handleOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Novo comprador</DialogTitle>
            <DialogDescription>Cadastre uma vez e reaproveite nas próximas vendas.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="buyer-name">Nome</FieldLabel>
              <Input
                id="buyer-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                aria-invalid={error ? true : undefined}
                autoFocus
              />
              <FieldError>{error}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="buyer-cnpj">CNPJ</FieldLabel>
              <Input id="buyer-cnpj" inputMode="numeric" placeholder="Opcional" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="buyer-contact">Contato</FieldLabel>
              <Input id="buyer-contact" placeholder="Nome e telefone" value={contact} onChange={(e) => setContact(e.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />} disabled={saving}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Salvar comprador
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
