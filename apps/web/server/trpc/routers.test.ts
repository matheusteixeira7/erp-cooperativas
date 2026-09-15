// @vitest-environment node

/**
 * Router tests against a real PostgreSQL (see server/test/db.ts). Each block
 * reseeds the demo dataset so assertions are deterministic. Skipped as a whole
 * when the database is not reachable.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { ids } from "@/server/db/seed-data"
import { callerFor, closeTestDb, databaseAvailable, seedTestDatabase, sessions } from "@/server/test/db"

const available = await databaseAvailable()

describe.skipIf(!available)("routers (banco de teste)", () => {
  beforeAll(async () => {
    await seedTestDatabase()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  describe("auth", () => {
    it("faz login com as credenciais do seed e devolve cookie httpOnly", async () => {
      const headers = new Headers()
      const caller = callerFor(null, headers)
      const result = await caller.auth.login({ email: "marta@reciclavida.coop", password: "demo123" })
      expect(result.user.roles).toEqual(["manager", "operator"])
      expect(result.user.cooperative.name).toBe("Cooperativa Recicla Vida")
      expect(headers.get("set-cookie")).toMatch(/erp_session=.+HttpOnly/)
    })

    it("rejeita senha errada com ERR-AUTH-003", async () => {
      const caller = callerFor(null)
      await expect(caller.auth.login({ email: "marta@reciclavida.coop", password: "errada" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "E-mail ou senha incorretos.",
      })
    })

    it("session devolve null sem cookie", async () => {
      await expect(callerFor(null).auth.session()).resolves.toBeNull()
    })
  })

  describe("isolamento de tenant (RN-027 / TS-017)", () => {
    it("outra cooperativa não vê nada do seed", async () => {
      const other = callerFor(sessions.otherTenant)
      await expect(other.members.list({ includeInactive: true })).resolves.toEqual({ items: [] })
      await expect(other.sales.list({ period: "2026-08", limit: 50 })).resolves.toMatchObject({ items: [], totals: { amount: 0 } })
      await expect(other.payouts.byId({ id: ids.payout("p-2026-07") })).rejects.toMatchObject({ code: "NOT_FOUND" })
      await expect(other.members.byId({ id: ids.member("m1") })).rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })

  describe("perfis (PL-001)", () => {
    it("operador não fecha mês nem vê parâmetros", async () => {
      const operator = callerFor(sessions.operator)
      await expect(operator.payouts.simulate({ period: "2026-08" })).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(operator.payoutSettings.get({})).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("operador vê a lista de cooperados sem chave PIX (PL-005)", async () => {
      const { items } = await callerFor(sessions.operator).members.list({ includeInactive: false })
      expect(items.length).toBeGreaterThan(0)
      expect(items.every((m) => m.pixKey === null)).toBe(true)
      expect(items.every((m) => m.cpf === null)).toBe(true)
      expect(items[0]?.cpfMasked).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/)
    })

    it("cooperado só acessa o próprio extrato", async () => {
      const member = callerFor(sessions.member)
      await expect(member.members.list({ includeInactive: false })).rejects.toMatchObject({ code: "FORBIDDEN" })
      const statement = await member.payouts.memberStatement({ period: "2026-07", memberId: ids.member("m2") })
      // memberId from the client is ignored: the statement is Ana's (m1).
      expect(statement?.member.id).toBe(ids.member("m1"))
      expect(statement?.closed?.item.workedDays).toBe(20)
    })
  })

  describe("members", () => {
    beforeEach(async () => {
      await seedTestDatabase()
    })

    it("cria, edita, desliga, reativa e apaga cooperado sem lançamentos (RN-029)", async () => {
      const manager = callerFor(sessions.manager)
      const created = await manager.members.create({ name: "Novo Cooperado", cpf: "39053344705", pixKey: "", phone: "", admittedOn: "2026-09-01", inssWithheld: true, notes: "" })
      expect(created.active).toBe(true)
      expect(created.hasRecords).toBe(false)
      expect(created.cpf).toBe("39053344705")

      const updated = await manager.members.update({ id: created.id, name: "Novo Cooperado Silva", inssWithheld: false })
      expect(updated.name).toBe("Novo Cooperado Silva")
      expect(updated.inssWithheld).toBe(false)

      const left = await manager.members.deactivate({ id: created.id, leftOn: "2026-09-10" })
      expect(left.leftOn).toBe("2026-09-10")
      await expect(manager.members.reactivate({ id: ids.member("m1") })).rejects.toMatchObject({ code: "CONFLICT", message: "Este cooperado já está ativo." })
      const back = await manager.members.reactivate({ id: created.id })
      expect(back.leftOn).toBeNull()

      await expect(manager.members.delete({ id: created.id })).resolves.toEqual({ ok: true })
      await expect(manager.members.byId({ id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("recusa CPF duplicado (ERR-MEMBER-001) e exclusão de quem tem lançamentos (ERR-MEMBER-004)", async () => {
      const manager = callerFor(sessions.manager)
      await expect(manager.members.create({ name: "Duplicado", cpf: "52601815906", pixKey: "", phone: "" })).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(manager.members.delete({ id: ids.member("m8") })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("não pode ser excluído") })
    })

    it("cria acesso ao extrato para o cooperado (usuário com perfil member)", async () => {
      const manager = callerFor(sessions.manager)
      const member = await manager.members.update({ id: ids.member("m2"), access: { email: "carlos@reciclavida.coop", password: "segredo1" } })
      expect(member.hasAccess).toBe(true)
      expect(member.accessEmail).toBe("carlos@reciclavida.coop")
      const login = await callerFor(null).auth.login({ email: "carlos@reciclavida.coop", password: "segredo1" })
      expect(login.user.roles).toEqual(["member"])
      expect(login.user.memberId).toBe(ids.member("m2"))
      const revoked = await manager.members.update({ id: ids.member("m2"), access: null })
      expect(revoked.hasAccess).toBe(false)
    })
  })

  describe("attendance", () => {
    beforeEach(async () => {
      await seedTestDatabase()
    })

    it("lista ativos na data e faz upsert idempotente (RN-013)", async () => {
      const operator = callerFor(sessions.operator)
      const before = await operator.attendance.byDate({ date: "2026-09-09" })
      expect(before.recorded).toBe(false)
      expect(before.entries.map((e) => e.memberName)).toContain("Juliana Ferreira")
      expect(before.entries.map((e) => e.memberName)).not.toContain("Paulo Henrique Rocha")

      const entries = before.entries.map((e, index) => ({ memberId: e.memberId, present: index % 2 === 0 }))
      const first = await operator.attendance.saveDaily({ date: "2026-09-09", entries })
      const second = await operator.attendance.saveDaily({ date: "2026-09-09", entries })
      expect(first).toEqual(second)

      const after = await operator.attendance.byDate({ date: "2026-09-09" })
      expect(after.recorded).toBe(true)
      expect(after.entries.filter((e) => e.present).length).toBe(first.presentCount)
    })

    it("bloqueia chamada em mês fechado (RN-011) e cooperado inativo na data (ERR-MEMBER-003)", async () => {
      const operator = callerFor(sessions.operator)
      await expect(operator.attendance.saveDaily({ date: "2026-07-10", entries: [{ memberId: ids.member("m1"), present: true }] })).rejects.toMatchObject({ code: "CONFLICT" })
      await expect(operator.attendance.saveDaily({ date: "2026-08-10", entries: [{ memberId: ids.member("m9"), present: true }] })).rejects.toMatchObject({
        code: "UNPROCESSABLE_CONTENT",
        message: "Cooperado não estava ativo nesta data.",
      })
    })
  })

  describe("sales, purchases, catalog", () => {
    beforeEach(async () => {
      await seedTestDatabase()
    })

    it("calcula totais no servidor (RN-015) e lista com nomes resolvidos", async () => {
      const operator = callerFor(sessions.operator)
      const sale = await operator.sales.create({
        buyerId: ids.buyer("b1"),
        soldOn: "2026-09-10",
        items: [
          { materialTypeId: ids.material("mt-papelao"), condition: "baled", weightKg: 1000.5, pricePerKg: 0.655 },
          { materialTypeId: ids.material("mt-pet-cristal"), condition: "loose", weightKg: 200, pricePerKg: 2.1 },
        ],
        invoiceNumber: "000500",
      })
      expect(sale.buyerName).toBe("Reciclagem Indústria X")
      expect(sale.items[0]?.subtotal).toBe(655.33) // 1000.5 × 0.655 = 655.3275 → half-even
      expect(sale.totalAmount).toBe(1075.33)
      expect(sale.totalWeightKg).toBe(1200.5)

      const list = await operator.sales.list({ period: "2026-09", limit: 50 })
      expect(list.items[0]?.id).toBe(sale.id)
      expect(list.totals.count).toBe(2)
      expect(list.byMaterial.some((m) => m.materialTypeName === "Papelão Ondulado" && m.condition === "baled")).toBe(true)
    })

    it("sugere o último preço por comprador/fornecedor + material + estado (RN-030)", async () => {
      const operator = callerFor(sessions.operator)
      await expect(operator.materialTypes.lastPrice({ materialTypeId: ids.material("mt-papelao"), condition: "baled", buyerId: ids.buyer("b1") })).resolves.toEqual({ pricePerKg: 0.65, on: "2026-08-08" })
      await expect(operator.materialTypes.lastPrice({ materialTypeId: ids.material("mt-papelao"), condition: "loose", buyerId: ids.buyer("b1") })).resolves.toBeNull()
      await expect(operator.materialTypes.lastPrice({ materialTypeId: ids.material("mt-papelao"), condition: "loose", supplierId: ids.supplier("sup-ze") })).resolves.toEqual({ pricePerKg: 0.3, on: "2026-09-02" })
    })

    it("soft delete ignora a venda no cálculo e na sugestão (RN-022)", async () => {
      const manager = callerFor(sessions.manager)
      await manager.sales.delete({ id: ids.sale("s-ago-1") })
      // Only the July sale (0.60 on 2026-07-07) remains for b1 + papelão prensado.
      await expect(manager.materialTypes.lastPrice({ materialTypeId: ids.material("mt-papelao"), condition: "baled", buyerId: ids.buyer("b1") })).resolves.toEqual({ pricePerKg: 0.6, on: "2026-07-07" })
      const list = await manager.sales.list({ period: "2026-08", limit: 50 })
      expect(list.items.some((s) => s.id === ids.sale("s-ago-1"))).toBe(false)
      await expect(manager.sales.delete({ id: ids.sale("s-jul-1") })).rejects.toMatchObject({ code: "CONFLICT" }) // mês fechado
    })

    it("compra de material: fornecedor duplicado por CPF é reaproveitado e recibo em PDF sai", async () => {
      const operator = callerFor(sessions.operator)
      const same = await operator.suppliers.create({ kind: "individual", name: "Zé de novo", cpf: "39053344705" })
      expect(same.id).toBe(ids.supplier("sup-ze"))
      const purchase = await operator.purchases.create({
        supplierId: same.id,
        purchasedOn: "2026-09-10",
        items: [{ materialTypeId: ids.material("mt-vidro"), condition: "loose", weightKg: 300, pricePerKg: 0.1 }],
        paymentMethod: "cash",
        paidOn: "2026-09-10",
      })
      expect(purchase.totalAmount).toBe(30)
      expect(purchase.supplierDocument).toBe("CPF ***.533.447-**")
      const receipt = await operator.purchases.receipt({ id: purchase.id })
      expect(receipt.mimeType).toBe("application/pdf")
      expect(Buffer.from(receipt.base64, "base64").subarray(0, 5).toString("latin1")).toBe("%PDF-")
      const list = await operator.purchases.list({ period: "2026-09", limit: 50 })
      expect(list.bySupplier.find((s) => s.supplierId === same.id)?.count).toBe(2)
    })
  })

  describe("payouts", () => {
    beforeEach(async () => {
      await seedTestDatabase()
    })

    it("simula agosto/2026 com os números da fixture FX-ago-2026-com-fundos + INSS 7,5%", async () => {
      const manager = callerFor(sessions.manager)
      const simulation = await manager.payouts.simulate({ period: "2026-08" })
      expect(simulation.periodClosed).toBe(false)
      expect(simulation.settings.inssRate).toBe(0.075)
      expect(simulation.outcome.ok).toBe(true)
      if (!simulation.outcome.ok) return
      const r = simulation.outcome.result
      expect(r.grossRevenue).toBe(48500)
      expect(r.totalExpenses).toBe(12300)
      expect(r.surplus).toBe(36200)
      expect(r.legalReserveAmount).toBe(3620)
      expect(r.fatesAmount).toBe(1810)
      expect(r.distributableSurplus).toBe(30770)
      expect(r.totalWorkedDays).toBe(144)
      expect(r.dayValue).toBe(213.68)
      expect(r.distributedTotal).toBe(30769.92)
      expect(r.roundingResidual).toBe(0.08)
      // Fernanda (m6) does not contribute INSS through the system.
      const fernanda = r.items.find((i) => i.memberName === "Fernanda Lima")
      expect(fernanda?.inssAmount).toBe(0)
      expect(fernanda?.inssRate).toBe(0)
      const ana = r.items.find((i) => i.memberName === "Ana Maria Silva")
      expect(ana?.inssAmount).toBe(352.57) // 22 × 213.68 = 4700.96 × 7.5%
      expect(ana?.deductionsAmount).toBe(200)
      expect(ana?.netAmount).toBe(4148.39)
    })

    it("fecha, bloqueia o mês, desconta vales e depois reabre (RN-008, RN-011, RN-023)", async () => {
      const manager = callerFor(sessions.manager)
      const simulation = await manager.payouts.simulate({ period: "2026-08" })
      if (!simulation.outcome.ok) throw new Error("simulação deveria ter sobra")

      await expect(manager.payouts.close({ period: "2026-08", confirmDistributableSurplus: 1 })).rejects.toMatchObject({ code: "CONFLICT" })
      const payout = await manager.payouts.close({ period: "2026-08", confirmDistributableSurplus: simulation.outcome.result.distributableSurplus })
      expect(payout.status).toBe("closed")
      expect(payout.items).toHaveLength(simulation.outcome.result.items.length)
      expect(payout.closedBy).toBe("Marta Ribeiro")

      await expect(manager.payouts.close({ period: "2026-08", confirmDistributableSurplus: payout.distributableSurplus })).rejects.toMatchObject({ code: "CONFLICT", message: "Este mês já tem um fechamento." })
      await expect(manager.expenses.create({ description: "Tarde demais", amount: 10, incurredOn: "2026-08-20" })).rejects.toMatchObject({ code: "CONFLICT" })

      const deducted = await manager.advances.list({ period: "2026-08", status: "deducted", limit: 50 })
      expect(deducted.items.length).toBe(6)
      expect(deducted.items.every((a) => a.deductedInPayoutId === payout.id)).toBe(true)

      const detail = await manager.payouts.byId({ id: payout.id })
      expect(detail.deductedAdvances).toHaveLength(6)

      await manager.payouts.markPaid({ payoutId: payout.id, memberIds: [ids.member("m1")], paid: true })
      const afterPaid = await manager.payouts.byId({ id: payout.id })
      expect(afterPaid.items.find((i) => i.memberId === ids.member("m1"))?.paidAt).not.toBeNull()

      const exported = await manager.payouts.export({ id: payout.id, format: "csv", report: "inss" })
      const csv = Buffer.from(exported.base64, "base64").toString("utf8")
      expect(csv).toContain("526.018.159-06") // full CPF only in the INSS report
      expect(exported.filename).toBe("inss-2026-08.csv")

      await expect(manager.payouts.reopen({ id: payout.id, reason: "curto" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const reopened = await manager.payouts.reopen({ id: payout.id, reason: "Faltou lançar a venda do dia 28" })
      expect(reopened.status).toBe("reopened")
      const pending = await manager.advances.list({ period: "2026-08", status: "pending", limit: 50 })
      expect(pending.items.length).toBe(6)
      await expect(manager.payouts.periodStatus({ period: "2026-08" })).resolves.toMatchObject({ closed: false })
    })

    it("não fecha mês futuro (RN-019) nem mês sem sobra (RN-004)", async () => {
      const manager = callerFor(sessions.manager)
      await expect(manager.payouts.close({ period: "2099-01", confirmDistributableSurplus: 0 })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT", message: "Não é possível fechar um mês futuro." })
      const empty = await manager.payouts.simulate({ period: "2026-03" })
      expect(empty.outcome).toMatchObject({ ok: false, code: "NO_SURPLUS" })
      await expect(manager.payouts.close({ period: "2026-03", confirmDistributableSurplus: 0 })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" })
    })

    it("parâmetros: recusa abaixo do mínimo legal e INSS fora da faixa, grava versão nova", async () => {
      const manager = callerFor(sessions.manager)
      const base = { effectiveFrom: "2026-10", legalReserveRate: 0.1, fatesRate: 0.05, otherFundsRate: 0, inssRate: 0.11, negativeBalancePolicy: "forgive" as const, includeMembersLeftInPeriod: false }
      await expect(manager.payoutSettings.update({ ...base, legalReserveRate: 0.05 })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" })
      await expect(manager.payoutSettings.update({ ...base, inssRate: 0.5 })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" })
      await expect(manager.payoutSettings.update({ ...base, effectiveFrom: "2026-07" })).rejects.toMatchObject({ code: "CONFLICT" })
      const version = await manager.payoutSettings.update(base)
      expect(version.inssRate).toBe(0.11)
      const settings = await manager.payoutSettings.get({ period: "2026-10" })
      expect(settings.current.id).toBe(version.id)
      expect(settings.history).toHaveLength(3)
    })
  })

  describe("dashboard", () => {
    it("resume o mês corrente da cooperativa", async () => {
      await seedTestDatabase()
      const summary = await callerFor(sessions.manager).dashboard.summary()
      expect(summary.activeMembersCount).toBeGreaterThan(0)
      expect(summary.recentSales.length).toBeGreaterThan(0)
      expect(summary.lastClosed?.period).toBe("2026-07")
      expect(summary.lastClosed?.unpaidCount).toBe(1)
    })
  })
})
