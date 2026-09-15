# Feedback do cliente (INSS, compras, solto/prensado, cooperados) — plano de implementação no protótipo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar as decisões DEC-006..DEC-009 (spec 0.4.0) para o protótipo frontend em `apps/web`, na ordem TK-023 → TK-024 → TK-025 → TK-026.

**Architecture:** O protótipo é Next.js com um "servidor falso" em `apps/web/lib/demo/store.tsx` (estado em memória, latência simulada, regras de negócio) e um módulo de cálculo puro em `apps/web/lib/domain/payout.ts` testado com vitest. Cada tarefa mexe primeiro no domínio/tipos (com teste), depois no store, depois nas telas. Sem banco e sem tRPC real nesta fase.

**Tech Stack:** Next 16, React 19, TypeScript, vitest, shadcn/ui via `@workspace/ui` (Base UI), lucide-react.

**Spec:** `estudo/spec/` (regras RN-002, RN-003, RN-009, RN-028, RN-029, RN-030; fixtures `FX-ago-2026-com-inss`, `FX-out-2026-compras-inss`; telas UI-vendas, UI-fechamento, UI-cooperados, UI-parametros, UI-extrato-cooperado; tarefas TK-023..TK-026).

## Global Constraints

- Código 100% em inglês, interface 100% em pt-BR (DEC-004).
- Dinheiro em centavos inteiros dentro do cálculo; `roundHalfEven` para subtotais e INSS; `floor` para a diária (RN-001, RN-012).
- Regime de competência pela data do lançamento; `deletedAt` não conta (RN-003).
- Mês fechado bloqueia criar/excluir lançamento (RN-011): toda mutation de compra passa por `assertOpen`.
- Toda ação destrutiva pede confirmação repetindo o que vai acontecer (princípio UX #4).
- Números de agosto/2026 no seed batem com `FX-ago-2026-com-fundos` quando `inssRate = 0` e com `FX-ago-2026-com-inss` quando `inssRate = 0.075`.
- Rodar `pnpm --filter web typecheck`, `pnpm --filter web lint` e `pnpm --filter web test:run` antes de cada commit.

---

### Task 1 (TK-023): Estado do material (solto/prensado) em vendas

**Files:**
- Modify: `apps/web/lib/demo/types.ts` (MaterialCondition, MaterialType.defaultCondition, SaleItem.condition, label)
- Modify: `apps/web/lib/demo/seed.ts` (defaultCondition por material; condition nos itens de venda)
- Modify: `apps/web/lib/demo/store.tsx` (SaleDraftItem.condition; createSale copia; selector `lastPricePerKg`)
- Modify: `apps/web/components/screens/sales-screen.tsx` (toggle Solto/Prensado, placeholder de último preço, badge nas listas)
- Test: `apps/web/lib/demo/store.test.ts` (novo, para `lastPricePerKg`)

**Interfaces:**
- Produces: `type MaterialCondition = "loose" | "baled"`, `MATERIAL_CONDITION_LABEL`, `SaleItem.condition`, `MaterialType.defaultCondition`, `lastPricePerKg(data, { materialTypeId, condition, buyerId? , supplierId? }): { pricePerKg: number; on: string } | null`.

- [x] **Step 1: Tipos**

```ts
export type MaterialCondition = "loose" | "baled"
export const MATERIAL_CONDITION_LABEL: Record<MaterialCondition, string> = { loose: "Solto", baled: "Prensado" }
export type MaterialType = { id: string; name: string; category: MaterialCategory; defaultCondition: MaterialCondition; active: boolean }
export type SaleItem = { id: string; materialTypeId: string; condition: MaterialCondition; weightKg: number; pricePerKg: number; subtotal: number }
```

- [x] **Step 2: Seed** — `defaultCondition: "baled"` em plásticos, papéis e alumínio; `"loose"` em ferro, cobre, vidro, rejeito. `buildSale` aceita `condition?` por item e cai no default do material.

- [x] **Step 3: Teste falhando** para `lastPricePerKg` em `store.test.ts`: dado o seed, `lastPricePerKg(seed, { materialTypeId: "mt-papelao", condition: "baled", buyerId: "b1" })` devolve `{ pricePerKg: 0.65, on: "2026-08-08" }`; com `condition: "loose"` devolve `null`; venda com `deletedAt` é ignorada.

- [x] **Step 4: Implementar** `lastPricePerKg` no store (função pura exportada, sem hook). Percorre `data.sales` (e `data.purchases` quando `supplierId`, adicionado na Task 2) ordenadas por data desc.

- [x] **Step 5: Tela de vendas** — `ToggleGroup` com dois `ToggleGroupItem` ("Solto", "Prensado") ao lado do select de material; ao trocar material, `setCondition(material.defaultCondition)`. Placeholder do preço = último preço formatado quando existir (`FieldDescription`: "Último preço com este comprador: R$ 0,65/kg"). Badge do estado na tabela de itens, na lista do mês e no diálogo de detalhe.

- [x] **Step 6: typecheck + lint + test; commit** `feat(web): material condition (solto/prensado) on sale items`

---

### Task 2 (TK-024): Compras de material

**Files:**
- Modify: `apps/web/lib/demo/types.ts` (Supplier, SupplierKind, PaymentMethod, Purchase, PurchaseItem, DemoData.suppliers/purchases, Payout.totalPurchases, labels)
- Modify: `apps/web/lib/demo/errors.ts` (ERR-PURCHASE-001..003)
- Modify: `apps/web/lib/domain/payout.ts` (input.purchases, totalPurchases, RN-003)
- Modify: `apps/web/lib/domain/payout.test.ts` (compras reduzem a sobra; excluída e fora do mês não contam)
- Modify: `apps/web/lib/demo/seed.ts` (suppliers, purchases de setembro; payout de julho com totalPurchases 0)
- Modify: `apps/web/lib/demo/store.tsx` (createSupplier, createPurchase, deletePurchase; runSimulation e closePayout com purchases)
- Create: `apps/web/components/screens/purchases-section.tsx` (formulário + lista + diálogo de fornecedor + recibo)
- Modify: `apps/web/components/screens/sales-screen.tsx` (renderiza `<PurchasesSection />` abaixo; título "Vendas e compras")
- Modify: `apps/web/components/payout-summary.tsx` (PayoutTotals.totalPurchases; card "Compras de material")
- Modify: `apps/web/components/screens/payout-screen.tsx` (mensagem NO_SURPLUS cita compras)
- Modify: `apps/web/components/screens/home-screen.tsx` (sobra parcial desconta compras)
- Modify: `apps/web/lib/navigation.ts` (label "Vendas e compras")

**Interfaces:**
- Produces:
```ts
export type SupplierKind = "individual" | "company"
export type PaymentMethod = "cash" | "pix"
export type Supplier = { id: string; kind: SupplierKind; name: string; cpf: string; cnpj: string; pixKey: string; phone: string; active: boolean }
export type PurchaseItem = { id: string; materialTypeId: string; condition: MaterialCondition; weightKg: number; pricePerKg: number; subtotal: number }
export type Purchase = { id: string; supplierId: string; purchasedOn: string; items: PurchaseItem[]; totalAmount: number; totalWeightKg: number; paymentMethod: PaymentMethod; paidOn: string | null; note: string; deletedAt: string | null; createdBy: string; createdAt: string }
// payout.ts
PayoutInput.purchases: { purchasedOn: string; totalAmount: number; deletedAt?: string | null }[]
PayoutResult.totalPurchases: number   // surplus = grossRevenue − totalPurchases − totalExpenses
SimulationOutcome details.totalPurchases: number
// store
createSupplier(input: { kind; name; cpf; cnpj; pixKey; phone }): Promise<Supplier>   // CPF já existente devolve o existente
createPurchase(input: { supplierId; purchasedOn; items: PurchaseDraftItem[]; paymentMethod; paidOn: string | null; note }, actor): Promise<Purchase>
deletePurchase(id): Promise<void>
```

- [x] **Step 1: Teste falhando** em `payout.test.ts`: `input.purchases = [{ purchasedOn: "2026-08-03", totalAmount: 1500 }, { purchasedOn: "2026-08-10", totalAmount: 999, deletedAt: "x" }, { purchasedOn: "2026-09-01", totalAmount: 999 }]` → `totalPurchases 1500`, `surplus 34700`, `distributableSurplus 29495`.
- [x] **Step 2: Implementar** em `payout.ts` (`purchases` opcional com default `[]` para não quebrar chamadas antigas).
- [x] **Step 3: Tipos, erros, seed, store.** Seed: fornecedores `sup-ze` (individual, "Seu Zé (catador)", CPF 39053344705, PIX telefone) e `sup-coop-vizinha` (company, "Cooperativa Vizinha", CNPJ). Compras de setembro/2026: 02/09 Seu Zé papelão solto 800 kg × 0,30 (dinheiro, pago); 08/09 Cooperativa Vizinha PET cristal solto 500 kg × 1,80 (PIX, a pagar). Regras no store: `assertOpen(purchasedOn)`, itens ≥ 1 (ERR-PURCHASE-001), fornecedor e material existentes (ERR-PURCHASE-002), `deletePurchase` soft (ERR-PURCHASE-003).
- [x] **Step 4: `purchases-section.tsx`** — mesmo layout da venda em Card com `border-orange-300/60` e título "Nova compra"; combobox de fornecedor com "Novo fornecedor" (diálogo pergunta Pessoa/Empresa primeiro, depois nome, CPF ou CNPJ, PIX, telefone); itens com material + toggle Solto/Prensado (default do material) + peso + preço (placeholder último preço com esse fornecedor); radio Dinheiro/PIX; switch "Já pago" (paidOn = purchasedOn). Lista "Compras do mês" com badges dos materiais, forma de pagamento, "a pagar" quando `paidOn` nulo, botões Recibo (toast "PDF simulado", como o exportPdf do fechamento) e Excluir (manager, confirmação). Rodapé com resumo por fornecedor.
- [x] **Step 5: Fechamento** — card "Compras de material" entre Receita e Despesas; hint da Receita "Sobra: vendas − compras − despesas". `PayoutTotals.totalPurchases`. Mensagem NO_SURPLUS: "receita R$ X, compras R$ Y e despesas R$ Z". Home: sobra parcial = vendas − compras − despesas.
- [x] **Step 6: typecheck + lint + test; commit** `feat(web): material purchases from suppliers reduce monthly surplus`

---

### Task 3 (TK-025): INSS do cooperado

**Files:**
- Modify: `apps/web/lib/domain/payout.ts` (settings.inssRate; members.inssWithheld; item.inssBase/inssRate/inssAmount; result.inssTotal; RN-002/RN-009 novos)
- Modify: `apps/web/lib/domain/payout.test.ts` (fixture FX-ago-2026-com-inss e saldo devedor sobre bruto − INSS)
- Modify: `apps/web/lib/demo/types.ts` (Member.inssWithheld; PayoutItem.memberCpfSnapshot/inssBase/inssRate/inssAmount; Payout.inssTotal; PayoutSettingsVersion.inssRate)
- Modify: `apps/web/lib/demo/errors.ts` (ERR-SETTINGS-002)
- Modify: `apps/web/lib/demo/seed.ts` (m6 `inssWithheld: false`; ps-1 inssRate 0; nova ps-2 efetiva 2026-08 com 0.075; payout de julho com inss 0)
- Modify: `apps/web/lib/demo/store.tsx` (toPayoutSettings, saveSettings valida 0..0.20, closePayout grava inss)
- Modify: `apps/web/components/payout-summary.tsx` (coluna INSS quando `inssTotal > 0` ou rate > 0; card "INSS retido")
- Modify: `apps/web/components/screens/payout-screen.tsx` (diálogo cita INSS)
- Modify: `apps/web/components/screens/payout-detail-screen.tsx` (CSV com INSS; item "INSS do mês (CSV)" com CPF completo; parâmetro no card)
- Modify: `apps/web/components/screens/statement-screen.tsx` (card "INSS retido")
- Modify: `apps/web/components/screens/payout-settings-screen.tsx` (campo INSS %, validação, histórico, card explicativo)
- Modify: `apps/web/components/screens/members-screen.tsx` (switch "Contribui INSS pelo sistema")

**Interfaces:**
```ts
PayoutSettings.inssRate: number            // LEGAL_DEFAULT_SETTINGS.inssRate = 0.075
PayoutInput.members[].inssWithheld?: boolean  // default true
PayoutItemResult += { inssBase: number; inssRate: number; inssAmount: number }
PayoutResult.inssTotal: number
// RN-002: inss = withheld ? roundHalfEven(gross × rate) : 0; base = gross − inss; net = max(0, base − ded); carry = max(0, ded − base)
```

- [x] **Step 1: Teste falhando** (FX-ago-2026-com-inss): `settings.inssRate = 0.075`, m6 `inssWithheld: false` → Ana inss 352.57 net 4148.39; Roberto inss 336.55; Fernanda inss 0 net 4700.96; `inssTotal 1955.17`; `totalNet 27694.75`. Segundo teste (FX-out): Rita 2 dias, diária 328.40, vale 700 → net 0, carry 92.46.
- [x] **Step 2: Implementar** em `payout.ts`; warning "N cooperado(s) sem desconto de INSS: nomes" quando houver.
- [x] **Step 3: Tipos, seed, store, erros.** `saveSettings`: `inssRate < 0 || > 0.2` → ERR-SETTINGS-002. `closePayout` grava `inssTotal` e por item `memberCpfSnapshot`, `inssBase`, `inssRate`, `inssAmount`.
- [x] **Step 4: Telas.** Tabela: coluna "INSS" (`− R$`) entre Bruto e Vales, oculta quando `totals.inssTotal === 0 && settings.inssRate === 0`; badge "sem INSS" quando `inssRate === 0` no item e o rateio tem INSS. Card "INSS retido" com hint "7,5% sobre o bruto, antes dos vales". Detalhe: dropdown Exportar ganha "INSS do mês (CSV)" → colunas Cooperado;CPF;Base;Aliquota;INSS. Parâmetros: campo "INSS do cooperado" (%, min 0, max 20, step 0.5) com ajuda "Confirme a alíquota com o contador"; coluna INSS no histórico. Extrato: card "INSS retido" ou "Sem desconto de INSS". Cooperados: switch no formulário.
- [x] **Step 5: typecheck + lint + test; commit** `feat(web): INSS withheld from member gross before advances`

---

### Task 4 (TK-026): Cooperados — reativar, excluir sem lançamentos, filtro desligados

**Files:**
- Modify: `apps/web/lib/demo/errors.ts` (ERR-MEMBER-004, ERR-MEMBER-005)
- Modify: `apps/web/lib/demo/store.tsx` (`memberHasRecords(data, id)`, `reactivateMember`, `deleteMember`)
- Modify: `apps/web/components/screens/members-screen.tsx` (filtro Ativos/Desligados/Todos; ações Reativar/Excluir; tooltip quando bloqueado)
- Test: `apps/web/lib/demo/store.test.ts` (`memberHasRecords`: m1 true; cooperado novo sem nada false)

**Interfaces:**
```ts
export function memberHasRecords(data: DemoData, memberId: string): boolean // attendances | advances | payouts[].items
reactivateMember(id): Promise<Member>   // ERR-MEMBER-002 | ERR-MEMBER-005 (não desligado)
deleteMember(id): Promise<void>         // ERR-MEMBER-002 | ERR-MEMBER-004 (tem lançamentos)
```

- [x] **Step 1: Teste falhando** para `memberHasRecords`.
- [x] **Step 2: Implementar** selector e ações no store.
- [x] **Step 3: Tela.** `ToggleGroup` com "Ativos" / "Desligados" / "Todos". Menu: "Reativar" (só desligado, confirm "X volta à chamada a partir de hoje."), "Excluir de verdade" (só sem lançamentos; senão item desabilitado com texto "Tem lançamentos: use Desligar"). Toasts de sucesso.
- [x] **Step 4: typecheck + lint + test; commit** `feat(web): reactivate and hard-delete members without records`

---

### Task 5: Verificação final

- [x] `pnpm --filter web build` passa.
- [x] Smoke manual no browser: venda com estado, compra com fornecedor novo, fechamento de agosto mostrando compras e INSS, parâmetros com INSS, cooperado reativado.
- [x] Atualizar status na spec (TK-023..026 continuam `proposto`; o protótipo não é a implementação final).
