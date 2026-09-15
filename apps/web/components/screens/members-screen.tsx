"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { MoreHorizontalIcon, PencilIcon, SearchIcon, Trash2Icon, UserCheckIcon, UserMinusIcon, UserPlusIcon, UsersIcon } from "lucide-react"

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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { QueryError } from "@/components/query-error"
import { TableSkeleton } from "@/components/table-skeleton"
import { todayIso } from "@/lib/dates"
import { formatCpf, formatDate, formatPhone } from "@/lib/format"
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client"
import { domainCodeOf, errorMessage } from "@/lib/trpc/errors"
import { useInvalidateAll } from "@/lib/trpc/hooks"
import { isValidCpf, isValidEmail, isValidPixKey, onlyDigits } from "@/lib/validation"

type Member = RouterOutputs["members"]["list"]["items"][number]

type MemberForm = {
  name: string
  cpf: string
  pixKey: string
  phone: string
  admittedOn: string
  inssWithheld: boolean
  notes: string
  hasAccess: boolean
  accessEmail: string
  accessPassword: string
}

type FormErrors = Partial<Record<keyof MemberForm, string>>

const EMPTY_FORM: MemberForm = {
  name: "",
  cpf: "",
  pixKey: "",
  phone: "",
  admittedOn: todayIso(),
  inssWithheld: true,
  notes: "",
  hasAccess: false,
  accessEmail: "",
  accessPassword: "",
}

