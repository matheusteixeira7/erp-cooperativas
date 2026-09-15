# Módulos de domínio

Cada domínio de negócio tem uma pasta em `server/modules/<domínio>/`. O
controller tRPC fica em `server/trpc/routers/<domínio>.ts` (convenção de
`docs/trpc.md` e `AGENTS.md`) e só traduz a requisição: schemas Zod de
`.input()`/`.output()`, `actorFromSession(ctx.session)` e a chamada ao caso de
uso. Regras de negócio, transações e acesso a banco ficam no módulo.

```text
modules/<domínio>/
├── <domínio>.service.ts       # casos de uso: regras (RN-*), transações, auditoria
├── <domínio>.repository.ts    # consultas Drizzle por agregado (quando vale separar)
└── <outros>.ts                # ex.: payouts.export.ts (CSV/PDF), default-material-types.ts

modules/shared/
├── actor.ts                   # quem chama (cooperativeId, userId, roles), derivado da sessão
├── schemas.ts                 # primitivos Zod dos controllers (Cpf, LocalDate, Period, Fraction...)
├── period-lock.ts             # RN-011: assertPeriodOpen / periodStatus
└── items.ts                   # RN-015: totais de itens no servidor, cursor de paginação
```

Regras que valem para todo módulo:

- Toda função de serviço recebe `(db: DbClient, actor: Actor, input)`. O
  `cooperativeId` vem sempre do `actor`, nunca do input (RN-027 / PL-007).
- `DbClient` pode ser o `db` da aplicação, uma transação (`db.transaction`) ou o
  banco de teste. Serviços que gravam mais de uma tabela abrem a transação e
  passam `tx` para as funções internas.
- Erros de negócio são `DomainError(code)` do catálogo em
  `server/shared/errors.ts` (50-api/erros.json). O middleware em
  `server/trpc/init.ts` os converte em `TRPCError` com a mensagem pt-BR e expõe
  `data.domainCode` para a UI.
- Toda mutation grava `audit_logs` na mesma transação (`server/shared/audit.ts`,
  PL-006). Exportações com CPF completo também.
- Um módulo pode importar funções exportadas de outro (ex.: `payouts` usa
  `settingsForPeriod` de `payout-settings` e `toAdvanceDto` de `finance`), mas
  nunca as tabelas de outro domínio diretamente para escrever.
- "Hoje" e competência usam `server/shared/dates.ts` no fuso da cooperativa
  (NF-002); nunca `new Date()` direto.

Módulos existentes: `auth` (login, signup, sessão por cookie), `members`,
`attendance`, `catalog` (materiais, compradores, fornecedores), `sales`,
`purchases`, `finance` (despesas e vales), `payout-settings`, `payouts`
(simulação, fechamento, reabertura, extrato, exportações) e `dashboard`
(agregações de leitura para a tela inicial).

Testes: os routers são exercidos via `appRouter.createCaller(createInnerTRPCContext({ session, db }))`
contra o banco de teste (`server/test/db.ts`), com o mesmo seed usado em
desenvolvimento (`server/db/seed-data.ts`).
