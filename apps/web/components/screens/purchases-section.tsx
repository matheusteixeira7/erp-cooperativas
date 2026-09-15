"use client"

import * as React from "react"
import { EyeIcon, FileTextIcon, PlusIcon, Trash2Icon, TruckIcon } from "lucide-react"

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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { ClosedMonthAlert } from "@/components/closed-month-alert"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { MaterialSelect } from "@/components/material-select"
import { PeriodSelect } from "@/components/period-select"
import { TableSkeleton } from "@/components/table-skeleton"
import { currentPeriod, isInPeriod, periodOf, todayIso } from "@/lib/dates"
import { errorMessage } from "@/lib/demo/errors"
import { useRequiredSession } from "@/lib/demo/session"
import { closedPayoutFor, lastPricePerKg, useDemo, useSimulatedLoading, type PurchaseDraftItem } from "@/lib/demo/store"
import {
  MATERIAL_CONDITION_LABEL,
  PAYMENT_METHOD_LABEL,
  SUPPLIER_KIND_LABEL,
  type MaterialCondition,
  type PaymentMethod,
  type Purchase,
  type Supplier,
  type SupplierKind,
} from "@/lib/demo/types"
import { itemSubtotal } from "@/lib/domain/payout"
import { formatCpf, formatDate, formatMoney, formatPricePerKg, formatShortDate, formatWeight, maskCpf, parseDecimal } from "@/lib/format"
import { useActor } from "@/lib/use-actor"
import { isValidCpf, isValidPixKey, onlyDigits } from "@/lib/validation"

type DraftItem = PurchaseDraftItem & { key: string; subtotal: number }

function supplierDocument(supplier: Supplier) {
  if (supplier.kind === "company") return supplier.cnpj ? `CNPJ ${supplier.cnpj}` : SUPPLIER_KIND_LABEL.company
  return supplier.cpf ? `CPF ${maskCpf(supplier.cpf)}` : SUPPLIER_KIND_LABEL.individual
}

