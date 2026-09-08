# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Banco de dados local

O projeto usa PostgreSQL e Drizzle ORM no app `web`.
As variáveis de ambiente são validadas pelo T3 Env durante o build e antes de
inicializar conexões com o banco.

```bash
docker compose up -d postgres
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web db:generate
pnpm --filter web db:migrate
```

Defina as tabelas em `apps/web/server/db/schema.ts`. Para aplicar rapidamente
alterações de schema durante o desenvolvimento, use `pnpm --filter web db:push`.
As migrations geradas devem ser versionadas no diretório `apps/web/drizzle`.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
