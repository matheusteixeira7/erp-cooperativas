# Feedback do cliente (Jailson) — draft de requisitos

Status: **aplicado na spec em 2026-09-14** (versão 0.4.0, decisões DEC-006 a DEC-009 em `spec/spec.json`). Como o cliente estava sem contato, as perguntas abertas foram decididas internamente (Matheus delegou). Tudo entrou com `status: proposto`; o Jailson confirma depois, e o que ele discordar vira ajuste pontual. `python3 spec/validar.py` passa com 8 fixtures.

## Decisões tomadas (resumo)

| Pergunta | Decisão | Por quê |
|---|---|---|
| INSS: 7,5% ou 11%? | Padrão **7,5%** (o que o cliente pediu), configurável 0–20% com histórico. Contador confirma antes da implantação. | O sistema não trava no valor; trocar é um campo. Nota legal (Lei 10.666/03) registrada em `dominio.json` e RN-028. |
| INSS: base é o bruto antes dos vales? | **Sim.** Ordem: fundos → diária → bruto → INSS → vales → líquido. Saldo devedor sobre bruto − INSS. | É o que o cliente descreveu; fixture `FX-out-2026-compras-inss` prova a diferença (92,46 vs 43,20). |
| INSS: tem teto? | **Não na v1.** | Alíquota é fixa, não progressiva; teto seria inconsistente. Se o contador disser que aplica, vira um parâmetro a mais. |
| INSS: parte patronal? | **Não entra no rateio.** Se existir, é despesa operacional na categoria `inss_patronal`. | Custo da cooperativa sai antes da sobra, não do cooperado. |
| Cooperados: quem cadastra? | **Só o gestor.** Operador vê a lista. | Já era PL-003; mantido. |
| Cooperados: importar planilha? | **Não é feature.** Script one-off do time na implantação. | Acontece uma vez; não vale tela. |
| Compras reduzem a sobra? | **Sim**, em linha própria: sobra = vendas − compras − despesas. | Dinheiro que saiu. Separado das despesas para o gestor ver quanto gastou comprando. |
| Cooperado vende para a cooperativa? | **Pode.** Vira fornecedor pessoa física comum, pago na hora, fora do rateio. | Misturar com vale confundiria o demonstrativo. |
| Recibo para o catador? | **Sim**, PDF simples (`purchases.receipt`). | Pagamento em dinheiro sem papel é buraco de auditoria; reusa o gerador de PDF do fechamento. |
| Estoque agora? | **Não.** Só o financeiro. Estoque segue fase 2. | Escopo já definido; compras entram só como custo. |
| Estado: só solto/prensado? | **Sim**, enum `loose`/`baled`. Novo valor = migration de uma linha. | O cliente citou dois. Tabela configurável seria tela a mais sem pedido. |
| Preço: tabela fixa ou negociado? | **Negociado** a cada lançamento, com sugestão do último preço praticado (comprador/fornecedor + material + estado) já na v1. | É como o galpão funciona hoje; a sugestão tira o erro de digitação sem engessar. |

Ordem de implementação fica: TK-023 (estado) → TK-024 (compras) → TK-025 (INSS) → TK-026 (cooperados).

Pedido original, na ordem em que veio:

1. Cálculo do INSS 7,5%
2. Aba para incluir ou excluir cooperados
3. Campo de compras (abaixo de vendas), mesmas categorias
4. Em compras e vendas, escolher se o material é solto ou prensado

---

## REQ-01 · Desconto de INSS na retirada do cooperado

**O que o cliente quer.** Que o sistema calcule e desconte o INSS de cada cooperado no fechamento do mês, à alíquota de 7,5%.

**Requisito reescrito.**
No fechamento do rateio, para cada cooperado, o sistema calcula o INSS sobre o valor bruto da retirada (dias trabalhados × valor da diária) e desconta esse valor antes dos vales. O demonstrativo passa a mostrar: bruto, INSS, vales, líquido. O fechamento guarda o total de INSS retido no mês para a cooperativa recolher.

