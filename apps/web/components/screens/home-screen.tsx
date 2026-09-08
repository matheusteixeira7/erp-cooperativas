"use client"

import Link from "next/link"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { addMonths, currentPeriod, isInPeriod, todayIso } from "@/lib/dates"
import { useRequiredSession } from "@/lib/demo/session"
import { activeMembersOn, closedPayoutFor, runSimulation, useDemo, useSimulatedLoading } from "@/lib/demo/store"
import { formatDate, formatMoney, formatPeriod, formatWeight } from "@/lib/format"

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

export function HomeScreen() {
  const { data, resetCount } = useDemo()
  const { session } = useRequiredSession()
  const loading = useSimulatedLoading(`home-${resetCount}`, 400)
  const isManager = session.activeRole === "manager"
  const today = todayIso()
  const period = currentPeriod()
  const previousPeriod = addMonths(period, -1)

  const activeToday = activeMembersOn(data.members, today)
  const todayAttendance = data.attendances.filter((a) => a.date === today)
  const presentToday = todayAttendance.filter((a) => a.present).length
  const attendanceDone = todayAttendance.length > 0

  const monthSales = data.sales.filter((s) => !s.deletedAt && isInPeriod(s.soldOn, period))
  const monthExpenses = data.expenses.filter((e) => !e.deletedAt && isInPeriod(e.incurredOn, period))
  const revenue = monthSales.reduce((sum, s) => sum + s.totalAmount, 0)
  const expenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0)
  const weight = monthSales.reduce((sum, s) => sum + s.totalWeightKg, 0)
  const pendingAdvances = data.advances.filter((a) => a.status === "pending")
  const pendingTotal = pendingAdvances.reduce((sum, a) => sum + a.amount, 0)
  const workedDays = data.attendances.filter((a) => a.present && isInPeriod(a.date, period)).length

  const previousClosed = closedPayoutFor(data, previousPeriod)
  const previousSimulation = !previousClosed ? runSimulation(data, previousPeriod) : null
  const lastClosed = [...data.payouts].filter((p) => p.status === "closed").sort((a, b) => b.period.localeCompare(a.period))[0]
  const unpaidCount = lastClosed ? lastClosed.items.filter((i) => i.netAmount > 0 && !i.paidAt).length : 0

  const recentSales = [...data.sales].filter((s) => !s.deletedAt).sort((a, b) => b.soldOn.localeCompare(a.soldOn)).slice(0, 5)
  const buyerName = (id: string) => data.buyers.find((b) => b.id === id)?.name ?? "—"

  const pending: { key: string; title: string; description: string; href: string; action: string; icon: React.ReactNode }[] = []
  if (!attendanceDone) {
    pending.push({
      key: "attendance",
      title: "Chamada de hoje ainda não foi feita",
      description: `${activeToday.length} cooperados ativos em ${formatDate(today)}.`,
      href: "/chamada",
      action: "Fazer chamada",
      icon: <UserCheckIcon />,
    })
  }
  if (isManager && !previousClosed) {
    pending.push({
      key: "close",
      title: `${formatPeriod(previousPeriod)} ainda está aberto`,
      description:
        previousSimulation?.ok
          ? `Sobra distribuível simulada: ${formatMoney(previousSimulation.result.distributableSurplus)}.`
          : "Confira vendas, despesas e presenças antes de fechar.",
      href: "/fechamento",
      action: "Ir para o fechamento",
      icon: <DollarSignIcon />,
    })
  }
  if (isManager && lastClosed && unpaidCount > 0) {
    pending.push({
      key: "paid",
      title: `${unpaidCount} cooperado(s) sem pagamento confirmado em ${formatPeriod(lastClosed.period)}`,
      description: "Depois de fazer os PIX, marque cada cooperado como pago.",
      href: `/fechamento/${lastClosed.id}`,
      action: "Confirmar pagamentos",
      icon: <CalendarCheckIcon />,
    })
  }

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          loading={loading}
          label="Chamada de hoje"
          value={attendanceDone ? `${presentToday} / ${activeToday.length}` : "Pendente"}
          hint={attendanceDone ? "presentes registrados" : "Nenhuma presença registrada ainda"}
        />
        <StatCard loading={loading} label="Vendas do mês" value={formatMoney(revenue)} hint={`${monthSales.length} venda(s) · ${formatWeight(weight)}`} />
        <StatCard loading={loading} label="Despesas do mês" value={formatMoney(expenses)} hint={`${monthExpenses.length} lançamento(s)`} />
        <StatCard
          loading={loading}
          label="Sobra parcial"
          value={formatMoney(revenue - expenses)}
          hint={`${workedDays} diárias até agora · ${pendingAdvances.length} vale(s) pendente(s) somando ${formatMoney(pendingTotal)}`}
          highlight={revenue - expenses > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pendências</CardTitle>
            <CardDescription>O que precisa de atenção agora.</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
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
            {recentSales.length === 0 ? (
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
                  {recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(sale.soldOn)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {buyerName(sale.buyerId)}
                          {closedPayoutFor(data, sale.soldOn.slice(0, 7)) && <Badge variant="outline">mês fechado</Badge>}
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
    </div>
  )
}