export function MembersScreen() {
  const trpc = useTRPC()
  const invalidateAll = useInvalidateAll()
  const today = todayIso()

  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"active" | "left" | "all">("active")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<MemberForm>(EMPTY_FORM)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [deactivating, setDeactivating] = React.useState<Member | null>(null)
  const [leftOn, setLeftOn] = React.useState(today)
  const [reactivating, setReactivating] = React.useState<Member | null>(null)
  const [deleting, setDeleting] = React.useState<Member | null>(null)

  const listQuery = useQuery(trpc.members.list.queryOptions({ includeInactive: true }))
  const detailQuery = useQuery(trpc.members.byId.queryOptions({ id: editingId ?? "" }, { enabled: Boolean(editingId) && sheetOpen }))
  const createMember = useMutation(trpc.members.create.mutationOptions())
  const updateMember = useMutation(trpc.members.update.mutationOptions())
  const deactivateMember = useMutation(trpc.members.deactivate.mutationOptions())
  const reactivateMember = useMutation(trpc.members.reactivate.mutationOptions())
  const deleteMember = useMutation(trpc.members.delete.mutationOptions())

  const allMembers = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
  const members = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = onlyDigits(search)
    return allMembers
      .filter((m) => (filter === "active" ? m.active : filter === "left" ? !m.active : true))
      .filter((m) => !term || m.name.toLowerCase().includes(term) || (digits.length >= 3 && m.cpfMasked.replace(/\D/g, "").includes(digits)))
  }, [allMembers, filter, search])

  const activeCount = allMembers.filter((m) => m.active).length
  const leftCount = allMembers.length - activeCount
  const saving = createMember.isPending || updateMember.isPending
  const editing = editingId !== null
  const detailLoading = editing && detailQuery.isPending

  // When the full record (with CPF) arrives, fill the form once per opened member.
  const [hydratedFor, setHydratedFor] = React.useState<string | null>(null)
  const detail = detailQuery.data
  if (editing && sheetOpen && detail && detail.id === editingId && hydratedFor !== detail.id) {
    setHydratedFor(detail.id)
    setForm({
      name: detail.name,
      cpf: formatCpf(detail.cpf ?? ""),
      pixKey: detail.pixKey ?? "",
      phone: formatPhone(detail.phone),
      admittedOn: detail.admittedOn,
      inssWithheld: detail.inssWithheld,
      notes: detail.notes,
      hasAccess: detail.hasAccess,
      accessEmail: detail.accessEmail ?? "",
      accessPassword: "",
    })
  }

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, admittedOn: today })
    setErrors({})
    setSheetOpen(true)
  }

  function openEdit(member: Member) {
    setEditingId(member.id)
    setHydratedFor(null)
    setForm({
      name: member.name,
      cpf: member.cpfMasked,
      pixKey: member.pixKey ?? "",
      phone: formatPhone(member.phone),
      admittedOn: member.admittedOn,
      inssWithheld: member.inssWithheld,
      notes: member.notes,
      hasAccess: member.hasAccess,
      accessEmail: member.accessEmail ?? "",
      accessPassword: "",
    })
    setErrors({})
    setSheetOpen(true)
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (form.name.trim().length < 2 || form.name.trim().length > 200) next.name = "Nome deve ter entre 2 e 200 caracteres."
    if (!editing && !isValidCpf(form.cpf)) next.cpf = "CPF inválido. Confira os 11 dígitos."
    if (form.pixKey.trim() && !isValidPixKey(form.pixKey)) next.pixKey = "Chave PIX inválida (CPF, CNPJ, e-mail, telefone +55 ou chave aleatória)."
    if (!form.admittedOn) next.admittedOn = "Informe a data de admissão."
    else if (form.admittedOn > today) next.admittedOn = "A admissão não pode ser futura."
    if (form.hasAccess) {
      if (!isValidEmail(form.accessEmail)) next.accessEmail = "Informe um e-mail válido para o login."
      const hadAccess = editing ? (detailQuery.data?.hasAccess ?? false) : false
      if (!hadAccess && form.accessPassword.length < 6) next.accessPassword = "Senha com pelo menos 6 caracteres."
      if (form.accessPassword && form.accessPassword.length < 6) next.accessPassword = "Senha com pelo menos 6 caracteres."
    }
    return next
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const access = form.hasAccess ? { email: form.accessEmail.trim(), password: form.accessPassword || undefined } : null
    try {
      if (editingId) {
        const updated = await updateMember.mutateAsync({
          id: editingId,
          name: form.name,
          pixKey: form.pixKey.trim(),
          phone: onlyDigits(form.phone),
          admittedOn: form.admittedOn,
          inssWithheld: form.inssWithheld,
          notes: form.notes.trim(),
          access,
        })
        toast.add({ type: "success", title: "Cadastro atualizado", description: updated.name })
      } else {
        const created = await createMember.mutateAsync({
          name: form.name,
          cpf: onlyDigits(form.cpf),
          pixKey: form.pixKey.trim(),
          phone: onlyDigits(form.phone),
          admittedOn: form.admittedOn,
          inssWithheld: form.inssWithheld,
          notes: form.notes.trim(),
          access,
        })
        toast.add({
          type: "success",
          title: "Cooperado cadastrado",
          description: created.hasAccess ? `${created.name} já pode entrar e ver o extrato.` : created.name,
        })
      }
      await invalidateAll()
      setSheetOpen(false)
    } catch (error) {
      const code = domainCodeOf(error)
      if (code === "MEMBER_CPF_TAKEN") setErrors({ cpf: errorMessage(error) })
      else if (code === "EMAIL_TAKEN") setErrors({ accessEmail: errorMessage(error) })
      else toast.add({ type: "error", title: "Não foi possível salvar", description: errorMessage(error) })
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return
    try {
      await deactivateMember.mutateAsync({ id: deactivating.id, leftOn })
      await invalidateAll()
      toast.add({ type: "success", title: "Cooperado desligado", description: `${deactivating.name} sai da chamada a partir de ${formatDate(leftOn)}.` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível desligar", description: errorMessage(error) })
      throw error
    }
  }

  async function handleReactivate() {
    if (!reactivating) return
    try {
      await reactivateMember.mutateAsync({ id: reactivating.id })
      await invalidateAll()
      toast.add({ type: "success", title: "Cooperado reativado", description: `${reactivating.name} volta a aparecer na chamada a partir de hoje.` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível reativar", description: errorMessage(error) })
      throw error
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteMember.mutateAsync({ id: deleting.id })
      await invalidateAll()
      toast.add({ type: "success", title: "Cadastro excluído", description: `${deleting.name} foi removido. Não havia nenhum lançamento.` })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível excluir", description: errorMessage(error) })
      throw error
    }
  }

  function setField<K extends keyof MemberForm>(key: K, value: MemberForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const hasAnyMember = allMembers.length > 0
  const hadAccess = editing ? (detailQuery.data?.hasAccess ?? false) : false

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cooperados"
        description={
          listQuery.data
            ? `${activeCount} ativos, ${leftCount} desligado(s). Desligados ficam no histórico e continuam nos fechamentos antigos; só se apaga de verdade quem nunca teve lançamento.`
            : "Cadastro, desligamento e reativação de cooperados."
        }
      >
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
                const next = value[0] as "active" | "left" | "all" | undefined
                if (next) setFilter(next)
              }}
              variant="outline"
              aria-label="Filtro"
            >
              <ToggleGroupItem value="active">Ativos</ToggleGroupItem>
              <ToggleGroupItem value="left">Desligados</ToggleGroupItem>
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {listQuery.isPending ? (
            <TableSkeleton rows={6} columns={5} />
          ) : listQuery.isError ? (
            <QueryError error={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.isFetching} />
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
                <EmptyTitle>{filter === "left" && !search.trim() ? "Nenhum cooperado desligado" : "Nenhum resultado"}</EmptyTitle>
                <EmptyDescription>
                  {filter === "left" && !search.trim() ? "Quem for desligado aparece aqui e pode ser reativado." : "Tente outro nome ou CPF, ou mude o filtro para “Todos”."}
                </EmptyDescription>
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
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <span className="flex flex-col">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {member.name}
                          {!member.inssWithheld && <Badge variant="outline">sem INSS</Badge>}
                        </span>
                        {member.hasAccess && <span className="text-xs text-muted-foreground">Tem acesso ao extrato</span>}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{member.cpfMasked}</TableCell>
                    <TableCell className="hidden md:table-cell truncate max-w-48">{member.pixKey || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell tabular-nums">{member.phone ? formatPhone(member.phone) : "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(member.admittedOn)}</TableCell>
                    <TableCell>
                      {member.active ? <Badge>Ativo</Badge> : <Badge variant="outline">Desligado em {member.leftOn ? formatDate(member.leftOn) : ""}</Badge>}
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
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            {member.active ? (
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
                            ) : (
                              <DropdownMenuItem onClick={() => setReactivating(member)}>
                                <UserCheckIcon />
                                Reativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem variant="destructive" disabled={member.hasRecords} onClick={() => setDeleting(member)}>
                              <Trash2Icon />
                              <span className="flex flex-col">
                                <span>Excluir de verdade</span>
                                {member.hasRecords && <span className="text-xs font-normal opacity-80">Tem lançamentos: use Desligar</span>}
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
              {detailLoading ? (
                <div className="flex flex-col gap-4 py-2" aria-busy="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : editing && detailQuery.isError ? (
                <QueryError error={detailQuery.error} onRetry={() => void detailQuery.refetch()} retrying={detailQuery.isFetching} />
              ) : (
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
                      disabled={editing}
                      onChange={(e) =>
                        setField(
                          "cpf",
                          onlyDigits(e.target.value).length <= 11
                            ? formatCpf(onlyDigits(e.target.value)).replace(/[._-]*_+[._-]*$/, "").replace(/[.-]$/, "")
                            : form.cpf,
                        )
                      }
                      aria-invalid={errors.cpf ? true : undefined}
                    />
                    {editing && <FieldDescription>O CPF não muda depois do cadastro. Se estiver errado e não houver lançamentos, exclua e cadastre de novo.</FieldDescription>}
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
                      <FieldTitle>Contribui INSS pelo sistema</FieldTitle>
                      <FieldDescription>Desligue para aposentado, MEI ou quem recolhe por fora. Vale a partir do próximo fechamento.</FieldDescription>
                    </FieldContent>
                    <Switch checked={form.inssWithheld} onCheckedChange={(checked) => setField("inssWithheld", checked)} aria-label="Contribui INSS pelo sistema" />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Acesso ao extrato</FieldTitle>
                      <FieldDescription>Cria um login com perfil Cooperado para ver dias, diária e líquido pelo celular.</FieldDescription>
                    </FieldContent>
                    <Switch checked={form.hasAccess} onCheckedChange={(checked) => setField("hasAccess", checked)} aria-label="Acesso ao extrato" />
                  </Field>
                  {form.hasAccess && (
                    <div className="grid gap-4 rounded-lg border bg-muted/30 p-3">
                      <Field data-invalid={errors.accessEmail ? true : undefined}>
                        <FieldLabel htmlFor="member-access-email">E-mail de login</FieldLabel>
                        <Input id="member-access-email" type="email" value={form.accessEmail} onChange={(e) => setField("accessEmail", e.target.value)} placeholder="cooperado@exemplo.com" aria-invalid={errors.accessEmail ? true : undefined} />
                        <FieldError>{errors.accessEmail}</FieldError>
                      </Field>
                      <Field data-invalid={errors.accessPassword ? true : undefined}>
                        <FieldLabel htmlFor="member-access-password">{hadAccess ? "Nova senha (opcional)" : "Senha"}</FieldLabel>
                        <Input id="member-access-password" type="password" autoComplete="new-password" value={form.accessPassword} onChange={(e) => setField("accessPassword", e.target.value)} aria-invalid={errors.accessPassword ? true : undefined} />
                        <FieldDescription>{hadAccess ? "Deixe em branco para manter a senha atual." : "Pelo menos 6 caracteres. Combine com o cooperado."}</FieldDescription>
                        <FieldError>{errors.accessPassword}</FieldError>
                      </Field>
                    </div>
                  )}
                </FieldGroup>
              )}
            </div>
            <SheetFooter className="flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || detailLoading || (editing && detailQuery.isError)}>
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

      <ConfirmDialog
        open={reactivating !== null}
        onOpenChange={(open) => !open && setReactivating(null)}
        title={`Reativar ${reactivating?.name ?? ""}?`}
        description={`Desligado em ${reactivating?.leftOn ? formatDate(reactivating.leftOn) : "—"}. Ao reativar, volta a aparecer na chamada a partir de hoje e entra no rateio dos próximos meses. Os fechamentos antigos não mudam.`}
        confirmLabel="Reativar cooperado"
        onConfirm={handleReactivate}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir ${deleting?.name ?? ""} de verdade?`}
        description="Só é possível porque este cooperado não tem nenhuma presença, vale ou fechamento. O cadastro é apagado e não pode ser recuperado. Se a pessoa trabalhou algum dia, use “Desligar”."
        confirmLabel="Excluir cadastro"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