**Regras.**
- Alíquota configurável na tela de parâmetros de rateio, por cooperativa, com histórico de vigência (igual aos fundos). Valor inicial: 7,5%.
- Base de cálculo: bruto do cooperado no mês, antes de vales e antes de qualquer outro desconto.
- Ordem do cálculo: fundos legais → diária → bruto individual → INSS → vales → líquido. Saldo devedor (vale maior que o bruto) passa a ser calculado sobre bruto − INSS.
- Cada cooperado tem um campo "contribui INSS pelo sistema: sim/não" (padrão sim). Serve para aposentado, MEI ou quem recolhe por fora. Quem estiver "não" aparece no demonstrativo com INSS zero e uma marcação.
- O fechamento grava, por cooperado: base do INSS, alíquota usada e valor retido. E no total: INSS retido no mês.
- Novo relatório/exportação: "INSS do mês" com CPF, base e valor por cooperado, para o contador gerar a guia.
- Arredondamento: half-even em 2 casas, por cooperado.

**Perguntas para o Jailson.**
1. Confirmar a alíquota com o contador. Para cooperado de cooperativa de trabalho a lei costuma falar em 11% (Lei 10.666/03, art. 4º); 7,5% é a faixa mais baixa da tabela de empregado. O sistema aceita qualquer valor, mas o padrão precisa estar certo.
2. A base é o bruto antes dos vales? (Assumimos que sim.)
3. Existe teto? O INSS de empregado tem teto mensal; se aplicar, o sistema precisa do valor do teto como parâmetro.
4. A cooperativa também paga alguma parte patronal sobre a retirada? Se sim, é despesa da cooperativa e entra antes da sobra, não como desconto do cooperado.

**Impacto na spec.** Nova RN-028 (cálculo do INSS), altera RN-002 (fórmula do líquido) e RN-009 (saldo devedor). Novo campo em EN-parametros-rateio (`inss_rate`), EN-cooperado (`inss_withheld`), EN-fechamento-item (`inss_base`, `inss_rate`, `inss_amount`), EN-fechamento (`inss_total`). UI-parametros, UI-fechamento, UI-extrato-cooperado ganham o campo. Nova exportação em API-payouts-export. Fixtures refeitas.

---

## REQ-02 · Tela de cooperados: incluir, editar e desligar

**O que o cliente quer.** Uma aba onde se cadastra e se "exclui" cooperado.

**Requisito reescrito.**
Tela "Cooperados" no menu do gestor, com lista de todos os cooperados, busca por nome ou CPF e filtro ativos/desligados. Ações: incluir novo, editar dados, desligar (informando a data), reativar. Cooperado desligado sai da chamada a partir da data de desligamento, mas o histórico dele (presenças, vales, extratos) continua existindo.

**Regras.**
- "Excluir" não apaga. Cooperado com qualquer presença, vale ou fechamento não pode ser removido do banco, só desligado. Motivo: o rateio de meses passados depende dele.
- Cooperado cadastrado por engano, sem nenhum lançamento, pode ser removido de verdade.
- Campos: nome, CPF (único por cooperativa), chave PIX, telefone, data de admissão, contribui INSS (REQ-01), observações.
- Só o perfil gestor acessa essa tela. Operador vê a lista mas não altera.

**Perguntas para o Jailson.**
1. Quem faz o cadastro no dia a dia: só a administração, ou o encarregado do galpão também?
2. Precisa importar a lista atual de cooperados de uma planilha na implantação?

**Impacto na spec.** Já coberto por UI-cooperados, FL-006, EN-cooperado e TK-018. Ajustes: adicionar "reativar" e "remoção real quando sem lançamentos" (RN nova), e o campo de INSS.

---

## REQ-03 · Compras de material

**O que o cliente quer.** Além de vender, a cooperativa compra material (de catadores avulsos, outras cooperativas, geradores). Quer um campo de compras abaixo do de vendas, com as mesmas categorias de material.

**Requisito reescrito.**
Nova seção "Compras" na mesma tela de vendas, logo abaixo. Registra de quem foi comprado, a data, e os itens: material (mesmo catálogo das vendas), estado (REQ-04), peso em kg e preço por kg. O sistema calcula o total. As compras do mês entram como custo no fechamento: sobra = vendas − compras − despesas.

