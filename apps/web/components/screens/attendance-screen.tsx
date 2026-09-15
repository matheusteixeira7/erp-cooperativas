"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckCircle2Icon, CircleIcon, UsersIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Progress, ProgressLabel } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import { ClosedMonthAlert } from "@/components/closed-month-alert"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PageHeader } from "@/components/page-header"
import { QueryError } from "@/components/query-error"
import { periodOf, todayIso } from "@/lib/dates"
import { formatDate, formatShortDate, initials } from "@/lib/format"
import { useRequiredSession } from "@/lib/session"
import { useTRPC } from "@/lib/trpc/client"
import { errorMessage } from "@/lib/trpc/errors"
import { useInvalidateAll } from "@/lib/trpc/hooks"

export function AttendanceScreen() {
  const trpc = useTRPC()
  const invalidateAll = useInvalidateAll()
  const { session } = useRequiredSession()
  const today = todayIso()
  const [date, setDate] = React.useState(today)
  const [pendingDate, setPendingDate] = React.useState<string | null>(null)
  // Draft edits live only while the user is on the same date; saved data wins otherwise.
  const [draft, setDraft] = React.useState<{ date: string; present: string[] } | null>(null)

  const query = useQuery(trpc.attendance.byDate.queryOptions({ date }))
  const save = useMutation(trpc.attendance.saveDaily.mutationOptions())

  const members = React.useMemo(() => query.data?.entries ?? [], [query.data])
  const hasRecord = query.data?.recorded ?? false
  const readOnly = query.data?.periodClosed ?? false
  const loading = query.isPending

  const recordedPresent = React.useMemo(() => members.filter((m) => m.present).map((m) => m.memberId), [members])
  const dirty = draft !== null && draft.date === date
  const present = dirty ? draft.present : recordedPresent
  const saving = save.isPending

  function setPresent(next: string[]) {
    setDraft({ date, present: next })
  }

  function requestDateChange(next: string) {
    if (!next) return
    if (dirty) setPendingDate(next)
    else setDate(next)
  }

  function setAll(value: boolean) {
    setPresent(value ? members.map((m) => m.memberId) : [])
  }

  async function handleSave() {
    if (saving) return // guard against double submit (NF-004)
    try {
      const result = await save.mutateAsync({
        date,
        entries: members.map((m) => ({ memberId: m.memberId, present: present.includes(m.memberId) })),
      })
      setDraft(null)
      await invalidateAll()
      toast.add({
        type: "success",
        title: `Chamada de ${formatShortDate(date)} salva`,
        description: `${result.presentCount} de ${members.length} presentes.`,
      })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível salvar a chamada", description: errorMessage(error) })
    }
  }

  const percent = members.length ? Math.round((present.length / members.length) * 100) : 0

  return (
    <div className="flex flex-1 flex-col gap-6 pb-24 md:pb-0">
      <PageHeader title="Chamada" description="Toque no nome para marcar presença. Confirme no fim.">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="attendance-date">Data</FieldLabel>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => requestDateChange(e.target.value)}
            className="w-44"
          />
        </Field>
      </PageHeader>

      {readOnly && <ClosedMonthAlert period={periodOf(date)} payoutId={query.data?.closedPayoutId ?? undefined} />}

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} title="Não foi possível carregar a chamada" />
      ) : members.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum cooperado ativo em {formatDate(date)}</EmptyTitle>
            <EmptyDescription>
              A chamada lista quem estava admitido e ativo nesta data. Cadastre cooperados para começar.
            </EmptyDescription>
          </EmptyHeader>
          {session.activeRole === "manager" && (
            <EmptyContent>
              <Button render={<Link href="/cooperados" />} nativeButton={false}>
                Cadastrar cooperado
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-2">
              <Progress value={percent} className="max-w-md">
                <ProgressLabel className="text-base font-medium">
                  {present.length} / {members.length} presentes
                </ProgressLabel>
              </Progress>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {hasRecord ? (
                  <Badge variant="secondary">Chamada registrada</Badge>
                ) : (
                  <Badge variant="outline">Sem chamada para este dia</Badge>
                )}
                {dirty && <Badge variant="outline">Alterações não salvas</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAll(true)} disabled={readOnly || saving}>
                Marcar todos
              </Button>
              <Button variant="outline" onClick={() => setAll(false)} disabled={readOnly || saving}>
                Desmarcar todos
              </Button>
            </div>
          </div>

          <ToggleGroup
            multiple
            variant="outline"
            orientation="vertical"
            spacing={2}
            value={present}
            onValueChange={(value) => setPresent(value as string[])}
            className="w-full"
            aria-label="Lista de presença"
          >
            {members.map((member) => {
              const isPresent = present.includes(member.memberId)
              return (
                <ToggleGroupItem
                  key={member.memberId}
                  value={member.memberId}
                  disabled={readOnly || saving}
                  className="h-14 w-full justify-between px-3 text-base"
                  aria-label={`${member.memberName}: ${isPresent ? "presente" : "ausente"}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(member.memberName)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.memberName}</span>
                  </span>
                  {isPresent ? (
                    <Badge>
                      <CheckCircle2Icon />
                      Presente
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <CircleIcon />
                      Ausente
                    </Badge>
                  )}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>

          <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
            <Button
              size="lg"
              className="h-12 w-full text-base md:w-auto"
              disabled={readOnly || saving || !dirty}
              onClick={handleSave}
            >
              {saving && <Spinner data-icon="inline-start" />}
              Confirmar chamada de {formatShortDate(date)}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingDate !== null}
        onOpenChange={(open) => !open && setPendingDate(null)}
        title="Descartar alterações?"
        description={`A chamada de ${formatDate(date)} tem alterações não salvas. Ao trocar a data, elas serão perdidas.`}
        confirmLabel="Trocar sem salvar"
        destructive
        onConfirm={async () => {
          if (pendingDate) {
            setDraft(null)
            setDate(pendingDate)
          }
        }}
      />
    </div>
  )
}
