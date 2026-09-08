# Spec do ERP Cooperativas

Fonte da verdade do que será construído, em JSON, para agentes de IA e humanos.

- Comece por `spec.json` (índice, convenções, decisões).
- Cada registro tem `id`, `status` (confirmado / proposto / pergunta-aberta / fase-2) e `origem` (pdf / complemento / decisao / repo).
- `refs` liga tudo: regra → entidade → procedure → tela → teste → tarefa.
- Agentes trabalham a partir de `90-entrega/tarefas.json`, carregando só os arquivos listados em `contexto`.

Validar:

```bash
python3 validar.py
```

O validador recalcula as fixtures de `80-testes/fixtures.json` com as regras RN-001..RN-012. Se alguém mudar uma regra e esquecer os números, ele falha.

Ordem de leitura sugerida: `00-contexto` → `30-regras/regras-negocio.json` → `20-entidades` → `50-api/trpc.json` → `60-telas` → `90-entrega`.
