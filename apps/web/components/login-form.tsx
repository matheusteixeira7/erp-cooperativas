"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RecycleIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import { ROLE_LABEL, type Role } from "@/lib/domain/enums"
import { homeForRole } from "@/lib/navigation"
import { useSession } from "@/lib/session"
import { errorMessage } from "@/lib/trpc/errors"

/**
 * Accounts created by `pnpm --filter web db:seed`. Only shown in development,
 * where the seed is the expected dataset.
 */
const DEMO_ACCOUNTS: { role: Role; email: string; label: string }[] = [
  { role: "manager", email: "marta@reciclavida.coop", label: "Gestor + Operador" },
  { role: "operator", email: "jorge@reciclavida.coop", label: "Operador" },
  { role: "member", email: "ana@reciclavida.coop", label: "Cooperado" },
]
const DEMO_PASSWORD = "demo123"
const SHOW_DEMO = process.env.NODE_ENV === "development"

export function LoginForm() {
  const router = useRouter()
  const { session, login } = useSession()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, setPending] = React.useState<"form" | Role | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (session) router.replace(homeForRole(session.activeRole))
  }, [session, router])

  async function submit(credentials: { email: string; password: string }, who: "form" | Role) {
    setError(null)
    setPending(who)
    try {
      const next = await login(credentials.email, credentials.password)
      router.replace(homeForRole(next.activeRole))
    } catch (err) {
      setError(errorMessage(err))
      setPending(null)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submit({ email, password }, "form")
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
              {SHOW_DEMO && (
                <>
                  <FieldSeparator>ou acesse como</FieldSeparator>
                  <Field>
                    <div className="grid grid-cols-3 gap-2">
                      {DEMO_ACCOUNTS.map((account) => (
                        <Button
                          key={account.role}
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => submit({ email: account.email, password: DEMO_PASSWORD }, account.role)}
                        >
                          {pending === account.role ? <Spinner data-icon="inline-start" /> : null}
                          {ROLE_LABEL[account.role]}
                        </Button>
                      ))}
                    </div>
                  </Field>
                </>
              )}
              <Field>
                <FieldDescription className="text-center">
                  Ainda não tem conta?{" "}
                  <Link href="/signup" className="underline underline-offset-4 hover:text-primary">
                    Criar cooperativa
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        {SHOW_DEMO && (
          <CardFooter>
            <details className="w-full text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Contas de demonstração (banco local)</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account.email} className="flex justify-between gap-2">
                    <span className="truncate">{account.email}</span>
                    <span className="shrink-0">{account.label}</span>
                  </li>
                ))}
                <li className="mt-1">
                  Senha para todas: <code className="font-mono">{DEMO_PASSWORD}</code>. Crie os dados com{" "}
                  <code className="font-mono">pnpm --filter web db:seed</code>.
                </li>
              </ul>
            </details>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
