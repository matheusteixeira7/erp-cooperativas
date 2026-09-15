"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon, InfoIcon, ScaleIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

import { PageHeader } from "@/components/page-header"
import { QueryError } from "@/components/query-error"
import { addMonths, currentPeriod } from "@/lib/dates"
import type { NegativeBalancePolicy } from "@/lib/domain/enums"
import { INSS_RATE_MAX } from "@/lib/domain/payout"
import { formatDateTime, formatPercent, formatPeriod, parseDecimal } from "@/lib/format"
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client"
import { errorMessage } from "@/lib/trpc/errors"
import { useInvalidateAll } from "@/lib/trpc/hooks"

type SettingsData = RouterOutputs["payoutSettings"]["get"]
type SettingsVersion = SettingsData["current"]

export function PayoutSettingsScreen() {
  const trpc = useTRPC()
  const current = currentPeriod()
  const query = useQuery(trpc.payoutSettings.get.queryOptions({ period: current }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Parâmetros de rateio" description="Percentuais dos fundos legais, INSS do cooperado e regras aplicadas em cada fechamento. Cada alteração vira uma nova versão." />

      {query.isPending ? (
        <div className="grid gap-6 lg:grid-cols-5" aria-busy="true">
          <Skeleton className="h-[520px] lg:col-span-3" />
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} title="Não foi possível carregar os parâmetros" />
      ) : (
        <SettingsContent key={query.data.current.id ?? "default"} data={query.data} current={current} />
      )}
    </div>
  )
}

