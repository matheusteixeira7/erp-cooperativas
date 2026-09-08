#!/usr/bin/env python3
"""Valida a spec: JSON, campos obrigatórios, IDs únicos, refs resolvidas, números das fixtures.
Uso: python3 validar.py  (na pasta spec/)"""
import glob, json, re, sys
from decimal import Decimal, ROUND_HALF_EVEN, ROUND_FLOOR

PREFIXOS_REGISTRO = ("TP", "EN", "RN", "VL", "PL", "FL", "API", "ERR", "UI", "NF", "TS", "TK")
PREFIXOS_TODOS = PREFIXOS_REGISTRO + ("FX", "DEC", "DOM", "ARQ")
ID_RE = re.compile(r"^(%s)-[A-Za-z0-9][A-Za-z0-9_.\-]*$" % "|".join(PREFIXOS_TODOS))
OBRIGATORIOS = ["id", "nome", "descricao", "status", "origem", "refs"]
STATUS = {"confirmado", "proposto", "pergunta-aberta", "fase-2"}
CHAVES_REF_STR = {"regra", "erro", "fixture", "api", "tela", "vem_de", "herda_de"}
CHAVES_REF_LIST = {"precondicoes", "erros", "telas", "depende_de", "afeta", "impacto", "fixtures"}

erros, avisos = [], []
ids = {}
registros = []

def walk(node, arquivo, caminho=""):
    if isinstance(node, dict):
        i = node.get("id")
        if isinstance(i, str) and ID_RE.match(i):
            if i in ids:
                erros.append(f"ID duplicado {i} em {arquivo} e {ids[i]}")
            ids[i] = arquivo
            registros.append((i, node, arquivo))
        for k, v in node.items():
            walk(v, arquivo, f"{caminho}/{k}")
    elif isinstance(node, list):
        for n, v in enumerate(node):
            walk(v, arquivo, f"{caminho}[{n}]")

docs = {}
for f in sorted(glob.glob("**/*.json", recursive=True)):
    try:
        docs[f] = json.load(open(f, encoding="utf-8"))
    except json.JSONDecodeError as e:
        erros.append(f"JSON inválido {f}: {e}"); continue
    walk(docs[f], f)

def checar_refs(node, arquivo, dono):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "refs" and isinstance(v, dict):
                for cat, lista in v.items():
                    if not isinstance(lista, list):
                        erros.append(f"{dono} refs.{cat} deveria ser lista ({arquivo})"); continue
                    for r in lista:
                        if r not in ids:
                            erros.append(f"{dono} refs.{cat} -> {r} não existe ({arquivo})")
            elif k in CHAVES_REF_STR and isinstance(v, str) and ID_RE.match(v) and v not in ids:
                erros.append(f"{dono} {k} -> {v} não existe ({arquivo})")
            elif k in CHAVES_REF_LIST and isinstance(v, list):
                for r in v:
                    if isinstance(r, str) and ID_RE.match(r) and r not in ids:
                        erros.append(f"{dono} {k} -> {r} não existe ({arquivo})")
            else:
                checar_refs(v, arquivo, dono)
    elif isinstance(node, list):
        for v in node:
            checar_refs(v, arquivo, dono)

for i, node, arquivo in registros:
    if i.split("-")[0] in PREFIXOS_REGISTRO:
        for campo in OBRIGATORIOS:
            if campo not in node:
                erros.append(f"{i} sem campo '{campo}' ({arquivo})")
        if node.get("status") not in STATUS:
            erros.append(f"{i} status inválido: {node.get('status')} ({arquivo})")
    checar_refs(node, arquivo, i)

# ---- fixtures: recalcular pelas regras RN-001..RN-012 ----
D = lambda x: Decimal(str(x))
def round2(x): return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
def floor2(x): return x.quantize(Decimal("0.01"), rounding=ROUND_FLOOR)

