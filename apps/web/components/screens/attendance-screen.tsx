"use client"

import * as React from "react"
import Link from "next/link"
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
import { periodOf, todayIso } from "@/lib/dates"
import { errorMessage } from "@/lib/demo/errors"
import { useRequiredSession } from "@/lib/demo/session"
import { activeMembersOn, closedPayoutFor, useDemo, useSimulatedLoading } from "@/lib/demo/store"
import { formatDate, formatShortDate, initials } from "@/lib/format"

export function AttendanceScreen() {
  const { data, actions, resetCount } = useDemo()
  const { session } = useRequiredSession()
  const today = todayIso()
  const [date, setDate] = React.useState(today)
  const [pendingDate, setPendingDate] = React.useState<string | null>(null)
  // Draft edits live only while the user is on the same date; saved data wins otherwise.
  const [draft, setDraft] = React.useState<{ date: string; present: string[] } | null>(null)
  const [saving, setSaving] = React.useState(false)
  const loading = useSimulatedLoading(`${date}-${resetCount}`)

  const members = React.useMemo(
    () => activeMembersOn(data.members, date).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [data.members, date],
  )
  const recorded = React.useMemo(() => data.attendances.filter((a) => a.date === date), [data.attendances, date])
  const hasRecord = recorded.length > 0
  const closedPayout = closedPayoutFor(data, periodOf(date))
  const readOnly = Boolean(closedPayout)

  const recordedPresent = React.useMemo(() => recorded.filter((a) => a.present).map((a) => a.memberId), [recorded])
  const dirty = draft !== null && draft.date === date
  const present = dirty ? draft.present : recordedPresent

  function setPresent(next: string[]) {
    setDraft({ date, present: next })
  }

  function requestDateChange(next: string) {
    if (!next) return
    if (dirty) setPendingDate(next)
    else setDate(next)
  }

  function setAll(value: boolean) {
    setPresent(value ? members.map((m) => m.id) : [])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await actions.saveAttendance(
        date,
        members.map((m) => ({ memberId: m.id, present: present.includes(m.id) })),
      )
      setDraft(null)
      toast.add({
        type: "success",
        title: `Chamada de ${formatShortDate(date)} salva`,
        description: `${result.present} de ${members.length} presentes.`,
      })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível salvar a chamada", description: errorMessage(error) })
    } finally {
      setSaving(false)
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

      {readOnly && <ClosedMonthAlert period={periodOf(date)} payoutId={closedPayout?.id} />}

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
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
              const isPresent = present.includes(member.id)
              return (
                <ToggleGroupItem
                  key={member.id}
                  value={member.id}
                  disabled={readOnly || saving}
                  className="h-14 w-full justify-between px-3 text-base"
                  aria-label={`${member.name}: ${isPresent ? "presente" : "ausente"}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.name}</span>
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
