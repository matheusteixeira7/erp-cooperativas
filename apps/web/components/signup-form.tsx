"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2Icon, RecycleIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import { isValidEmail } from "@/lib/validation"

type SignupForm = {
  cooperativeName: string
  managerName: string
  email: string
  password: string
  confirmPassword: string
}

type FormErrors = Partial<Record<keyof SignupForm, string>>

const EMPTY_FORM: SignupForm = {
  cooperativeName: "",
  managerName: "",
  email: "",
  password: "",
  confirmPassword: "",
}

export function SignupForm() {
  const router = useRouter()
  const [form, setForm] = React.useState<SignupForm>(EMPTY_FORM)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState(false)

  function setField<K extends keyof SignupForm>(key: K, value: SignupForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (form.cooperativeName.trim().length < 2) next.cooperativeName = "Informe o nome da cooperativa."
    if (form.managerName.trim().length < 2) next.managerName = "Informe seu nome completo."
    if (!isValidEmail(form.email)) next.email = "E-mail inválido."
    if (form.password.length < 6) next.password = "A senha precisa de pelo menos 6 caracteres."
    if (form.confirmPassword !== form.password) next.confirmPassword = "As senhas não são iguais."
    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setPending(true)
    // Simulated account creation. No backend: the prototype just confirms and sends to login.
    await new Promise((resolve) => setTimeout(resolve, 900))
    setPending(false)
    setDone(true)
    setTimeout(() => router.push("/login"), 1800)
  }

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <RecycleIcon />
          </div>
          <h1 className="text-xl font-semibold">Recicla ERP</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2Icon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">Cooperativa criada</p>
              <p className="text-sm text-muted-foreground">
                A {form.cooperativeName.trim()} está pronta. Vamos te levar para o login.
              </p>
            </div>
            <Spinner />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <RecycleIcon />
        </div>
        <h1 className="text-xl font-semibold">Recicla ERP</h1>
        <p className="text-sm text-muted-foreground">Crie a conta da sua cooperativa.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Você entra como gestor e pode convidar a equipe depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Alert>
                <TriangleAlertIcon />
                <AlertTitle>Protótipo</AlertTitle>
                <AlertDescription>
                  Nada é enviado a um servidor. Para explorar com dados prontos, use o login de demonstração.
                </AlertDescription>
              </Alert>

              <Field data-invalid={errors.cooperativeName ? true : undefined}>
                <FieldLabel htmlFor="signup-coop">Nome da cooperativa</FieldLabel>
                <Input
                  id="signup-coop"
                  value={form.cooperativeName}
                  onChange={(e) => setField("cooperativeName", e.target.value)}
                  placeholder="Ex.: Cooperativa Recicla Vida"
                  disabled={pending}
                  aria-invalid={errors.cooperativeName ? true : undefined}
                  autoFocus
                />
                <FieldError>{errors.cooperativeName}</FieldError>
              </Field>

              <Field data-invalid={errors.managerName ? true : undefined}>
                <FieldLabel htmlFor="signup-name">Seu nome completo</FieldLabel>
                <Input
                  id="signup-name"
                  value={form.managerName}
                  onChange={(e) => setField("managerName", e.target.value)}
                  autoComplete="name"
                  disabled={pending}
                  aria-invalid={errors.managerName ? true : undefined}
                />
                <FieldError>{errors.managerName}</FieldError>
              </Field>

              <Field data-invalid={errors.email ? true : undefined}>
                <FieldLabel htmlFor="signup-email">E-mail</FieldLabel>
                <Input
                  id="signup-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  autoComplete="username"
                  placeholder="voce@cooperativa.coop"
                  disabled={pending}
                  aria-invalid={errors.email ? true : undefined}
                />
                <FieldError>{errors.email}</FieldError>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.password ? true : undefined}>
                  <FieldLabel htmlFor="signup-password">Senha</FieldLabel>
                  <Input
                    id="signup-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    autoComplete="new-password"
                    disabled={pending}
                    aria-invalid={errors.password ? true : undefined}
                  />
                  <FieldError>{errors.password}</FieldError>
                </Field>
                <Field data-invalid={errors.confirmPassword ? true : undefined}>
                  <FieldLabel htmlFor="signup-confirm">Confirmar senha</FieldLabel>
                  <Input
                    id="signup-confirm"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setField("confirmPassword", e.target.value)}
                    autoComplete="new-password"
                    disabled={pending}
                    aria-invalid={errors.confirmPassword ? true : undefined}
                  />
                  <FieldError>{errors.confirmPassword}</FieldError>
                </Field>
              </div>

              <Field>
                <Button type="submit" size="lg" disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Criar conta
                </Button>
                <FieldDescription className="text-center">
                  Já tem conta?{" "}
                  <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                    Entrar
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
