"use client"

import * as React from "react"
import { MoreHorizontalIcon, PencilIcon, SearchIcon, UserMinusIcon, UserPlusIcon, UsersIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"
import { todayIso } from "@/lib/dates"
import { DemoError, errorMessage } from "@/lib/demo/errors"
import { useDemo, useSimulatedLoading } from "@/lib/demo/store"
import type { Member } from "@/lib/demo/types"
import { formatCpf, formatDate, formatPhone, maskCpf } from "@/lib/format"
import { isValidCpf, isValidPixKey, onlyDigits } from "@/lib/validation"

type MemberForm = {
  name: string
  cpf: string
  pixKey: string
  phone: string
  admittedOn: string
  notes: string
  hasAccess: boolean
}

type FormErrors = Partial<Record<keyof MemberForm, string>>

const EMPTY_FORM: MemberForm = { name: "", cpf: "", pixKey: "", phone: "", admittedOn: todayIso(), notes: "", hasAccess: false }

export function MembersScreen() {
  const { data, actions, resetCount } = useDemo()
  const loading = useSimulatedLoading(`members-${resetCount}`)
  const today = todayIso()

  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"active" | "all">("active")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Member | null>(null)
  const [form, setForm] = React.useState<MemberForm>(EMPTY_FORM)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [saving, setSaving] = React.useState(false)
  const [deactivating, setDeactivating] = React.useState<Member | null>(null)
  const [leftOn, setLeftOn] = React.useState(today)

  const members = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = onlyDigits(search)
    return data.members
      .filter((m) => (filter === "active" ? !m.leftOn || m.leftOn >= today : true))
      .filter((m) => !term || m.name.toLowerCase().includes(term) || (digits.length >= 3 && m.cpf.includes(digits)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [data.members, filter, search, today])

  const activeCount = data.members.filter((m) => !m.leftOn || m.leftOn >= today).length

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setSheetOpen(true)
  }

  function openEdit(member: Member) {
    setEditing(member)
    setForm({
      name: member.name,
      cpf: formatCpf(member.cpf),
      pixKey: member.pixKey,
      phone: formatPhone(member.phone),
      admittedOn: member.admittedOn,
      notes: member.notes,
      hasAccess: member.hasAccess,
    })
    setErrors({})
    setSheetOpen(true)
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (form.name.trim().length < 2 || form.name.trim().length > 200) next.name = "Nome deve ter entre 2 e 200 caracteres."
    if (!isValidCpf(form.cpf)) next.cpf = "CPF inválido. Confira os 11 dígitos."
    if (!isValidPixKey(form.pixKey)) next.pixKey = "Chave PIX inválida (CPF, CNPJ, e-mail, telefone +55 ou chave aleatória)."
    if (!form.admittedOn) next.admittedOn = "Informe a data de admissão."
    else if (form.admittedOn > today) next.admittedOn = "A admissão não pode ser futura."
    return next
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    const payload = {
      name: form.name,
      cpf: onlyDigits(form.cpf),
      pixKey: form.pixKey.trim(),
      phone: onlyDigits(form.phone),
      admittedOn: form.admittedOn,
      notes: form.notes.trim(),
      hasAccess: form.hasAccess,
    }
    try {
      if (editing) {
        const updated = await actions.updateMember(editing.id, payload)
        toast.add({ type: "success", title: "Cadastro atualizado", description: updated.name })
      } else {
        const created = await actions.createMember(payload)
        toast.add({
          type: "success",
          title: "Cooperado cadastrado",
          description: created.hasAccess ? `${created.name} já pode entrar e ver o extrato.` : created.name,
        })
      }
      setSheetOpen(false)
    } catch (error) {
      if (error instanceof DemoError && error.code === "ERR-MEMBER-001") {
        setErrors({ cpf: error.message })
      } else {
        toast.add({ type: "error", title: "Não foi possível salvar", description: errorMessage(error) })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return
    try {
      await actions.deactivateMember(deactivating.id, leftOn)
      toast.add({ type: "success", title: "Cooperado desligado", description: `${deactivating.name} sai da chamada a partir de ${formatDate(leftOn)}.` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível desligar", description: errorMessage(error) })
      throw error
    }
  }

  function setField<K extends keyof MemberForm>(key: K, value: MemberForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const hasAnyMember = data.members.length > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cooperados" description={`${activeCount} ativos. Desligados ficam no histórico e continuam nos fechamentos antigos.`}>
        <Button onClick={openCreate}>
          <UserPlusIcon data-icon="inline-start" />
          Novo cooperado
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <InputGroup className="sm:max-w-sm">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput placeholder="Buscar por nome ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar cooperado" />
            </InputGroup>
            <ToggleGroup
              value={[filter]}
              onValueChange={(value) => {
                const next = value[0] as "active" | "all" | undefined
                if (next) setFilter(next)
              }}
              variant="outline"
              aria-label="Filtro"
            >
              <ToggleGroupItem value="active">Ativos</ToggleGroupItem>
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : !hasAnyMember ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum cooperado cadastrado</EmptyTitle>
                <EmptyDescription>Cadastre o primeiro cooperado para começar a fazer a chamada.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openCreate}>
                  <UserPlusIcon data-icon="inline-start" />
                  Cadastrar primeiro cooperado
                </Button>
              </EmptyContent>
            </Empty>
          ) : members.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum resultado</EmptyTitle>
                <EmptyDescription>Tente outro nome ou CPF, ou mude o filtro para “Todos”.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="hidden md:table-cell">PIX</TableHead>
                  <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Admissão</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const active = !member.leftOn || member.leftOn >= today
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <span className="flex flex-col">
                          <span>{member.name}</span>
                          {member.hasAccess && <span className="text-xs text-muted-foreground">Tem acesso ao extrato</span>}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{maskCpf(member.cpf)}</TableCell>
                      <TableCell className="hidden md:table-cell truncate max-w-48">{member.pixKey}</TableCell>
                      <TableCell className="hidden lg:table-cell tabular-nums">{formatPhone(member.phone)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(member.admittedOn)}</TableCell>
                      <TableCell>
                        {active ? <Badge>Ativo</Badge> : <Badge variant="outline">Desligado em {member.leftOn ? formatDate(member.leftOn) : ""}</Badge>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ações" />}>
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => openEdit(member)}>
                                <PencilIcon />
                                Editar cadastro
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            {active && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => {
                                      setLeftOn(today)
                                      setDeactivating(member)
                                    }}
                                  >
                                    <UserMinusIcon />
                                    Desligar
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={(open) => !saving && setSheetOpen(open)}>
        <SheetContent className="flex flex-col gap-0 sm:max-w-md">
          <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>{editing ? "Editar cooperado" : "Novo cooperado"}</SheetTitle>
              <SheetDescription>
                {editing ? "CPF completo visível só aqui. Alterações valem a partir de agora." : "Cadastre com CPF único. O acesso ao extrato é opcional."}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4">
              <FieldGroup>
                <Field data-invalid={errors.name ? true : undefined}>
                  <FieldLabel htmlFor="member-name">Nome completo</FieldLabel>
                  <Input id="member-name" value={form.name} onChange={(e) => setField("name", e.target.value)} aria-invalid={errors.name ? true : undefined} autoFocus />
                  <FieldError>{errors.name}</FieldError>
                </Field>
                <Field data-invalid={errors.cpf ? true : undefined}>
                  <FieldLabel htmlFor="member-cpf">CPF</FieldLabel>
                  <Input
                    id="member-cpf"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setField("cpf", onlyDigits(e.target.value).length <= 11 ? formatCpf(onlyDigits(e.target.value)).replace(/[._-]*_+[._-]*$/, "").replace(/[.-]$/, "") : form.cpf)}
                    aria-invalid={errors.cpf ? true : undefined}
                  />
                  <FieldError>{errors.cpf}</FieldError>
                </Field>
                <Field data-invalid={errors.pixKey ? true : undefined}>
                  <FieldLabel htmlFor="member-pix">Chave PIX</FieldLabel>
                  <Input id="member-pix" value={form.pixKey} onChange={(e) => setField("pixKey", e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" aria-invalid={errors.pixKey ? true : undefined} />
                  <FieldDescription>Usada pelo gestor para pagar o rateio.</FieldDescription>
                  <FieldError>{errors.pixKey}</FieldError>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="member-phone">Telefone</FieldLabel>
                    <Input id="member-phone" inputMode="tel" placeholder="(11) 90000-0000" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
                  </Field>
                  <Field data-invalid={errors.admittedOn ? true : undefined}>
                    <FieldLabel htmlFor="member-admitted">Admissão</FieldLabel>
                    <Input id="member-admitted" type="date" max={today} value={form.admittedOn} onChange={(e) => setField("admittedOn", e.target.value)} aria-invalid={errors.admittedOn ? true : undefined} />
                    <FieldError>{errors.admittedOn}</FieldError>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="member-notes">Observações</FieldLabel>
                  <Textarea id="member-notes" rows={3} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Opcional" />
                </Field>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Acesso ao extrato</FieldTitle>
                    <FieldDescription>Cria um usuário com perfil Cooperado para ver dias, diária e líquido pelo celular.</FieldDescription>
                  </FieldContent>
                  <Switch checked={form.hasAccess} onCheckedChange={(checked) => setField("hasAccess", checked)} aria-label="Acesso ao extrato" />
                </Field>
              </FieldGroup>
            </div>
            <SheetFooter className="flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                {editing ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Desligar ${deactivating?.name ?? ""}?`}
        description="O cooperado deixa de aparecer na chamada a partir da data informada. Presenças e fechamentos anteriores são preservados. Nada é apagado."
        confirmLabel="Confirmar desligamento"
        destructive
        disabled={!leftOn || (deactivating ? leftOn < deactivating.admittedOn : false)}
        onConfirm={handleDeactivate}
      >
        <Field data-invalid={deactivating && leftOn < deactivating.admittedOn ? true : undefined}>
          <FieldLabel htmlFor="left-on">Data do desligamento</FieldLabel>
          <Input id="left-on" type="date" value={leftOn} min={deactivating?.admittedOn} max={today} onChange={(e) => setLeftOn(e.target.value)} />
          <FieldError>{deactivating && leftOn < deactivating.admittedOn ? "Não pode ser antes da admissão." : null}</FieldError>
        </Field>
      </ConfirmDialog>
    </div>
  )
}
