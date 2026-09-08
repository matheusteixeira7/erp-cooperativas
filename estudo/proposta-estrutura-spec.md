# Proposta: estrutura da spec do ERP da cooperativa (para agentes de IA)

## 1. O que tem no PDF (e em qual categoria cai)

O PDF é uma conversa com o Gemini. Ele mistura tudo: tabela SQL, regra de cálculo, tela, código.
Separando, o conteúdo cai em 10 categorias:

| # | Categoria | O que apareceu no PDF |
|---|-----------|-----------------------|
| 0 | **Contexto e domínio** | Cooperativa de trabalho de recicláveis. Rateio por dias trabalhados. Menção à Lei 5.764/71. Pipeline: Entrada → Triagem → Estoque → Financeiro. |
| 1 | **Tipos primitivos** | Implícitos no SQL: `NUMERIC(10,2)` para dinheiro e peso, `VARCHAR(14)` para CPF, `DATE`, mês/ano como dois `INT`. Nunca foram nomeados. |
| 2 | **Entidades (dados)** | `cooperados`, `presencas`, `tipos_material`, `vendas`, `itens_venda`, `despesas`, `adiantamentos_descontos`, `fechamento_rateio`. Duas tabelas apareceram e sumiram: `entradas_material`, `producao_cooperado`. |
| 3 | **Regras de negócio** | Fórmula da diária, fórmula do rateio individual, sobra ≤ 0 bloqueia, zero presenças bloqueia, líquido nunca negativo, vales quitados no fechamento, só cooperado ativo entra, 1 presença por cooperado por dia. |
| 4 | **Processos / fluxos** | Fechamento mensal (simular → conferir → fechar). Chamada diária em lote com upsert. Venda com itens em transação. |
| 5 | **Contratos de API** | 7 endpoints REST (`/api/cooperados`, `/api/presencas/chamada-diaria`, `/api/vendas`, `/api/despesas`, `/api/adiantamentos`, `/api/rateio/simulacao`, `/api/rateio/fechar`) + `/health`. |
| 6 | **Telas (UI/UX)** | 4 telas + shell com menu. Requisitos: toque ≥ 48px, "marcar todos", data retroativa, confirmar antes de fechar mês, abas despesas/vales. |
| 7 | **Arquitetura e stack** | Node + Express, React + Vite + Tailwind + lucide, PostgreSQL. Estrutura de pastas backend/frontend. |
| 8 | **Infra / deploy** | Render (DB + API), Vercel (front), variáveis `DATABASE_URL`, `VITE_API_URL`. |
| 9 | **Escopo / backlog** | Módulos 1–3 (entrada, triagem, estoque) foram descritos mas **não** implementados. Nota fiscal, auth e relatórios só citados. |

## 2. O que o PDF deixou de fora (e a spec precisa cobrir)

Isso é o que eu complemento. Cada item vira um registro na spec marcado como `"origem": "complemento"` ou `"status": "pergunta-aberta"` para você decidir.

**Regras que faltam**
- Fundos legais antes do rateio. A Lei 5.764/71 exige Reserva Legal (mín. 10% das sobras) e FATES (mín. 5%). Hoje a fórmula distribui 100% da sobra. **Precisa confirmar com o contador.**
- Lei 12.690/2012 (cooperativas de trabalho) fala em retirada mínima e limites de jornada. Verificar se se aplica.
- Encargos sobre a retirada (INSS do cooperado). Hoje não existe.
- Vale maior que o bruto: o PDF zera o líquido e o resto do vale **se perde**. Precisa decidir: perdoa ou vira saldo devedor para o mês seguinte?
- Arredondamento: diária com centavos gera diferença de alguns centavos na soma. Quem fica com a sobra do arredondamento?
- Mês fechado é imutável? Pode lançar presença/venda retroativa depois de fechar? Pode reabrir?
- Cooperado desligado no meio do mês: entra no rateio ou não?
- Vendas por data de venda ou por data de recebimento (caixa)? Hoje é data da venda, mesmo sem receber.

**Segurança e pessoas**
- Autenticação e perfis (gestor, operador de balança, cooperado). Não existe nada.
- LGPD: CPF e chave PIX são dados pessoais. Precisa de política de acesso e log.
- Auditoria: quem lançou, quem alterou, quando.

**Estados (máquinas de estado)**
- Fechamento: `aberto → simulado → fechado` (→ `reaberto`?).
- Vale: `pendente → descontado`.
- Venda: `registrada → recebida` (se controlar caixa).

**Qualidade**
- Validações de campo: CPF válido, peso > 0, preço > 0, data não futura.
- Catálogo de erros com código, mensagem e HTTP status.
- Cenários de teste com **números**: "dado X vendas, Y despesas, Z presenças → diária = R$ N". Sem isso o agente não consegue provar que acertou.
- Dados semente: lista inicial de `tipos_material`.
- Não funcionais: locale pt-BR, funciona com internet fraca no galpão, backup.

