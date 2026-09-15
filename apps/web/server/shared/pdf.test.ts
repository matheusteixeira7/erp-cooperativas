// @vitest-environment node

import { describe, expect, it } from "vitest"

import { PdfDocument } from "./pdf"

describe("PdfDocument", () => {
  it("gera um PDF válido com texto acentuado e tabela", () => {
    const doc = new PdfDocument({ title: "Teste" })
    doc.text("Cooperativa Recicla Vida", { size: 14, bold: true })
    doc.text("Alíquota de INSS: 7,5% · Papelão prensado", { size: 10 })
    doc.table([{ header: "Cooperado", width: 3 }, { header: "Líquido", width: 1, align: "right" }], [["João", "R$ 1.000,00"]])
    const buffer = doc.toBuffer()
    const text = buffer.toString("latin1")
    expect(text.startsWith("%PDF-1.4")).toBe(true)
    expect(text).toContain("/Type /Catalog")
    expect(text).toContain("/Count 1")
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true)
    // xref offsets must point at "N 0 obj"
    const startxref = Number(text.split("startxref\n")[1]?.split("\n")[0])
    expect(text.slice(startxref, startxref + 4)).toBe("xref")
  })

  it("quebra página quando o conteúdo passa do fim", () => {
    const doc = new PdfDocument({ title: "Longo" })
    for (let i = 0; i < 120; i++) doc.text(`Linha ${i}`)
    expect(doc.toBuffer().toString("latin1")).toContain("/Count 3")
  })
})