def calcular(fx):
    s = fx["settings"]
    receita = sum((round2(D(i["weightKg"]) * D(i["pricePerKg"])) for v in fx["sales"] for i in v["items"]), Decimal(0))
    despesas = sum((D(e["amount"]) for e in fx["expenses"]), Decimal(0))
    sobra = receita - despesas
    out = {"grossRevenue": receita, "totalExpenses": despesas, "surplus": sobra}
    if sobra <= 0:
        out["erro"] = "ERR-PAYOUT-001"; return out
    reserva = round2(sobra * D(s["legalReserveRate"])); fates = round2(sobra * D(s["fatesRate"])); outros = round2(sobra * D(s["otherFundsRate"]))
    dist = sobra - reserva - fates - outros
    dias = sum(m["workedDays"] for m in fx["members"])
    out.update(legalReserveAmount=reserva, fatesAmount=fates, otherFundsAmount=outros, distributableSurplus=dist, totalWorkedDays=dias)
    if dias == 0:
        out["erro"] = "ERR-PAYOUT-002"; return out
    diaria = floor2(dist / dias)
    items, novos, tot_net, tot_ded, tot_gross = [], [], Decimal(0), Decimal(0), Decimal(0)
    for m in fx["members"]:
        gross = round2(D(m["workedDays"]) * diaria)
        ded = sum((D(a["amount"]) for a in m["advances"]), Decimal(0))
        net = max(Decimal(0), gross - ded)
        carry = max(Decimal(0), ded - gross) if s["negativeBalancePolicy"] == "carry_over" else Decimal(0)
        if carry > 0:
            y, mo = map(int, fx["period"].split("-")); mo += 1
            if mo == 13: mo, y = 1, y + 1
            novos.append({"member": m["id"], "kind": "carry_over", "amount": carry, "grantedOn": f"{y:04d}-{mo:02d}-01", "status": "pending"})
        items.append({"member": m["id"], "workedDays": m["workedDays"], "grossAmount": gross, "deductionsAmount": ded, "netAmount": net, "carryOverDebt": carry})
        tot_net += net; tot_ded += ded; tot_gross += gross
    out.update(dayValue=diaria, distributedTotal=tot_gross, roundingResidual=dist - tot_gross, items=items, totalNet=tot_net, totalDeductions=tot_ded, newCarryOverAdvances=novos)
    assert Decimal(0) <= out["roundingResidual"] < D(dias) * D("0.01"), "invariante RN-012 violada"
    return out

def comparar(esp, calc, ctx, fxid):
    for k, v in esp.items():
        if k not in calc:
            erros.append(f"{fxid}: espera.{ctx}{k} não é calculado pelo validador"); continue
        c = calc[k]
        if isinstance(v, list):
            if len(v) != len(c):
                erros.append(f"{fxid}: {ctx}{k} tamanho {len(v)} ≠ {len(c)}"); continue
            for n, (ve, ce) in enumerate(zip(v, c)):
                comparar(ve, ce, f"{ctx}{k}[{n}].", fxid)
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            if D(v) != D(c):
                erros.append(f"{fxid}: {ctx}{k} esperado {v}, calculado {c}")
        elif v != c:
            erros.append(f"{fxid}: {ctx}{k} esperado {v!r}, calculado {c!r}")

fxdoc = docs.get("80-testes/fixtures.json", {})
fxs = {f["id"]: f for f in fxdoc.get("fixtures", [])}
for fid, fx in fxs.items():
    base = dict(fxs[fx["herda_de"]]) if "herda_de" in fx else {}
    merged = {**base, **{k: v for k, v in fx.items() if k != "espera"}}
    try:
        comparar(fx["espera"], calcular(merged), "", fid)
    except Exception as e:
        erros.append(f"{fid}: exceção ao calcular: {e}")

# ---- índice: arquivos listados existem ----
for a in docs.get("spec.json", {}).get("arquivos", []):
    if not glob.glob(a):
        erros.append(f"spec.json lista arquivo inexistente: {a}")

# ---- pendências (informativo) ----
abertas = [i for i, n, _ in registros if n.get("status") == "pergunta-aberta"]
contagem = {}
for i in ids: contagem[i.split("-")[0]] = contagem.get(i.split("-")[0], 0) + 1

print("Registros por prefixo:", dict(sorted(contagem.items())))
print(f"Fixtures verificadas: {len(fxs)}")
print(f"Perguntas abertas ({len(abertas)}): {', '.join(abertas)}")
for a in avisos: print("AVISO:", a)
if erros:
    print(f"\n{len(erros)} ERRO(S):"); [print(" -", e) for e in erros]; sys.exit(1)
print("\nOK: spec válida.")
