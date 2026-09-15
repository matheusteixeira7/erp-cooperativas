// @vitest-environment node

import { describe, expect, it } from "vitest"

import { createSeed } from "./seed"
import { lastPricePerKg, memberHasRecords } from "./store"

describe("memberHasRecords (RN-029, exclusão real só sem lançamentos)", () => {
  it("cooperado com presença, vale ou fechamento tem lançamentos", () => {
    const data = createSeed()
    expect(memberHasRecords(data, "m1")).toBe(true) // presenças e vales
    expect(memberHasRecords(data, "m8")).toBe(true) // desligado, mas está no fechamento de julho
  })

  it("cooperado recém-cadastrado sem nada pode ser excluído", () => {
    const data = createSeed()
    data.members.push({
      id: "m-novo",
      name: "Cadastrado Por Engano",
      cpf: "39053344705",
      pixKey: "",
      phone: "",
      admittedOn: "2026-09-14",
      leftOn: null,
      inssWithheld: true,
      notes: "",
      hasAccess: false,
    })
    expect(memberHasRecords(data, "m-novo")).toBe(false)
  })

  it("compras com fornecedor não contam como lançamento do cooperado", () => {
    const data = createSeed()
    expect(memberHasRecords(data, "sup-ze")).toBe(false)
  })
})

describe("lastPricePerKg (RN-030, sugestão de preço)", () => {
  it("devolve o último preço praticado com o comprador para material + estado", () => {
    const data = createSeed()
    // Papelão prensado vendido para b1 em 08/08 (0,65) e para b3 em 04/09 (0,70).
    expect(lastPricePerKg(data, { materialTypeId: "mt-papelao", condition: "baled", buyerId: "b1" })).toEqual({
      pricePerKg: 0.65,
      on: "2026-08-08",
    })
    expect(lastPricePerKg(data, { materialTypeId: "mt-papelao", condition: "baled", buyerId: "b3" })).toEqual({
      pricePerKg: 0.7,
      on: "2026-09-04",
    })
  })

  it("não mistura estados nem compradores", () => {
    const data = createSeed()
    expect(lastPricePerKg(data, { materialTypeId: "mt-papelao", condition: "loose", buyerId: "b1" })).toBeNull()
    expect(lastPricePerKg(data, { materialTypeId: "mt-papelao", condition: "baled", buyerId: "b2" })).toBeNull()
  })

  it("ignora vendas excluídas", () => {
    const data = createSeed()
    for (const sale of data.sales) {
      if (sale.buyerId === "b1") sale.deletedAt = "2026-09-01T00:00:00"
    }
    expect(lastPricePerKg(data, { materialTypeId: "mt-papelao", condition: "baled", buyerId: "b1" })).toBeNull()
  })
})
