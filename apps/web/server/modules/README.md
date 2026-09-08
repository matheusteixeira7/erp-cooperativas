# Módulos de domínio

Cada domínio de negócio possui um módulo próprio e não importa arquivos de
outro módulo. Comunicação entre domínios acontece exclusivamente pela facade
exposta pelo módulo de destino — nunca pelo repositório, entidade ou caso de
uso interno de outro módulo.

```text
modules/<domain>/
├── domain/
│   └── entities/                  # entidades que estendem BaseEntity
├── application/
│   ├── dto/                       # contratos de entrada e saída dos casos de uso
│   ├── repositories/              # portas: interfaces, sem Drizzle
│   └── use-cases/                 # regras de orquestração do domínio
├── infrastructure/
│   └── repositories/              # adaptadores Drizzle e in-memory
├── facade/
│   └── <domain>.facade.ts          # única API pública para outros módulos
└── controllers/
    └── <domain>.trpc.ts           # adaptador tRPC e schemas Zod
```

As dependências seguem o sentido abaixo:

```text
controller -> use case -> repository port <- repository adapter
                    -> domain entity
other module -> facade -> use case
```

O controller somente traduz a requisição tRPC para DTOs e delega ao caso de
uso. Os schemas Zod de `.input()` e `.output()` ficam nele, porque são contrato
de transporte. O caso de uso não deve importar tRPC, Next.js, Drizzle ou Zod.

A facade expõe apenas operações e DTOs necessários a outros módulos. Ela pode
orquestrar casos de uso internos, mas não deve vazar entidades, repositórios ou
detalhes de infraestrutura. O controller tRPC continua sendo uma entrada
externa do módulo e não substitui a facade.

## Exemplo de entidade

```ts
import { BaseEntity } from "@/server/shared/domain/entity"

type CooperativeProps = {
  id: string
  createdAt: Date
  updatedAt: Date
  legalName: string
}

export class Cooperative extends BaseEntity<CooperativeProps> {
  get legalName() {
    return this.props.legalName
  }
}
```

O `createTRPCContext` será o ponto de composição dos adaptadores de
infraestrutura. Quando o primeiro módulo for implementado, `DATA_SOURCE=memory`
selecionará o repositório em memória e `DATA_SOURCE=database`, o adaptador
Drizzle. Controllers e casos de uso não devem mudar entre essas opções.
