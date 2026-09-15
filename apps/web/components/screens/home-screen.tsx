"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  DollarSignIcon,
  ShoppingCartIcon,
  TriangleAlertIcon,
  UserCheckIcon,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { QueryError } from "@/components/query-error"
import { StatCard } from "@/components/stat-card"
import { formatDate, formatMoney, formatPeriod, formatWeight } from "@/lib/format"
import { useRequiredSession } from "@/lib/session"
import { useTRPC } from "@/lib/trpc/client"

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export function HomeScreen() {
  const trpc = useTRPC()
  const { session } = useRequiredSession()
  const isManager = session.activeRole === "manager"
  const query = useQuery(trpc.dashboard.summary.queryOptions())
  const data = query.data
  const loading = query.isPending

  const pending: { key: string; title: string; description: string; href: string; action: string; icon: React.ReactNode }[] = []
  if (data && !data.attendance.done) {
    pending.push({
      key: "attendance",
      title: "Chamada de hoje ainda não foi feita",
      description: `${data.attendance.active} cooperados ativos em ${formatDate(data.today)}.`,
      href: "/chamada",
      action: "Fazer chamada",
      icon: <UserCheckIcon />,
    })
  }
  if (data && isManager && !data.previousPeriodClosed) {
    pending.push({
      key: "close",
      title: `${formatPeriod(data.previousPeriod)} ainda está aberto`,
      description: data.previousSimulation
        ? `Sobra distribuível simulada: ${formatMoney(data.previousSimulation.distributableSurplus)}.`
        : "Confira vendas, despesas e presenças antes de fechar.",
      href: "/fechamento",
      action: "Ir para o fechamento",
      icon: <DollarSignIcon />,
    })
  }
  if (data && isManager && data.lastClosed && data.lastClosed.unpaidCount > 0) {
    pending.push({
      key: "paid",
      title: `${data.lastClosed.unpaidCount} cooperado(s) sem pagamento confirmado em ${formatPeriod(data.lastClosed.period)}`,
      description: "Depois de fazer os PIX, marque cada cooperado como pago.",
      href: `/fechamento/${data.lastClosed.id}`,
      action: "Confirmar pagamentos",
      icon: <CalendarCheckIcon />,
    })
  }

  const today = data?.today ?? new Date().toISOString().slice(0, 10)
  const period = data?.period ?? today.slice(0, 7)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${session.name.split(" ")[0]}`}
        description={`Hoje é ${formatDate(today)}. Resumo de ${formatPeriod(period)} na ${session.cooperativeName}.`}
      >
        <Button variant="outline" render={<Link href="/vendas" />} nativeButton={false}>
          <ShoppingCartIcon data-icon="inline-start" />
          Nova venda
        </Button>
        <Button variant="outline" render={<Link href="/financeiro" />} nativeButton={false}>
          <CreditCardIcon data-icon="inline-start" />
          Lançar despesa ou vale
        </Button>
      </PageHeader>

      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} title="Não foi possível carregar o resumo" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              loading={loading}
              label="Chamada de hoje"
              value={data ? (data.attendance.done ? `${data.attendance.present} / ${data.attendance.active}` : "Pendente") : "—"}
              hint={data?.attendance.done ? "presentes registrados" : "Nenhuma presença registrada ainda"}
            />
            <StatCard
              loading={loading}
              label="Vendas do mês"
              value={data ? formatMoney(data.sales.amount) : "—"}
              hint={data ? `${data.sales.count} venda(s) · ${formatWeight(data.sales.weightKg)}` : undefined}
            />
            <StatCard
              loading={loading}
              label="Compras e despesas do mês"
              value={data ? formatMoney(data.purchases + data.expenses) : "—"}
              hint={data ? `Compras de material ${formatMoney(data.purchases)} · despesas ${formatMoney(data.expenses)}` : undefined}
            />
            <StatCard
              loading={loading}
              label="Sobra parcial"
              value={data ? formatMoney(data.partialSurplus) : "—"}
              hint={data ? `${data.workedDays} diárias até agora · ${data.pendingAdvances.count} vale(s) pendente(s) somando ${formatMoney(data.pendingAdvances.amount)}` : undefined}
              highlight={(data?.partialSurplus ?? 0) > 0}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Pendências</CardTitle>
                <CardDescription>O que precisa de atenção agora.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col gap-2" aria-busy="true">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tudo em dia. Nada pendente por aqui.</p>
                ) : (
                  <ItemGroup className="gap-2">
                    {pending.map((item) => (
                      <Item key={item.key} variant="outline">
                        <ItemMedia variant="icon">{item.icon}</ItemMedia>
                        <ItemContent>
                          <ItemTitle>{item.title}</ItemTitle>
                          <ItemDescription>{item.description}</ItemDescription>
                        </ItemContent>
                        <ItemFooter className="justify-end">
                          <Button size="sm" variant="outline" render={<Link href={item.href} />} nativeButton={false}>
                            {item.action}
                            <ArrowRightIcon data-icon="inline-end" />
                          </Button>
                        </ItemFooter>
                      </Item>
                    ))}
                  </ItemGroup>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Últimas vendas</CardTitle>
                <CardDescription>As cinco saídas de material mais recentes.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col gap-2" aria-busy="true">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : !data || data.recentSales.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TriangleAlertIcon className="size-4" /> Nenhuma venda registrada.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Comprador</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="whitespace-nowrap">{formatDate(sale.soldOn)}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              {sale.buyerName}
                              {sale.periodClosed && <Badge variant="outline">mês fechado</Badge>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatWeight(sale.totalWeightKg)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatMoney(sale.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
