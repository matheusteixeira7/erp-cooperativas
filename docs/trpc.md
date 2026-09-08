# Padrão tRPC

Este projeto usa tRPC como BFF tipado do App Router. A API é montada em
`/api/trpc/[trpc]`; routers ficam em `apps/web/server/trpc/routers`, um arquivo
por domínio de negócio. Não crie outro `initTRPC`.

## Regras para novas features

- Use o plural para o namespace do router e verbos para mutations:
  `cooperatives.list`, `cooperatives.byId`, `cooperatives.create`.
- Faça consultas de leitura com `.query()` e alterações com `.mutation()`.
  Nunca esconda uma escrita em uma query.
- Todo input tem schema Zod; todo retorno que atravesse a fronteira da API tem
  `.output()`. Isto mantém banco e UI desacoplados pelo contrato.
- Routers não leem `headers`, cookies ou sessão diretamente. Isso pertence a
  `createTRPCContext`. Features de negócio começam em `protectedProcedure`; só
  endpoints técnicos, como `system.ping`, podem ser públicos.
- Lance `TRPCError` com o código correto (`NOT_FOUND`, `CONFLICT`, `FORBIDDEN`)
  em vez de `Error` genérico.
- Faça paginação baseada em cursor para listas que possam crescer. `cursor` deve
  ser `nullish()`, pois o cliente pode reenviar `undefined` durante refetch.
- No Server Component, crie um caller com `createCaller` e o contexto interno;
  não faça fetch HTTP para a própria aplicação. Componentes de cliente consomem
  `/api/trpc` com `@trpc/client` (ou a integração de React Query quando ela for
  adicionada).

## Exemplo: router de cooperativas

Crie `apps/web/server/trpc/routers/cooperatives.ts` seguindo este contrato. A
camada de repositório é ilustrativa: ela deve concentrar o acesso ao banco e
aplicar sempre o `cooperativeId` da sessão, nunca um valor informado pelo cliente.

```ts
import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { createTRPCRouter, protectedProcedure } from "../init"

const cooperativeSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  status: z.enum(["active", "inactive"]),
})

const listInput = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(2).max(100).optional(),
})

export const cooperativesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listInput)
    .output(z.object({ items: z.array(cooperativeSchema), nextCursor: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      return cooperativeRepository.list({
        tenantId: ctx.session.cooperativeId,
        ...input,
      })
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(cooperativeSchema)
    .query(async ({ ctx, input }) => {
      const cooperative = await cooperativeRepository.byId({
        tenantId: ctx.session.cooperativeId,
        id: input.id,
      })
      if (!cooperative) throw new TRPCError({ code: "NOT_FOUND" })
      return cooperative
    }),
})
```

Depois registre-o em `root.ts`:

```ts
export const appRouter = createTRPCRouter({
  system: systemRouter,
  cooperatives: cooperativesRouter,
})
```

## Consultas de referência

Em código de servidor, use o caller direto, com contexto construído para a
requisição atual. Em testes, use `createInnerTRPCContext({ session })` para
fornecer uma sessão sem criar uma requisição HTTP.

```ts
const caller = appRouter.createCaller(
  createInnerTRPCContext({ session: authenticatedSession }),
)

const page = await caller.cooperatives.list({ limit: 20, search: "agro" })
const cooperative = await caller.cooperatives.byId({ id: cooperativeId })
```

No browser, o cliente tipado deve importar somente o tipo do router e apontar
para o mesmo endpoint:

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@/server/trpc/root"

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
})

const result = await trpc.cooperatives.list.query({ limit: 20 })
```

Quando a primeira tela interativa que faça cache/refetch for criada, adicione a
integração oficial tRPC + TanStack Query; não introduza estado de cache manual.
