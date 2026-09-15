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

O validador recalcula as fixtures de `80-testes/fixtures.json` com as regras RN-001..RN-012 e RN-028 (INSS), incluindo compras na sobra (RN-003) e exigindo `condition` em todo item (RN-030). Se alguém mudar uma regra e esquecer os números, ele falha.

Decisões DEC-006..DEC-009 (2026-09-14) vieram do feedback do cliente em `../feedback-cliente-2026-09-14.md`: INSS, compras, estado do material e tela de cooperados.

Ordem de leitura sugerida: `00-contexto` → `30-regras/regras-negocio.json` → `20-entidades` → `50-api/trpc.json` → `60-telas` → `90-entrega`.
