/**
 * Exports: payout statement (CSV/PDF) and the "INSS do mês" report for the
 * accountant (CSV/PDF, the only output with full CPF; audited, PL-005).
 * Purchase receipt (PDF) lives here too because it reuses the PDF writer.
 */
import type { DbClient } from "@/server/db/client"
import { getPurchase } from "@/server/modules/purchases/purchases.service"
import type { Actor } from "@/server/modules/shared/actor"
import { audit } from "@/server/shared/audit"
import { PdfDocument } from "@/server/shared/pdf"

import { loadForExport, type PayoutDto } from "./payouts.service"

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

function periodLabel(period: string) {
  const [year, month] = period.split("-")
  return `${MONTHS[Number(month) - 1] ?? month}/${year}`
}

function money(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}

function csvMoney(value: number) {
  return value.toFixed(2).replace(".", ",")
}

function percent(rate: number) {
  return `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
}

function dateLabel(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function dateTimeLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(iso))
}

function formatCpf(digits: string) {
  if (digits.length !== 11) return digits
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function csv(header: string[], rows: string[][]) {
  const body = [header, ...rows].map((cols) => cols.map((c) => (/[;"\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)).join(";")).join("\r\n")
  return Buffer.from(`\uFEFF${body}`, "utf8")
}

export type ExportFile = { filename: string; mimeType: string; base64: string }

function payoutCsv(payout: PayoutDto, timeZone: string): Buffer {
  return csv(
    ["Cooperado", "Dias", "Bruto", "INSS", "Vales", "Liquido", "Saldo devedor", "Pago em"],
    payout.items.map((i) => [
      i.memberNameSnapshot,
      String(i.workedDays),
      csvMoney(i.grossAmount),
      csvMoney(i.inssAmount),
      csvMoney(i.deductionsAmount),
      csvMoney(i.netAmount),
      csvMoney(i.carryOverDebt),
      i.paidAt ? dateTimeLabel(i.paidAt, timeZone) : "",
    ]),
  )
}

function inssCsv(payout: PayoutDto, cpfByMember: Map<string, string>): Buffer {
  const rows = payout.items.filter((i) => i.workedDays > 0)
  return csv(
    ["Cooperado", "CPF", "Base", "Aliquota", "INSS retido"],
    [
      ...rows.map((i) => [i.memberNameSnapshot, formatCpf(cpfByMember.get(i.memberId) ?? ""), csvMoney(i.inssBase), percent(i.inssRate), csvMoney(i.inssAmount)]),
      ["TOTAL", "", csvMoney(rows.reduce((s, i) => s + i.inssBase, 0)), "", csvMoney(payout.inssTotal)],
    ],
  )
}

function payoutPdf(payout: PayoutDto, cooperativeName: string, timeZone: string): Buffer {
  const doc = new PdfDocument({ title: `Demonstrativo de rateio ${payout.period}` })
  doc.text(cooperativeName, { size: 14, bold: true })
  doc.text(`Demonstrativo de rateio · ${periodLabel(payout.period)}`, { size: 12 })
  doc.text(`Fechado em ${dateTimeLabel(payout.closedAt, timeZone)} por ${payout.closedBy}${payout.status === "reopened" ? " · REABERTO" : ""}`, { size: 9, gap: 6 })
  doc.rule()
  const summary: [string, string][] = [
    ["Receita de vendas", money(payout.grossRevenue)],
    ["Compras de material", `- ${money(payout.totalPurchases)}`],
    ["Despesas operacionais", `- ${money(payout.totalExpenses)}`],
    ["Sobra do mês", money(payout.surplus)],
    [`Reserva Legal (${percent(payout.settingsSnapshot.legalReserveRate)})`, `- ${money(payout.legalReserveAmount)}`],
    [`FATES (${percent(payout.settingsSnapshot.fatesRate)})`, `- ${money(payout.fatesAmount)}`],
    ...(payout.otherFundsAmount > 0 ? ([[`Outros fundos (${percent(payout.settingsSnapshot.otherFundsRate)})`, `- ${money(payout.otherFundsAmount)}`]] as [string, string][]) : []),
    ["Sobra distribuível", money(payout.distributableSurplus)],
    ["Total de diárias", String(payout.totalWorkedDays)],
    ["Valor da diária", money(payout.dayValue)],
    ["Total distribuído (bruto)", money(payout.distributedTotal)],
    ["Resíduo de arredondamento", money(payout.roundingResidual)],
    ...(payout.inssTotal > 0 ? ([[`INSS retido (${percent(payout.settingsSnapshot.inssRate)})`, `- ${money(payout.inssTotal)}`]] as [string, string][]) : []),
    ["Vales descontados", `- ${money(payout.totalDeductions)}`],
    ["Total líquido a pagar", money(payout.totalNet)],
  ]
  doc.table([{ header: "Resumo", width: 3 }, { header: "", width: 1, align: "right" }], summary, { size: 9 })
  doc.space(12)
  const showInss = payout.inssTotal > 0
  doc.table(
    [
      { header: "Cooperado", width: 3 },
      { header: "Dias", width: 0.7, align: "right" },
      { header: "Bruto", width: 1.3, align: "right" },
      ...(showInss ? [{ header: "INSS", width: 1.2, align: "right" as const }] : []),
      { header: "Vales", width: 1.2, align: "right" },
      { header: "Líquido", width: 1.3, align: "right" },
      { header: "Saldo dev.", width: 1.1, align: "right" },
    ],
    payout.items.map((i) => [
      i.memberNameSnapshot,
      String(i.workedDays),
      money(i.grossAmount),
      ...(showInss ? [money(i.inssAmount)] : []),
      money(i.deductionsAmount),
      money(i.netAmount),
      i.carryOverDebt > 0 ? money(i.carryOverDebt) : "-",
    ]),
    { size: 8.5 },
  )
  doc.space(24)
  doc.text("Assinatura do responsável: ______________________________________", { size: 9 })
  return doc.toBuffer()
}

function inssPdf(payout: PayoutDto, cpfByMember: Map<string, string>, cooperativeName: string): Buffer {
  const doc = new PdfDocument({ title: `INSS do mês ${payout.period}` })
  const rows = payout.items.filter((i) => i.workedDays > 0)
  doc.text(cooperativeName, { size: 14, bold: true })
  doc.text(`INSS retido dos cooperados · ${periodLabel(payout.period)}`, { size: 12 })
  doc.text(`Alíquota vigente: ${percent(payout.settingsSnapshot.inssRate)} sobre o bruto, antes dos vales (RN-028).`, { size: 9, gap: 6 })
  doc.rule()
  doc.table(
    [
      { header: "Cooperado", width: 3 },
      { header: "CPF", width: 1.6 },
      { header: "Base", width: 1.3, align: "right" },
      { header: "Alíquota", width: 0.9, align: "right" },
      { header: "INSS retido", width: 1.3, align: "right" },
    ],
    [
      ...rows.map((i) => [i.memberNameSnapshot, formatCpf(cpfByMember.get(i.memberId) ?? ""), money(i.inssBase), percent(i.inssRate), money(i.inssAmount)]),
      ["TOTAL", "", money(rows.reduce((s, i) => s + i.inssBase, 0)), "", money(payout.inssTotal)],
    ],
    { size: 9 },
  )
  return doc.toBuffer()
}

export async function exportPayout(
  db: DbClient,
  actor: Actor & { cooperativeName: string },
  input: { id: string; format: "csv" | "pdf"; report: "payout" | "inss" },
): Promise<ExportFile> {
  const { payout, cpfByMember } = await loadForExport(db, actor, input.id)
  const base = input.report === "inss" ? `inss-${payout.period}` : `rateio-${payout.period}`
  let buffer: Buffer
  if (input.report === "inss") {
    buffer = input.format === "csv" ? inssCsv(payout, cpfByMember) : inssPdf(payout, cpfByMember, actor.cooperativeName)
    // The only export with full CPF: always audited (PL-005).
    await audit(db, { cooperativeId: actor.cooperativeId, userId: actor.userId, action: "export", entity: "payouts", entityId: payout.id, after: { report: "inss", format: input.format } })
  } else {
    buffer = input.format === "csv" ? payoutCsv(payout, actor.timezone) : payoutPdf(payout, actor.cooperativeName, actor.timezone)
  }
  return {
    filename: `${base}.${input.format}`,
    mimeType: input.format === "csv" ? "text/csv;charset=utf-8" : "application/pdf",
    base64: buffer.toString("base64"),
  }
}

const CONDITION_LABEL = { loose: "solto", baled: "prensado" } as const
const PAYMENT_LABEL = { cash: "Dinheiro", pix: "PIX" } as const

export async function purchaseReceipt(db: DbClient, actor: Actor & { cooperativeName: string }, id: string): Promise<ExportFile> {
  const purchase = await getPurchase(db, actor, id)
  const doc = new PdfDocument({ title: `Recibo de compra ${dateLabel(purchase.purchasedOn)}` })
  doc.text(actor.cooperativeName, { size: 14, bold: true })
  doc.text("Recibo de compra de material", { size: 12, gap: 4 })
  doc.rule()
  doc.text(`Fornecedor: ${purchase.supplierName}${purchase.supplierDocument ? ` · ${purchase.supplierDocument}` : ""}`, { size: 10 })
  doc.text(`Data da compra: ${dateLabel(purchase.purchasedOn)}`, { size: 10 })
  doc.text(`Pagamento: ${PAYMENT_LABEL[purchase.paymentMethod]}${purchase.paidOn ? ` · pago em ${dateLabel(purchase.paidOn)}` : " · a pagar"}`, { size: 10, gap: 8 })
  doc.table(
    [
      { header: "Material", width: 3 },
      { header: "Estado", width: 1 },
      { header: "Peso (kg)", width: 1.2, align: "right" },
      { header: "R$/kg", width: 1.2, align: "right" },
      { header: "Subtotal", width: 1.4, align: "right" },
    ],
    [
      ...purchase.items.map((i) => [i.materialTypeName, CONDITION_LABEL[i.condition], i.weightKg.toFixed(2).replace(".", ","), i.pricePerKg.toFixed(4).replace(".", ","), money(i.subtotal)]),
      ["TOTAL", "", purchase.totalWeightKg.toFixed(2).replace(".", ","), "", money(purchase.totalAmount)],
    ],
    { size: 9 },
  )
  if (purchase.note) doc.text(`Observação: ${purchase.note}`, { size: 9 })
  doc.space(30)
  doc.text(`Recebi de ${actor.cooperativeName} a quantia de ${money(purchase.totalAmount)} referente ao material acima.`, { size: 10, gap: 24 })
  doc.text("______________________________________", { size: 10 })
  doc.text(purchase.supplierName, { size: 9 })
  doc.space(20)
  doc.text(`Emitido em ${dateTimeLabel(new Date().toISOString(), actor.timezone)} · Recicla ERP`, { size: 8 })
  return { filename: `recibo-compra-${purchase.purchasedOn}.pdf`, mimeType: "application/pdf", base64: doc.toBuffer().toString("base64") }
}
