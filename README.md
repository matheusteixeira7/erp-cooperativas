# Recicla ERP

ERP para cooperativas de materiais recicláveis: chamada diária, vendas e compras
de material, despesas e vales, fechamento mensal com rateio por dias trabalhados
(fundos legais, INSS do cooperado) e extrato do cooperado.

Monorepo pnpm + Turborepo. O app está em `apps/web` (Next.js 16, App Router),
com API tRPC em `/api/trpc`, PostgreSQL e Drizzle ORM. Componentes de UI vêm de
`packages/ui` (shadcn/ui).

A especificação funcional (regras, entidades, contratos) está em
`estudo/spec`; comece por `estudo/spec/README.md`.

## Rodando local

```bash
pnpm install
docker compose up -d postgres
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web db:migrate   # aplica as migrations de apps/web/drizzle
pnpm --filter web db:seed      # cooperativa demo, 3 usuários, dados de jul–set/2026
pnpm dev
```

Contas do seed (senha `demo123`): `marta@reciclavida.coop` (gestor + operador),
`jorge@reciclavida.coop` (operador) e `ana@reciclavida.coop` (cooperado).
Em desenvolvimento a tela de login mostra atalhos para essas contas.
`pnpm --filter web db:setup` roda migrate + seed de uma vez; o seed apaga e
recria todos os dados.

## Qualidade

```bash
pnpm typecheck
pnpm lint
pnpm test:run   # vitest; as suites de banco usam TEST_DATABASE_URL (criado automaticamente)
pnpm build
```

Os testes de routers (`apps/web/server/trpc/routers.test.ts`) rodam contra um
PostgreSQL real em `erp_cooperativas_test`. Se o banco não estiver acessível,
essas suites são puladas e só os testes puros rodam.

## Banco de dados

Tabelas em `apps/web/server/db/schema.ts`. Depois de alterar o schema:

```bash
pnpm --filter web db:generate   # gera a migration em apps/web/drizzle
pnpm --filter web db:migrate
```

Para prototipar rápido use `pnpm --filter web db:push`; as migrations geradas
devem ser versionadas.

## Arquitetura do servidor

- `server/trpc/routers/*.ts`: um router por domínio (controllers: Zod de
  entrada/saída, mapeamento para os casos de uso). Ver `docs/trpc.md`.
- `server/modules/<domínio>/`: casos de uso e acesso a banco por domínio. Ver
  `apps/web/server/modules/README.md`.
- `server/shared/`: catálogo de erros, auditoria, datas no fuso da cooperativa,
  hash de senha e gerador de PDF.
- `lib/domain/payout.ts`: cálculo puro do rateio, compartilhado com a UI.

Autenticação: cookie httpOnly com token opaco (tabela `sessions`), resolvido só
em `createTRPCContext`. Toda tabela de negócio tem `cooperative_id`, sempre
vindo da sessão.

## Adicionando componentes de UI

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Os componentes ficam em `packages/ui/src/components` e são importados como
`@workspace/ui/components/button`.