**Para os agentes**
- IDs estáveis em tudo, e cada regra aponta para qual entidade, qual endpoint, qual tela e qual teste ela toca (rastreabilidade).
- Backlog de tarefas com dependências e "pronto quando" (definition of done) apontando para os IDs.

## 3. Estrutura de arquivos proposta

Recomendo **JSON, em vários arquivos, com um índice na raiz**. Motivos:
- Agentes lêem JSON nativamente e JSON Schema valida o arquivo (você pega erro antes de gastar token).
- Vários arquivos = cada agente carrega só a parte dele no contexto.
- Contratos de API em **OpenAPI** e tipos em **JSON Schema** porque são padrões que ferramentas já entendem (gerar cliente, validar request, mockar servidor).

XML não recomendo: mais verboso, ferramentas de IA lidam pior, e não há ganho aqui.

```
spec/
├── spec.json                     # índice: versão, glossário-resumo, lista de arquivos, convenções de ID
├── 00-contexto/
│   ├── dominio.json              # quem é a cooperativa, atores, escopo in/out, leis
│   └── glossario.json            # cooperado, sobra, diária, vale, fardo, rateio...
├── 10-tipos/
│   ├── primitivos.json           # CPF, DinheiroBRL, PesoKg, Percentual, MesAno, ChavePix, DataLocal
│   └── enums.json                # CategoriaMaterial, StatusFechamento, StatusVale, Perfil
├── 20-entidades/
│   └── *.json                    # 1 arquivo por entidade: campos (usando os tipos), chaves, invariantes, ciclo de vida
├── 30-regras/
│   ├── regras-negocio.json       # RN-xxx: fórmulas, precondições, erros, exemplos numéricos
│   ├── validacoes.json           # VL-xxx: regras de campo
│   └── politicas.json            # PL-xxx: quem pode fazer o quê (autorização)
├── 40-processos/
│   └── fluxos.json               # FL-xxx: passos, máquinas de estado, transações
├── 50-api/
│   ├── openapi.json              # contratos REST (padrão OpenAPI 3.1)
│   └── erros.json                # ERR-xxx: código, HTTP status, mensagem pt-BR, regra que dispara
├── 60-telas/
│   └── telas.json                # UI-xxx: campos, ações → endpoint, estados (vazio/carregando/erro), requisitos de UX
├── 70-arquitetura/
│   ├── stack.json                # linguagens, libs com versão, banco
│   ├── estrutura-pastas.json     # árvore do repositório
│   ├── infra.json                # Render, Vercel, variáveis de ambiente
│   └── nao-funcionais.json       # NF-xxx: performance, offline, LGPD, backup, locale
├── 80-testes/
│   └── aceitacao.json            # TS-xxx: dado/quando/então com fixtures e números esperados
└── 90-entrega/
    └── tarefas.json              # TK-xxx: backlog para agentes, dependências, definition of done
```

## 4. Convenções que valem para todos os arquivos

**Prefixos de ID**: `TP-` tipo, `EN-` entidade, `RN-` regra de negócio, `VL-` validação, `PL-` política,
`FL-` fluxo, `API-` endpoint, `ERR-` erro, `UI-` tela, `NF-` não funcional, `TS-` teste, `TK-` tarefa.

**Campos obrigatórios em todo registro**:
```json
{
  "id": "RN-001",
  "nome": "curto",
  "descricao": "frase em português que um gestor da cooperativa entende",
  "status": "confirmado | proposto | pergunta-aberta",
  "origem": { "tipo": "pdf | complemento | decisao", "ref": "pdf p.3" },
  "refs": { "entidades": [], "regras": [], "api": [], "telas": [], "testes": [] }
}
```

**Regra de ouro para agentes**: toda regra de negócio tem pelo menos 1 `exemplo` com números de entrada e saída.
Todo endpoint tem pelo menos 1 teste `TS-`. Toda tela aponta para os endpoints que usa.

## 5. Como usar com agentes

1. Você preenche `spec/` (posso gerar tudo a partir do PDF, marcando o que é complemento).
2. Um script valida contra os JSON Schemas (arquivo `spec/schemas/`).
3. `90-entrega/tarefas.json` vira a fila. Cada agente recebe 1 tarefa + só os arquivos que ela referencia.
4. O agente termina quando os testes `TS-` da tarefa passam.

## 6. Decisões que preciso de você

1. **Formato**: JSON multi-arquivo (recomendo) ou JSON único gigante?
2. **Fundos legais** (Reserva Legal 10% + FATES 5%): entram na fórmula do rateio ou a cooperativa trata fora do sistema?
