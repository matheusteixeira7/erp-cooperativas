"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RecycleIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import { errorMessage } from "@/lib/demo/errors"
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo/seed"
import { useSession } from "@/lib/demo/session"
import { ROLE_LABEL, type Role } from "@/lib/demo/types"
import { homeForRole } from "@/lib/navigation"

export function LoginForm() {
  const router = useRouter()
  const { session, login, loginAs } = useSession()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, setPending] = React.useState<"form" | Role | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (session) router.replace(homeForRole(session.activeRole))
  }, [session, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending("form")
    try {
      const next = await login(email, password)
      router.replace(homeForRole(next.activeRole))
    } catch (err) {
      setError(errorMessage(err))
      setPending(null)
    }
  }

  async function handleQuickLogin(role: Role) {
    setError(null)
    setPending(role)
    try {
      const next = await loginAs(role)
      router.replace(homeForRole(next.activeRole))
    } catch (err) {
      setError(errorMessage(err))
      setPending(null)
    }
  }

  const busy = pending !== null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <RecycleIcon />
        </div>
        <h1 className="text-xl font-semibold">Recicla ERP</h1>
        <p className="text-sm text-muted-foreground">Gestão da cooperativa, da chamada ao rateio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Use o e-mail e a senha fornecidos pela cooperativa.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>Não foi possível entrar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="voce@cooperativa.coop"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  disabled={busy}
                  required
                />
              </Field>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  disabled={busy}
                  required
                />
              </Field>
              <Field>
                <Button type="submit" size="lg" disabled={busy || !email || !password}>
                  {pending === "form" && <Spinner data-icon="inline-start" />}
                  Entrar
                </Button>
              </Field>
              <FieldSeparator>ou acesse como</FieldSeparator>
              <Field>
                <div className="grid grid-cols-3 gap-2">
                  {(["manager", "operator", "member"] as Role[]).map((role) => (
                    <Button
                      key={role}
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleQuickLogin(role)}
                    >
                      {pending === role ? <Spinner data-icon="inline-start" /> : null}
                      {ROLE_LABEL[role]}
                    </Button>
                  ))}
                </div>
                <FieldDescription className="text-center">
                  Protótipo com dados simulados. Nada é enviado a um servidor.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <details className="w-full text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Contas de demonstração</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {DEMO_USERS.map((user) => (
                <li key={user.id} className="flex justify-between gap-2">
                  <span className="truncate">{user.email}</span>
                  <span className="shrink-0">{user.roles.map((r) => ROLE_LABEL[r]).join(" + ")}</span>
                </li>
              ))}
              <li className="mt-1">
                Senha para todas: <code className="font-mono">{DEMO_PASSWORD}</code>
              </li>
            </ul>
          </details>
        </CardFooter>
      </Card>
    </div>
  )
}