/** Seção "Compras" da tela de vendas (FL-008). Mesmo layout da venda, em outra cor, para o operador não confundir. */
export function PurchasesSection() {
  const { data, actions, resetCount } = useDemo()
  const { session } = useRequiredSession()
  const actor = useActor()
  const today = todayIso()
  const isManager = session.activeRole === "manager"

  // --- list ---
  const [period, setPeriod] = React.useState(currentPeriod())
  const loading = useSimulatedLoading(`purchases-${period}-${resetCount}`)
  const purchases = React.useMemo(
    () =>
      data.purchases
        .filter((p) => !p.deletedAt && isInPeriod(p.purchasedOn, period))
        .sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn)),
    [data.purchases, period],
  )
  const [viewing, setViewing] = React.useState<Purchase | null>(null)
  const [deleting, setDeleting] = React.useState<Purchase | null>(null)

  // --- form ---
  const [supplier, setSupplier] = React.useState<Supplier | null>(null)
  const [purchasedOn, setPurchasedOn] = React.useState(today)
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash")
  const [paid, setPaid] = React.useState(true)
  const [materialTypeId, setMaterialTypeId] = React.useState<string | null>(null)
  const [condition, setCondition] = React.useState<MaterialCondition>("loose")
  const [weight, setWeight] = React.useState("")
  const [price, setPrice] = React.useState("")
  const [items, setItems] = React.useState<DraftItem[]>([])
  const [itemErrors, setItemErrors] = React.useState<{ material?: string; weight?: string; price?: string }>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [newSupplierOpen, setNewSupplierOpen] = React.useState(false)
  const weightRef = React.useRef<HTMLInputElement>(null)

  const formPeriod = periodOf(purchasedOn)
  const formClosed = closedPayoutFor(data, formPeriod)
  const listClosed = closedPayoutFor(data, period)
  const activeSuppliers = data.suppliers.filter((s) => s.active)
  const activeMaterials = data.materialTypes.filter((m) => m.active)
  const materialName = (id: string) => data.materialTypes.find((m) => m.id === id)?.name ?? "—"
  const supplierById = (id: string) => data.suppliers.find((s) => s.id === id)
  const supplierName = (id: string) => supplierById(id)?.name ?? "—"
  const conditionLabel = (value: MaterialCondition) => MATERIAL_CONDITION_LABEL[value].toLowerCase()
  const priceSuggestion = supplier && materialTypeId ? lastPricePerKg(data, { materialTypeId, condition, supplierId: supplier.id }) : null

  const totalWeight = items.reduce((sum, i) => sum + i.weightKg, 0)
  const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0)

  const bySupplier = React.useMemo(() => {
    const map = new Map<string, { amount: number; weightKg: number; count: number }>()
    for (const purchase of purchases) {
      const entry = map.get(purchase.supplierId) ?? { amount: 0, weightKg: 0, count: 0 }
      entry.amount += purchase.totalAmount
      entry.weightKg += purchase.totalWeightKg
      entry.count += 1
      map.set(purchase.supplierId, entry)
    }
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount)
  }, [purchases])

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
    setSupplier(null)
    setPurchasedOn(today)
    setPaymentMethod("cash")
    setPaid(true)
    setMaterialTypeId(null)
    setWeight("")
    setPrice("")
    setItems([])
    setItemErrors({})
    setFormError(null)
  }

  async function handleSubmit() {
    if (!supplier) {
      setFormError("Escolha o fornecedor antes de finalizar.")
      return
    }
    if (items.length === 0) {
      setFormError("Adicione pelo menos um material.")
      return
    }
    setSaving(true)
    try {
      const purchase = await actions.createPurchase(
        {
          supplierId: supplier.id,
          purchasedOn,
          items: items.map(({ materialTypeId, condition, weightKg, pricePerKg }) => ({ materialTypeId, condition, weightKg, pricePerKg })),
          paymentMethod,
          paidOn: paid ? purchasedOn : null,
          note: "",
        },
        actor,
      )
      toast.add({
        type: "success",
        title: "Compra registrada",
        description: `${supplier.name} · ${formatWeight(purchase.totalWeightKg)} · ${formatMoney(purchase.totalAmount)} · ${PAYMENT_METHOD_LABEL[purchase.paymentMethod]}${purchase.paidOn ? "" : " (a pagar)"}`,
      })
      resetForm()
      setPeriod(periodOf(purchase.purchasedOn))
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível registrar a compra", description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await actions.deletePurchase(deleting.id)
      toast.add({ type: "success", title: "Compra excluída", description: `${supplierName(deleting.supplierId)} · ${formatDate(deleting.purchasedOn)}` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível excluir", description: errorMessage(error) })
      throw error
    }
  }

  function printReceipt(purchase: Purchase) {
    const toastId = toast.add({ type: "loading", title: "Gerando recibo em PDF…" })
    setTimeout(() => {
      toast.update(toastId, {
        type: "info",
        title: "Recibo simulado",
        description: `No produto final, abre aqui o recibo de ${formatMoney(purchase.totalAmount)} para ${supplierName(purchase.supplierId)} assinar.`,
      })
    }, 1200)
  }

  const disabledForm = Boolean(formClosed) || saving

  return (
    <>
      <Card className="border-orange-300/70 dark:border-orange-700/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TruckIcon className="size-5 text-orange-600 dark:text-orange-400" />
            Nova compra de material
          </CardTitle>
          <CardDescription>
            Material comprado de catador avulso, outra cooperativa ou gerador. Entra como custo do mês e reduz a sobra, em linha separada das despesas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {formClosed && <ClosedMonthAlert period={formPeriod} payoutId={formClosed.id} />}

          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <Field data-invalid={formError && !supplier ? true : undefined}>
                <FieldLabel htmlFor="purchase-supplier">Fornecedor</FieldLabel>
                <div className="flex gap-2">
                  <Combobox
                    items={activeSuppliers}
                    value={supplier}
                    onValueChange={(value) => {
                      setSupplier(value)
                      setFormError(null)
                    }}
                    itemToStringLabel={(item: Supplier) => item.name}
                    disabled={disabledForm}
                  >
                    <ComboboxInput id="purchase-supplier" placeholder="Buscar fornecedor..." className="flex-1" showClear aria-invalid={formError && !supplier ? true : undefined} />
                    <ComboboxContent>
                      <ComboboxEmpty>Nenhum fornecedor com esse nome. Use “Novo fornecedor”.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: Supplier) => (
                          <ComboboxItem key={item.id} value={item}>
                            <span className="flex flex-col">
                              <span>{item.name}</span>
                              <span className="text-xs text-muted-foreground">{supplierDocument(item)}</span>
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <Button type="button" variant="outline" onClick={() => setNewSupplierOpen(true)} disabled={disabledForm}>
                    <PlusIcon data-icon="inline-start" />
                    <span className="hidden sm:inline">Novo fornecedor</span>
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="purchase-date">Data</FieldLabel>
                <Input id="purchase-date" type="date" value={purchasedOn} max={today} onChange={(e) => setPurchasedOn(e.target.value)} disabled={saving} className="w-full md:w-40" />
              </Field>
            </div>
          </FieldGroup>

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Adicionar material</p>
            <FieldGroup>
              <div className="grid gap-3 md:grid-cols-[2fr_auto_1fr_1fr_auto] md:items-start">
                <Field data-invalid={itemErrors.material ? true : undefined}>
                  <FieldLabel htmlFor="purchase-material">Material</FieldLabel>
                  <MaterialSelect
                    id="purchase-material"
                    materials={activeMaterials}
                    value={materialTypeId}
                    onValueChange={(value) => {
                      setMaterialTypeId(value)
                      setItemErrors((e) => ({ ...e, material: undefined }))
                    }}
                    disabled={disabledForm}
                    invalid={Boolean(itemErrors.material)}
                  />
                  <FieldError>{itemErrors.material}</FieldError>
                </Field>
                <Field>
                  <FieldLabel id="purchase-condition-label">Estado</FieldLabel>
                  <ToggleGroup
                    value={[condition]}
                    onValueChange={(value) => {
                      const next = value[0] as MaterialCondition | undefined
                      if (next) setCondition(next)
                    }}
                    variant="outline"
                    spacing={0}
                    aria-labelledby="purchase-condition-label"
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
                  <FieldLabel htmlFor="purchase-weight">Peso (kg)</FieldLabel>
                  <Input
                    ref={weightRef}
                    id="purchase-weight"
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
                  <FieldLabel htmlFor="purchase-price">Preço por kg (R$)</FieldLabel>
                  <Input
                    id="purchase-price"
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
                  <Button type="button" onClick={addItem} disabled={disabledForm} className="w-full md:w-auto" aria-label="Adicionar material à compra">
                    <PlusIcon data-icon="inline-start" />
                    Adicionar
                  </Button>
                </Field>
              </div>
              <FieldDescription>
                {priceSuggestion ? (
                  <>
                    Último preço pago a {supplier?.name} por {materialName(materialTypeId ?? "")} {conditionLabel(condition)}:{" "}
                    <button type="button" className="font-medium underline underline-offset-4" onClick={() => setPrice(String(priceSuggestion.pricePerKg))} disabled={disabledForm}>
                      {formatPricePerKg(priceSuggestion.pricePerKg)}
                    </button>{" "}
                    em {formatShortDate(priceSuggestion.on)}. Só sugestão.
                  </>
                ) : (
                  "Compra de catador costuma ser material solto. Pressione Enter no preço para adicionar rapidamente."
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

          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel id="purchase-payment-label">Forma de pagamento</FieldLabel>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  aria-labelledby="purchase-payment-label"
                  className="flex flex-row gap-4"
                  disabled={disabledForm}
                >
                  <FieldLabel htmlFor="payment-cash" className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="cash" id="payment-cash" />
                    {PAYMENT_METHOD_LABEL.cash}
                  </FieldLabel>
                  <FieldLabel htmlFor="payment-pix" className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="pix" id="payment-pix" />
                    {PAYMENT_METHOD_LABEL.pix}
                  </FieldLabel>
                </RadioGroup>
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Já pago</FieldTitle>
                  <FieldDescription>{paid ? `Pago em ${formatDate(purchasedOn)}.` : "Fica marcado como “a pagar”. Não muda o mês da compra."}</FieldDescription>
                </FieldContent>
                <Switch checked={paid} onCheckedChange={setPaid} aria-label="Já pago" disabled={disabledForm} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-muted-foreground">Total da compra</span>
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(totalAmount)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{formatWeight(totalWeight)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetForm} disabled={saving || (items.length === 0 && !supplier)}>
                Limpar
              </Button>
              <Button size="lg" onClick={handleSubmit} disabled={disabledForm || items.length === 0 || !supplier}>
                {saving && <Spinner data-icon="inline-start" />}
                Finalizar compra
              </Button>
            </div>
            {formError && <FieldError>{formError}</FieldError>}
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras do mês</CardTitle>
          <CardDescription>Lançamentos por data da compra (regime de competência). Resumo por fornecedor no rodapé.</CardDescription>
          <div className="pt-2">
            <PeriodSelect value={period} onValueChange={setPeriod} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {listClosed && <ClosedMonthAlert period={period} payoutId={listClosed.id} />}
          {loading ? (
            <TableSkeleton rows={3} columns={5} />
          ) : purchases.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TruckIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma compra em {period.slice(5)}/{period.slice(0, 4)}</EmptyTitle>
                <EmptyDescription>Quando um catador ou outra cooperativa trouxer material, registre a compra no formulário acima.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="hidden md:table-cell">Itens</TableHead>
                    <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(purchase.purchasedOn)}</TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="font-medium">{supplierName(purchase.supplierId)}</span>
                          <span className="text-xs text-muted-foreground">{supplierById(purchase.supplierId) ? supplierDocument(supplierById(purchase.supplierId)!) : ""}</span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="flex flex-wrap gap-1">
                          {purchase.items.map((item) => (
                            <Badge key={item.id} variant="secondary">
                              {materialName(item.materialTypeId)} · {conditionLabel(item.condition)}
                            </Badge>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {PAYMENT_METHOD_LABEL[purchase.paymentMethod]}
                          {purchase.paidOn ? <Badge variant="outline">pago</Badge> : <Badge variant="destructive">a pagar</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatWeight(purchase.totalWeightKg)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(purchase.totalAmount)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label="Ver detalhes" onClick={() => setViewing(purchase)}>
                            <EyeIcon />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Recibo" onClick={() => printReceipt(purchase)}>
                            <FileTextIcon />
                          </Button>
                          {isManager && (
                            <Button variant="ghost" size="icon-sm" aria-label="Excluir compra" disabled={Boolean(listClosed)} onClick={() => setDeleting(purchase)}>
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
                    <TableCell colSpan={4} className="font-medium">
                      {purchases.length} compra(s)
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatWeight(purchases.reduce((s, x) => s + x.totalWeightKg, 0))}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatMoney(purchases.reduce((s, x) => s + x.totalAmount, 0))}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-sm font-medium">Por fornecedor</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {bySupplier.map(([supplierId, totals]) => (
                    <li key={supplierId} className="flex items-center justify-between gap-2">
                      <span>
                        {supplierName(supplierId)} <span className="text-muted-foreground">· {totals.count} compra(s) · {formatWeight(totals.weightKg)}</span>
                      </span>
                      <span className="tabular-nums">{formatMoney(totals.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <NewSupplierDialog
        open={newSupplierOpen}
        onOpenChange={setNewSupplierOpen}
        onCreated={(created) => {
          setSupplier(created)
          setFormError(null)
        }}
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>Compra de {formatDate(viewing.purchasedOn)}</DialogTitle>
                <DialogDescription>
                  {supplierName(viewing.supplierId)} · {PAYMENT_METHOD_LABEL[viewing.paymentMethod]}
                  {viewing.paidOn ? ` · pago em ${formatDate(viewing.paidOn)}` : " · a pagar"}
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
                          {materialName(item.materialTypeId)}
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
              <DialogFooter showCloseButton>
                <Button variant="outline" onClick={() => printReceipt(viewing)}>
                  <FileTextIcon data-icon="inline-start" />
                  Recibo (PDF)
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir esta compra?"
        description={
          deleting
            ? `${supplierName(deleting.supplierId)}, ${formatDate(deleting.purchasedOn)}, ${formatMoney(deleting.totalAmount)}. A compra sai dos cálculos do mês. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir compra"
        destructive
        onConfirm={handleDelete}
      />
    </>
  )
}

function NewSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (supplier: Supplier) => void
}) {
  const { actions } = useDemo()
  const [kind, setKind] = React.useState<SupplierKind>("individual")
  const [name, setName] = React.useState("")
  const [cpf, setCpf] = React.useState("")
  const [cnpj, setCnpj] = React.useState("")
  const [pixKey, setPixKey] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [errors, setErrors] = React.useState<{ name?: string; cpf?: string; cnpj?: string; pixKey?: string }>({})
  const [saving, setSaving] = React.useState(false)

  function reset() {
    setKind("individual")
    setName("")
    setCpf("")
    setCnpj("")
    setPixKey("")
    setPhone("")
    setErrors({})
  }

  function handleOpenChange(next: boolean) {
    if (saving) return
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (name.trim().length < 2) next.name = "Informe o nome do fornecedor."
    if (kind === "individual" && onlyDigits(cpf).length > 0 && !isValidCpf(cpf)) next.cpf = "CPF inválido. Deixe em branco se o catador não informou."
    if (kind === "company" && onlyDigits(cnpj).length !== 14) next.cnpj = "Informe o CNPJ com 14 dígitos."
    if (pixKey.trim() && !isValidPixKey(pixKey)) next.pixKey = "Chave PIX inválida."
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    try {
      const created = await actions.createSupplier({ kind, name, cpf: onlyDigits(cpf), cnpj: onlyDigits(cnpj), pixKey, phone: onlyDigits(phone) })
      toast.add({ type: "success", title: "Fornecedor cadastrado", description: `${created.name} · ${supplierDocument(created)}` })
      onCreated(created)
      handleOpenChange(false)
    } catch (err) {
      toast.add({ type: "error", title: "Não foi possível cadastrar", description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Novo fornecedor</DialogTitle>
            <DialogDescription>Catador avulso, outra cooperativa ou empresa. Cadastre uma vez e reaproveite nas próximas compras.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel id="supplier-kind-label">Pessoa ou empresa?</FieldLabel>
              <ToggleGroup
                value={[kind]}
                onValueChange={(value) => {
                  const next = value[0] as SupplierKind | undefined
                  if (next) {
                    setKind(next)
                    setErrors({})
                  }
                }}
                variant="outline"
                spacing={0}
                aria-labelledby="supplier-kind-label"
              >
                <ToggleGroupItem value="individual" className="flex-1">
                  {SUPPLIER_KIND_LABEL.individual}
                </ToggleGroupItem>
                <ToggleGroupItem value="company" className="flex-1">
                  {SUPPLIER_KIND_LABEL.company}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="supplier-name">Nome</FieldLabel>
              <Input
                id="supplier-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrors((p) => ({ ...p, name: undefined }))
                }}
                placeholder={kind === "individual" ? "Ex.: José Carlos (Seu Zé)" : "Ex.: Cooperativa Vizinha"}
                aria-invalid={errors.name ? true : undefined}
                autoFocus
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            {kind === "individual" ? (
              <Field data-invalid={errors.cpf ? true : undefined}>
                <FieldLabel htmlFor="supplier-cpf">CPF</FieldLabel>
                <Input
                  id="supplier-cpf"
                  inputMode="numeric"
                  placeholder="Opcional"
                  value={cpf}
                  onChange={(e) => {
                    const digits = onlyDigits(e.target.value)
                    if (digits.length <= 11) setCpf(digits.length === 11 ? formatCpf(digits) : digits)
                    setErrors((p) => ({ ...p, cpf: undefined }))
                  }}
                  aria-invalid={errors.cpf ? true : undefined}
                />
                <FieldDescription>Catador nem sempre informa. Se informar, sai mascarado nas listas e no recibo.</FieldDescription>
                <FieldError>{errors.cpf}</FieldError>
              </Field>
            ) : (
              <Field data-invalid={errors.cnpj ? true : undefined}>
                <FieldLabel htmlFor="supplier-cnpj">CNPJ</FieldLabel>
                <Input
                  id="supplier-cnpj"
                  inputMode="numeric"
                  placeholder="14 dígitos"
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(onlyDigits(e.target.value).slice(0, 14))
                    setErrors((p) => ({ ...p, cnpj: undefined }))
                  }}
                  aria-invalid={errors.cnpj ? true : undefined}
                />
                <FieldError>{errors.cnpj}</FieldError>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={errors.pixKey ? true : undefined}>
                <FieldLabel htmlFor="supplier-pix">Chave PIX</FieldLabel>
                <Input
                  id="supplier-pix"
                  placeholder="Opcional"
                  value={pixKey}
                  onChange={(e) => {
                    setPixKey(e.target.value)
                    setErrors((p) => ({ ...p, pixKey: undefined }))
                  }}
                  aria-invalid={errors.pixKey ? true : undefined}
                />
                <FieldError>{errors.pixKey}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="supplier-phone">Telefone</FieldLabel>
                <Input id="supplier-phone" inputMode="tel" placeholder="Opcional" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />} disabled={saving}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Salvar fornecedor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
