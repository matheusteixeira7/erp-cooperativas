/**
 * Minimal, dependency-free PDF writer for text documents (receipts and payout
 * statements). Produces a valid PDF 1.4 with Helvetica in WinAnsi encoding,
 * which covers Portuguese accents. Good enough for A4 printouts; swap for a
 * full library if graphics are ever needed.
 */

type Line = { text: string; size?: number; bold?: boolean; x?: number; y?: number }

const PAGE_WIDTH = 595.28 // A4 in points
const PAGE_HEIGHT = 841.89
const MARGIN = 48

function encodeWinAnsi(text: string) {
  // Map to cp1252 where possible; replace anything else with '?'.
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63
    if (code < 128) bytes.push(code)
    else if (code >= 160 && code <= 255) bytes.push(code)
    else if (code === 0x2013) bytes.push(0x96) // en dash
    else if (code === 0x2014) bytes.push(0x97) // em dash
    else if (code === 0x2018) bytes.push(0x91)
    else if (code === 0x2019) bytes.push(0x92)
    else if (code === 0x201c) bytes.push(0x93)
    else if (code === 0x201d) bytes.push(0x94)
    else if (code === 0x2022) bytes.push(0x95) // bullet
    else if (code === 0x20ac) bytes.push(0x80)
    else bytes.push(63)
  }
  return Buffer.from(bytes)
}

function escapePdfString(bytes: Buffer) {
  let out = ""
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`
    else out += String.fromCharCode(byte)
  }
  return out
}

/** Rough Helvetica width (avg 0.5em) used for right-aligned columns. */
export function textWidth(text: string, size: number) {
  return text.length * size * 0.5
}

export class PdfDocument {
  private pages: string[][] = []
  private current: string[] = []
  private y = PAGE_HEIGHT - MARGIN

  constructor(private readonly meta: { title: string }) {
    this.pages.push(this.current)
  }

  get cursorY() {
    return this.y
  }

  get contentWidth() {
    return PAGE_WIDTH - 2 * MARGIN
  }

  newPage() {
    this.current = []
    this.pages.push(this.current)
    this.y = PAGE_HEIGHT - MARGIN
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.newPage()
  }

  private textAt(line: Line) {
    const size = line.size ?? 10
    const font = line.bold ? "/F2" : "/F1"
    const x = line.x ?? MARGIN
    const y = line.y ?? this.y
    this.current.push(`BT ${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfString(encodeWinAnsi(line.text))}) Tj ET`)
  }

  text(text: string, options: { size?: number; bold?: boolean; align?: "left" | "right" | "center"; gap?: number } = {}) {
    const size = options.size ?? 10
    this.ensureSpace(size * 1.4)
    let x = MARGIN
    if (options.align === "right") x = PAGE_WIDTH - MARGIN - textWidth(text, size)
    if (options.align === "center") x = (PAGE_WIDTH - textWidth(text, size)) / 2
    this.textAt({ text, size, bold: options.bold, x })
    this.y -= size * 1.4 + (options.gap ?? 0)
  }

  space(points: number) {
    this.y -= points
  }

  rule() {
    this.ensureSpace(8)
    this.current.push(`${MARGIN.toFixed(2)} ${this.y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${this.y.toFixed(2)} l 0.5 w S`)
    this.y -= 8
  }

  /**
   * Table with proportional columns. `align` per column; header row in bold.
   */
  table(columns: { header: string; width: number; align?: "left" | "right" }[], rows: string[][], options: { size?: number } = {}) {
    const size = options.size ?? 9
    const rowHeight = size * 1.6
    const totalWidth = columns.reduce((sum, c) => sum + c.width, 0)
    const scale = this.contentWidth / totalWidth
    const drawRow = (cells: string[], bold: boolean) => {
      this.ensureSpace(rowHeight)
      let x = MARGIN
      columns.forEach((column, index) => {
        const width = column.width * scale
        const cell = cells[index] ?? ""
        const cellX = column.align === "right" ? x + width - textWidth(cell, size) - 2 : x + 2
        this.textAt({ text: cell, size, bold, x: cellX, y: this.y - size })
        x += width
      })
      this.y -= rowHeight
    }
    drawRow(
      columns.map((c) => c.header),
      true,
    )
    this.rule()
    for (const row of rows) drawRow(row, false)
  }

  toBuffer() {
    const objects: string[] = []
    const addObject = (body: string) => {
      objects.push(body)
      return objects.length
    }
    const fontRegular = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    const fontBold = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    const pagesId = objects.length + 1 + this.pages.length * 2
    const pageIds: number[] = []
    for (const page of this.pages) {
      const content = page.join("\n")
      const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`)
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`,
      )
      pageIds.push(pageId)
    }
    const realPagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`)
    if (realPagesId !== pagesId) {
      // Keep the parent reference consistent (should not happen, but be safe).
      for (let i = 0; i < objects.length; i++) objects[i] = objects[i]!.replaceAll(`/Parent ${pagesId} 0 R`, `/Parent ${realPagesId} 0 R`)
    }
    const catalogId = addObject(`<< /Type /Catalog /Pages ${realPagesId} 0 R >>`)
    const infoId = addObject(`<< /Title (${escapePdfString(encodeWinAnsi(this.meta.title))}) /Producer (Recicla ERP) >>`)

    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"
    const offsets: number[] = []
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(out, "latin1"))
      out += `${index + 1} 0 obj\n${body}\nendobj\n`
    })
    const xref = Buffer.byteLength(out, "latin1")
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(out, "latin1")
  }
}
