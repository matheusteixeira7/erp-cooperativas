"use client"

import * as React from "react"
import { ExternalLinkIcon, InfoIcon, ScaleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

import { PageHeader } from "@/components/page-header"
import { addMonths, currentPeriod } from "@/lib/dates"
import { errorMessage } from "@/lib/demo/errors"
import { settingsForPeriod, useDemo } from "@/lib/demo/store"
import type { NegativeBalancePolicy } from "@/lib/domain/payout"
import { formatDateTime, formatPercent, formatPeriod, parseDecimal } from "@/lib/format"
import { useActor } from "@/lib/use-actor"

export function PayoutSettingsScreen() {
  const { data, actions } = useDemo()
  const actor = useActor()
  const current = currentPeriod()
  const active = settingsForPeriod(data.settingsHistory, current)

  const [legalReserve, setLegalReserve] = React.useState(String(active.legalReserveRate * 100))
  const [fates, setFates] = React.useState(String(active.fatesRate * 100))
  const [other, setOther] = React.useState(String(active.otherFundsRate * 100))
  const [policy, setPolicy] = React.useState<NegativeBalancePolicy>(active.negativeBalancePolicy)
  const [includeLeft, setIncludeLeft] = React.useState(active.includeMembersLeftInPeriod)
  const [effectiveFrom, setEffectiveFrom] = React.useState(current)
  const [errors, setErrors] = React.useState<{ legalReserve?: string; fates?: string; other?: string; effectiveFrom?: string }>({})
  const [saving, setSaving] = React.useState(false)

  const lr = parseDecimal(legalReserve)
  const ft = parseDecimal(fates)
  const ot = parseDecimal(other)
  const sum = (lr ?? 0) + (ft ?? 0) + (ot ?? 0)
  const closedForPeriod = data.payouts.some((p) => p.period === effectiveFrom && p.status === "closed")

  function validate() {
    const next: typeof errors = {}
    if (lr === null || lr < 10) next.legalReserve = "Mínimo legal: 10% (Lei 5.764, art. 28)."
    if (ft === null || ft < 5) next.fates = "Mínimo legal: 5% (Lei 5.764, art. 28)."
    if (ot === null || ot < 0) next.other = "Informe 0 ou um percentual positivo."
    if (sum >= 100) next.other = "A soma dos fundos precisa ser menor que 100%."
    if (!/^\d{4}-\d{2}$/.test(effectiveFrom)) next.effectiveFrom = "Informe o mês."
    else if (effectiveFrom < addMonths(current, -12)) next.effectiveFrom = "Escolha um mês recente."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate() || lr === null || ft === null || ot === null) return
    setSaving(true)
    try {
      const version = await actions.saveSettings({
        effectiveFrom,
        legalReserveRate: lr / 100,
        fatesRate: ft / 100,
        otherFundsRate: ot / 100,
        negativeBalancePolicy: policy,
        includeMembersLeftInPeriod: includeLeft,
        createdBy: actor.name,
      })
      toast.add({
        type: "success",
        title: "Parâmetros salvos",
        description: `Valem a partir de ${formatPeriod(version.effectiveFrom)}. Meses já fechados não mudam.`,
      })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível salvar", description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const history = [...data.settingsHistory].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Parâmetros de rateio" description="Percentuais dos fundos legais e regras aplicadas em cada fechamento. Cada alteração vira uma nova versão." />

      {active.isLegalDefault && (
        <Alert>
          <ScaleIcon />
          <AlertTitle>Usando os mínimos legais</AlertTitle>
          <AlertDescription>
            Reserva Legal 10% e FATES 5%, conforme a Lei 5.764/1971. O estatuto da cooperativa pode definir percentuais maiores.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={handleSubmit} noValidate>
            <CardHeader>
              <CardTitle>Nova versão dos parâmetros</CardTitle>
              <CardDescription>
                Vigente hoje: Reserva Legal {formatPercent(active.legalReserveRate)}, FATES {formatPercent(active.fatesRate)}, outros {formatPercent(active.otherFundsRate)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Fundos retidos antes do rateio</FieldLegend>
                  <FieldDescription>Calculados sobre a sobra do mês (vendas menos despesas). O que resta é dividido pelas diárias.</FieldDescription>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field data-invalid={errors.legalReserve ? true : undefined}>
                      <FieldLabel htmlFor="rate-legal">Reserva Legal</FieldLabel>
                      <InputGroup>
                        <InputGroupInput id="rate-legal" type="number" inputMode="decimal" min={10} step="0.5" value={legalReserve} onChange={(e) => { setLegalReserve(e.target.value); setErrors((p) => ({ ...p, legalReserve: undefined })) }} aria-invalid={errors.legalReserve ? true : undefined} />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{errors.legalReserve}</FieldError>
                    </Field>
                    <Field data-invalid={errors.fates ? true : undefined}>
                      <FieldLabel htmlFor="rate-fates">FATES</FieldLabel>
                      <InputGroup>
                        <InputGroupInput id="rate-fates" type="number" inputMode="decimal" min={5} step="0.5" value={fates} onChange={(e) => { setFates(e.target.value); setErrors((p) => ({ ...p, fates: undefined })) }} aria-invalid={errors.fates ? true : undefined} />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{errors.fates}</FieldError>
                    </Field>
                    <Field data-invalid={errors.other ? true : undefined}>
                      <FieldLabel htmlFor="rate-other">Outros fundos</FieldLabel>
                      <InputGroup>
                        <InputGroupInput id="rate-other" type="number" inputMode="decimal" min={0} step="0.5" value={other} onChange={(e) => { setOther(e.target.value); setErrors((p) => ({ ...p, other: undefined })) }} aria-invalid={errors.other ? true : undefined} />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{errors.other}</FieldError>
                    </Field>
                  </div>
                  <FieldDescription>
                    Total retido: <strong>{sum.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong>. Sobra distribuível: {(100 - sum).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% da sobra.
                  </FieldDescription>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Quando o vale é maior que o bruto</FieldLegend>
                  <FieldDescription>O líquido nunca fica negativo. A diferença segue esta política.</FieldDescription>
                  <RadioGroup value={policy} onValueChange={(value) => setPolicy(value as NegativeBalancePolicy)}>
                    <FieldLabel htmlFor="policy-carry">
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Passa para o próximo mês</FieldTitle>
                          <FieldDescription>Gera um vale “saldo de mês anterior”, descontado no fechamento seguinte.</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value="carry_over" id="policy-carry" />
                      </Field>
                    </FieldLabel>
                    <FieldLabel htmlFor="policy-forgive">
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Perdoa a diferença</FieldTitle>
                          <FieldDescription>A cooperativa absorve o valor que não coube no bruto.</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value="forgive" id="policy-forgive" />
                      </Field>
                    </FieldLabel>
                  </RadioGroup>
                </FieldSet>

                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Incluir desligados no mês</FieldTitle>
                    <FieldDescription>Quem foi desligado dentro do mês recebe pelos dias que trabalhou.</FieldDescription>
                  </FieldContent>
                  <Switch checked={includeLeft} onCheckedChange={setIncludeLeft} aria-label="Incluir desligados no mês" />
                </Field>

                <Field data-invalid={errors.effectiveFrom ? true : undefined}>
                  <FieldLabel htmlFor="effective-from">Vigente a partir de</FieldLabel>
                  <Input id="effective-from" type="month" value={effectiveFrom} min={addMonths(current, -12)} onChange={(e) => { setEffectiveFrom(e.target.value); setErrors((p) => ({ ...p, effectiveFrom: undefined })) }} className="w-48" aria-invalid={errors.effectiveFrom ? true : undefined} />
                  <FieldDescription>
                    {closedForPeriod
                      ? `${formatPeriod(effectiveFrom)} já está fechado: o fechamento gravado não muda. A regra vale para novos fechamentos.`
                      : "O fechamento usa a versão vigente no mês fechado."}
                  </FieldDescription>
                  <FieldError>{errors.effectiveFrom}</FieldError>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Salvar nova versão
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Reserva Legal</CardTitle>
              <CardDescription>Mínimo de 10% das sobras.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Fundo para reparar perdas e apoiar o desenvolvimento da cooperativa. Obrigatório pela Lei 5.764/1971, art. 28, inciso I.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>FATES</CardTitle>
              <CardDescription>Mínimo de 5% das sobras.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Fundo de Assistência Técnica, Educacional e Social: capacitação e apoio aos cooperados e famílias. Lei 5.764/1971, art. 28, inciso II.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <InfoIcon className="size-4" />
                Retirada mínima
              </CardTitle>
              <CardDescription>Lei 12.690/2012, art. 7.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cooperativas de trabalho podem precisar garantir retirada não inferior ao piso. Confirme com o contador se isso se aplica; o sistema pode alertar, mas não bloqueia.
            </CardContent>
            <CardFooter>
              <Button variant="link" size="sm" className="px-0" render={<a href="https://www.planalto.gov.br/ccivil_03/leis/l5764.htm" target="_blank" rel="noreferrer" />} nativeButton={false}>
                Ler a Lei 5.764/1971
                <ExternalLinkIcon data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de versões</CardTitle>
          <CardDescription>Cada fechamento usa a versão com maior “vigente a partir de” menor ou igual ao mês.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vigente a partir de</TableHead>
                <TableHead className="text-right">Reserva Legal</TableHead>
                <TableHead className="text-right">FATES</TableHead>
                <TableHead className="text-right">Outros</TableHead>
                <TableHead className="hidden md:table-cell">Saldo negativo</TableHead>
                <TableHead className="hidden lg:table-cell">Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((version) => (
                <TableRow key={version.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {formatPeriod(version.effectiveFrom)}
                      {version.id === active.id && <Badge>vigente</Badge>}
                      {version.isLegalDefault && <Badge variant="outline">mínimos legais</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(version.legalReserveRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(version.fatesRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(version.otherFundsRate)}</TableCell>
                  <TableCell className="hidden md:table-cell">{version.negativeBalancePolicy === "carry_over" ? "Passa para o próximo mês" : "Perdoa"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDateTime(version.createdAt)} por {version.createdBy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