function SettingsContent({ data, current }: { data: SettingsData; current: string }) {
  const trpc = useTRPC()
  const invalidateAll = useInvalidateAll()
  const active = data.current
  const update = useMutation(trpc.payoutSettings.update.mutationOptions())

  const [legalReserve, setLegalReserve] = React.useState(String(active.legalReserveRate * 100))
  const [fates, setFates] = React.useState(String(active.fatesRate * 100))
  const [other, setOther] = React.useState(String(active.otherFundsRate * 100))
  const [inss, setInss] = React.useState(String(Math.round(active.inssRate * 10000) / 100))
  const [policy, setPolicy] = React.useState<NegativeBalancePolicy>(active.negativeBalancePolicy)
  const [includeLeft, setIncludeLeft] = React.useState(active.includeMembersLeftInPeriod)
  const [effectiveFrom, setEffectiveFrom] = React.useState(current)
  const [errors, setErrors] = React.useState<{ legalReserve?: string; fates?: string; other?: string; inss?: string; effectiveFrom?: string }>({})
  const saving = update.isPending

  const lr = parseDecimal(legalReserve)
  const ft = parseDecimal(fates)
  const ot = parseDecimal(other)
  const ir = parseDecimal(inss)
  const sum = (lr ?? 0) + (ft ?? 0) + (ot ?? 0)

  const periodStatus = useQuery(trpc.payouts.periodStatus.queryOptions({ period: effectiveFrom }, { enabled: /^\d{4}-\d{2}$/.test(effectiveFrom) }))
  const closedForPeriod = periodStatus.data?.closed ?? false

  function validate() {
    const next: typeof errors = {}
    if (lr === null || lr < 10) next.legalReserve = "Mínimo legal: 10% (Lei 5.764, art. 28)."
    if (ft === null || ft < 5) next.fates = "Mínimo legal: 5% (Lei 5.764, art. 28)."
    if (ot === null || ot < 0) next.other = "Informe 0 ou um percentual positivo."
    if (sum >= 100) next.other = "A soma dos fundos precisa ser menor que 100%."
    if (ir === null || ir < 0 || ir > INSS_RATE_MAX * 100) next.inss = `Entre 0% e ${INSS_RATE_MAX * 100}%. Zero desliga o desconto.`
    if (!/^\d{4}-\d{2}$/.test(effectiveFrom)) next.effectiveFrom = "Informe o mês."
    else if (effectiveFrom < addMonths(current, -12)) next.effectiveFrom = "Escolha um mês recente."
    else if (closedForPeriod) next.effectiveFrom = "Este mês já está fechado. Escolha um mês aberto."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate() || lr === null || ft === null || ot === null || ir === null) return
    try {
      const version = await update.mutateAsync({
        effectiveFrom,
        legalReserveRate: lr / 100,
        fatesRate: ft / 100,
        otherFundsRate: ot / 100,
        inssRate: ir / 100,
        negativeBalancePolicy: policy,
        includeMembersLeftInPeriod: includeLeft,
      })
      await invalidateAll()
      toast.add({
        type: "success",
        title: "Parâmetros salvos",
        description: `Valem a partir de ${formatPeriod(version.effectiveFrom)}. Meses já fechados não mudam.`,
      })
    } catch (error) {
      toast.add({ type: "error", title: "Não foi possível salvar", description: errorMessage(error) })
    }
  }

  const history: SettingsVersion[] = data.history

  return (
    <>
      {active.isLegalDefault && (
        <Alert>
          <ScaleIcon />
          <AlertTitle>Usando os mínimos legais</AlertTitle>
          <AlertDescription>
            Reserva Legal 10% e FATES 5%, conforme a Lei 5.764/1971. O estatuto da cooperativa pode definir percentuais maiores.
            {data.isDefault && " Nenhuma versão foi gravada ainda: estes são os padrões do sistema."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={handleSubmit} noValidate>
            <CardHeader>
              <CardTitle>Nova versão dos parâmetros</CardTitle>
              <CardDescription>
                Vigente hoje: Reserva Legal {formatPercent(active.legalReserveRate)}, FATES {formatPercent(active.fatesRate)}, outros {formatPercent(active.otherFundsRate)}, INSS {formatPercent(active.inssRate)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Fundos retidos antes do rateio</FieldLegend>
                  <FieldDescription>Calculados sobre a sobra do mês (vendas menos compras de material e despesas). O que resta é dividido pelas diárias.</FieldDescription>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field data-invalid={errors.legalReserve ? true : undefined}>
                      <FieldLabel htmlFor="rate-legal">Reserva Legal</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="rate-legal"
                          type="number"
                          inputMode="decimal"
                          min={10}
                          step="0.5"
                          value={legalReserve}
                          onChange={(e) => {
                            setLegalReserve(e.target.value)
                            setErrors((p) => ({ ...p, legalReserve: undefined }))
                          }}
                          aria-invalid={errors.legalReserve ? true : undefined}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{errors.legalReserve}</FieldError>
                    </Field>
                    <Field data-invalid={errors.fates ? true : undefined}>
                      <FieldLabel htmlFor="rate-fates">FATES</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="rate-fates"
                          type="number"
                          inputMode="decimal"
                          min={5}
                          step="0.5"
                          value={fates}
                          onChange={(e) => {
                            setFates(e.target.value)
                            setErrors((p) => ({ ...p, fates: undefined }))
                          }}
                          aria-invalid={errors.fates ? true : undefined}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldError>{errors.fates}</FieldError>
                    </Field>
                    <Field data-invalid={errors.other ? true : undefined}>
                      <FieldLabel htmlFor="rate-other">Outros fundos</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="rate-other"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.5"
                          value={other}
                          onChange={(e) => {
                            setOther(e.target.value)
                            setErrors((p) => ({ ...p, other: undefined }))
                          }}
                          aria-invalid={errors.other ? true : undefined}
                        />
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
                  <FieldLegend>INSS do cooperado</FieldLegend>
                  <FieldDescription>Retido do bruto de cada cooperado antes dos vales. A cooperativa guarda o total e recolhe via guia. Quem recolhe por fora é marcado no cadastro do cooperado.</FieldDescription>
                  <Field data-invalid={errors.inss ? true : undefined} className="max-w-xs">
                    <FieldLabel htmlFor="rate-inss">Alíquota</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="rate-inss"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={INSS_RATE_MAX * 100}
                        step="0.5"
                        value={inss}
                        onChange={(e) => {
                          setInss(e.target.value)
                          setErrors((p) => ({ ...p, inss: undefined }))
                        }}
                        aria-invalid={errors.inss ? true : undefined}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>Padrão 7,5%. Confirme a alíquota com o contador (a Lei 10.666/03 fala em 11% para cooperativa de trabalho). Zero desliga o desconto.</FieldDescription>
                    <FieldError>{errors.inss}</FieldError>
                  </Field>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Quando o vale é maior que o bruto</FieldLegend>
                  <FieldDescription>O líquido nunca fica negativo. A comparação é feita sobre o bruto já sem o INSS. A diferença segue esta política.</FieldDescription>
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
                  <Input
                    id="effective-from"
                    type="month"
                    value={effectiveFrom}
                    min={addMonths(current, -12)}
                    onChange={(e) => {
                      setEffectiveFrom(e.target.value)
                      setErrors((p) => ({ ...p, effectiveFrom: undefined }))
                    }}
                    className="w-48"
                    aria-invalid={errors.effectiveFrom ? true : undefined}
                  />
                  <FieldDescription>
                    {closedForPeriod
                      ? `${formatPeriod(effectiveFrom)} já está fechado: o fechamento gravado não muda. Escolha um mês aberto para a nova regra.`
                      : "O fechamento usa a versão vigente no mês fechado. Salvar o mesmo mês de novo substitui a versão daquele mês."}
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
              <CardTitle>INSS do cooperado</CardTitle>
              <CardDescription>Padrão 7,5%, configurável de 0% a 20%.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              O cooperado não é empregado, mas contribui para a Previdência. A cooperativa retém do bruto e recolhe. Exporte o relatório “INSS do mês” no detalhe do fechamento para o contador gerar a guia.
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
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma versão gravada. Os fechamentos usam os mínimos legais até você salvar a primeira.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vigente a partir de</TableHead>
                  <TableHead className="text-right">Reserva Legal</TableHead>
                  <TableHead className="text-right">FATES</TableHead>
                  <TableHead className="text-right">Outros</TableHead>
                  <TableHead className="text-right">INSS</TableHead>
                  <TableHead className="hidden md:table-cell">Saldo negativo</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((version) => (
                  <TableRow key={version.id ?? version.effectiveFrom}>
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
                    <TableCell className="text-right tabular-nums">{formatPercent(version.inssRate)}</TableCell>
                    <TableCell className="hidden md:table-cell">{version.negativeBalancePolicy === "carry_over" ? "Passa para o próximo mês" : "Perdoa"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDateTime(version.createdAt)} por {version.createdBy}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
