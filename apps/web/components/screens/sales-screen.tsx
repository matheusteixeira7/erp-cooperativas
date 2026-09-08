"use client"

import * as React from "react"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

import { ClosedMonthAlert } from "@/components/closed-month-alert"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { PeriodSelect } from "@/components/period-select"
import { TableSkeleton } from "@/components/table-skeleton"
import { currentPeriod, isInPeriod, periodOf, todayIso } from "@/lib/dates"
import { errorMessage } from "@/lib/demo/errors"
import { useRequiredSession } from "@/lib/demo/session"
import { closedPayoutFor, useDemo, useSimulatedLoading, type SaleDraftItem } from "@/lib/demo/store"
import { MATERIAL_CATEGORY_LABEL, type Buyer, type MaterialCategory, type Sale } from "@/lib/demo/types"
import { itemSubtotal } from "@/lib/domain/payout"
import { formatDate, formatMoney, formatPricePerKg, formatWeight, parseDecimal } from "@/lib/format"
import { useActor } from "@/lib/use-actor"

type DraftItem = SaleDraftItem & { key: string; subtotal: number }

export function SalesScreen() {
  const { data, actions, resetCount } = useDemo()
  const { session } = useRequiredSession()
  const actor = useActor()
  const today = todayIso()
  const isManager = session.activeRole === "manager"

  // --- list ---
  const [period, setPeriod] = React.useState(currentPeriod())
  const loading = useSimulatedLoading(`sales-${period}-${resetCount}`)
  const sales = React.useMemo(
    () => data.sales.filter((s) => !s.deletedAt && isInPeriod(s.soldOn, period)).sort((a, b) => b.soldOn.localeCompare(a.soldOn)),
    [data.sales, period],
  )
  const [viewing, setViewing] = React.useState<Sale | null>(null)
  const [deleting, setDeleting] = React.useState<Sale | null>(null)

  // --- form ---
  const [buyer, setBuyer] = React.useState<Buyer | null>(null)
  const [soldOn, setSoldOn] = React.useState(today)
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [materialTypeId, setMaterialTypeId] = React.useState<string | null>(null)
  const [weight, setWeight] = React.useState("")
  const [price, setPrice] = React.useState("")
  const [items, setItems] = React.useState<DraftItem[]>([])
  const [itemErrors, setItemErrors] = React.useState<{ material?: string; weight?: string; price?: string }>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [newBuyerOpen, setNewBuyerOpen] = React.useState(false)
  const weightRef = React.useRef<HTMLInputElement>(null)

  const formPeriod = periodOf(soldOn)
  const formClosed = closedPayoutFor(data, formPeriod)
  const listClosed = closedPayoutFor(data, period)
  const activeBuyers = data.buyers.filter((b) => b.active)
  const activeMaterials = data.materialTypes.filter((m) => m.active)
  const materialItems = activeMaterials.map((m) => ({ value: m.id, label: m.name }))
  const materialName = (id: string) => data.materialTypes.find((m) => m.id === id)?.name ?? "—"
  const buyerName = (id: string) => data.buyers.find((b) => b.id === id)?.name ?? "—"

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
      { key: `${Date.now()}-${prev.length}`, materialTypeId, weightKg, pricePerKg, subtotal: itemSubtotal(weightKg, pricePerKg) },
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
    setSaving(true)
    try {
      const sale = await actions.createSale(
        { buyerId: buyer.id, soldOn, items: items.map(({ materialTypeId, weightKg, pricePerKg }) => ({ materialTypeId, weightKg, pricePerKg })), invoiceNumber, note: "" },
        actor,
      )
      toast.add({
        type: "success",
        title: "Venda registrada",
        description: `${buyer.name} · ${formatWeight(sale.totalWeightKg)} · ${formatMoney(sale.totalAmount)}`,
      })
      resetForm()
      setPeriod(periodOf(sale.soldOn))
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível registrar a venda", description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await actions.deleteSale(deleting.id)
      toast.add({ type: "success", title: "Venda excluída", description: `${buyerName(deleting.buyerId)} · ${formatDate(deleting.soldOn)}` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível excluir", description: errorMessage(error) })
      throw error
    }
  }

  const disabledForm = Boolean(formClosed) || saving

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendas" description="Registre a saída de material pesado para o comprador." />

      <Card>
        <CardHeader>
          <CardTitle>Nova venda</CardTitle>
          <CardDescription>Escolha o comprador, adicione cada material pesado e finalize.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {formClosed && <ClosedMonthAlert period={formPeriod} payoutId={formClosed.id} />}

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
                    disabled={disabledForm}
                  >
                    <ComboboxInput id="sale-buyer" placeholder="Buscar comprador..." className="flex-1" showClear aria-invalid={formError && !buyer ? true : undefined} />
                    <ComboboxContent>
                      <ComboboxEmpty>Nenhum comprador com esse nome. Use “Novo comprador”.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: Buyer) => (
                          <ComboboxItem key={item.id} value={item}>
                            <span className="flex flex-col">
                              <span>{item.name}</span>
                              <span className="text-xs text-muted-foreground">{item.contact}</span>
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
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-start">
                <Field data-invalid={itemErrors.material ? true : undefined}>
                  <FieldLabel htmlFor="sale-material">Material</FieldLabel>
                  <Select
                    items={materialItems}
                    value={materialTypeId}
                    onValueChange={(value) => {
                      setMaterialTypeId(value)
                      setItemErrors((e) => ({ ...e, material: undefined }))
                    }}
                    disabled={disabledForm}
                  >
                    <SelectTrigger id="sale-material" className="w-full" aria-invalid={itemErrors.material ? true : undefined}>
                      <SelectValue placeholder="Escolha o material" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MATERIAL_CATEGORY_LABEL) as MaterialCategory[])
                        .filter((category) => activeMaterials.some((m) => m.category === category))
                        .map((category) => (
                          <SelectGroup key={category}>
                            <SelectLabel>{MATERIAL_CATEGORY_LABEL[category]}</SelectLabel>
                            {activeMaterials
                              .filter((m) => m.category === category)
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{itemErrors.material}</FieldError>
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
                    placeholder="0,0000"
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
              <FieldDescription>Pressione Enter no preço para adicionar rapidamente.</FieldDescription>
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
                    <TableCell className="font-medium">{materialName(item.materialTypeId)}</TableCell>
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
              <ClosedMonthAlert period={period} payoutId={listClosed.id} />
            </div>
          )}
          {loading ? (
            <TableSkeleton rows={3} columns={5} />
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
                        <span className="font-medium">{buyerName(sale.buyerId)}</span>
                        {sale.invoiceNumber && <span className="text-xs text-muted-foreground">NF {sale.invoiceNumber}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {sale.items.map((item) => (
                          <Badge key={item.id} variant="secondary">
                            {materialName(item.materialTypeId)}
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
                    {sales.length} venda(s)
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatWeight(sales.reduce((s, x) => s + x.totalWeightKg, 0))}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatMoney(sales.reduce((s, x) => s + x.totalAmount, 0))}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

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
                  {buyerName(viewing.buyerId)}
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
                      <TableCell>{materialName(item.materialTypeId)}</TableCell>
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
            ? `${buyerName(deleting.buyerId)}, ${formatDate(deleting.soldOn)}, ${formatMoney(deleting.totalAmount)}. A venda sai dos cálculos do mês. Esta ação não pode ser desfeita.`
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
  const { actions } = useDemo()
  const [name, setName] = React.useState("")
  const [cnpj, setCnpj] = React.useState("")
  const [contact, setContact] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

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
    setSaving(true)
    try {
      const created = await actions.createBuyer({ name, cnpj: cnpj.replace(/\D/g, ""), contact })
      toast.add({ type: "success", title: "Comprador cadastrado", description: created.name })
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
            <DialogTitle>Novo comprador</DialogTitle>
            <DialogDescription>Cadastre uma vez e reaproveite nas próximas vendas.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="buyer-name">Nome</FieldLabel>
              <Input id="buyer-name" value={name} onChange={(e) => { setName(e.target.value); setError(null) }} aria-invalid={error ? true : undefined} autoFocus />
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