**Regras.**
- Cadastro de fornecedor separado do de comprador. Fornecedor pode ser pessoa física (catador avulso: nome, CPF opcional, PIX) ou empresa (nome, CNPJ). Pode ser criado na hora, dentro da tela de compra.
- Itens de compra usam o mesmo catálogo de tipos de material das vendas. Nenhuma lista duplicada.
- Total da compra calculado no servidor, como nas vendas.
- Compra respeita mês fechado: não se lança compra em mês já fechado.
- Forma de pagamento: dinheiro ou PIX, com campo "pago em". Compra de catador normalmente é paga na hora.
- No fechamento, "Compras de material" aparece como linha própria, separada de "Despesas operacionais", para o gestor ver quanto foi gasto comprando material.
- Relatório simples: compras por fornecedor e por material no mês.

**Perguntas para o Jailson.**
1. Compra entra na conta da sobra do mês, reduzindo o rateio? (Assumimos que sim; é dinheiro que saiu.)
2. Acontece de um cooperado vender material próprio para a cooperativa? Se sim, ele vira fornecedor também, ou isso vira um vale ao contrário?
3. Precisa emitir recibo de compra para o catador (papel ou PDF)?
4. Compra de material solto que depois é prensado e vendido: hoje o cliente quer só o registro financeiro, ou já quer controle de estoque (o que entrou, o que saiu)? Estoque estava previsto para a fase 2.

**Impacto na spec.** Novas entidades EN-fornecedor, EN-compra, EN-item-compra. Novo router `purchases` e `suppliers` (API-purchases-create/list/delete, API-suppliers-list/create). Altera RN-003 (sobra) e EN-fechamento (`total_purchases`). UI-vendas ganha a seção. FL-003 ganha irmão FL-008 (registro de compra). Glossário: fornecedor, compra. Fixtures ganham compras.

---

## REQ-04 · Estado do material: solto ou prensado

**O que o cliente quer.** Em compras e vendas, escolher se o material é solto ou prensado.

**Requisito reescrito.**
Cada item de compra ou venda tem, além do tipo de material, o estado: **solto** ou **prensado** (fardo). O preço por kg é informado para aquela combinação. Relatórios e totais podem ser abertos por material e estado.

**Regras.**
- Campo obrigatório no item. Valor padrão configurável por tipo de material (ex.: papelão costuma sair prensado, vidro sempre solto).
- Lista de estados começa com solto e prensado, mas fica preparada para crescer (moído, enfardado em bag, etc.) sem mexer em código.
- O estado fica gravado no item. Mudar a lista depois não altera vendas antigas.
- Sugestão de preço: ao escolher material + estado, o sistema mostra o último preço praticado com aquele comprador ou fornecedor para a mesma combinação. Só sugestão; o operador confirma.

**Perguntas para o Jailson.**
1. Só solto e prensado bastam agora, ou já existe um terceiro caso no dia a dia (moído, bag, limpo/sujo)?
2. Existe uma tabela de preços fixa por material e estado, ou o preço é negociado a cada venda?

**Impacto na spec.** Novo enum TP-EstadoMaterial. Novo campo `condition` em EN-item-venda e EN-item-compra. Campo `default_condition` em EN-tipo-material. UI-vendas (e a seção de compras) ganha o seletor. Glossário: solto, prensado.

---

## Ordem sugerida de implementação (quando sair do estudo)

1. REQ-04 (estado do material): pequeno, e REQ-03 depende dele.
2. REQ-03 (compras): muda a fórmula da sobra, então antes do INSS para as fixtures fecharem uma vez só.
3. REQ-01 (INSS): depende das respostas do contador.
4. REQ-02 (cooperados): quase tudo já existe; só ajustes.

## Confirmações para o Jailson (não bloqueiam; já decidimos e seguimos)

Mandar de uma vez, em linguagem de galpão:

1. **INSS**: "Deixamos 7,5% como você pediu, mas pede pro contador confirmar se é 7,5% ou 11% pra cooperativa de vocês. Dá pra trocar na tela de configurações." E: "Tem algum cooperado que não deve ter desconto (aposentado, MEI)? Marcamos ele no cadastro."
2. **Compras**: "Compra de material entra como gasto do mês e diminui a sobra, certo? Fica numa linha separada das despesas." E: "Vai sair um recibo em PDF pro catador assinar. Serve?"
3. **Estado do material**: "Só solto e prensado bastam? Se aparecer um terceiro (moído, bag), avisa que a gente inclui."
4. **Cooperados**: "Excluir cooperado que já trabalhou vira 'desligar' com data, pra não estragar os meses passados. Só apaga de verdade quem foi cadastrado errado e nunca teve nada. Ok?"
