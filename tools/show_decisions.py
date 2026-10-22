#!/usr/bin/env python3
"""Mede as tres coisas que as decisoes 2 e 3 precisam, sem chute (leitura pura)."""
import json
import re
import sys
from pathlib import Path

KIT = Path(r"C:/Users/Pichau/Desktop/atlas-planning-kit")
CLONE = Path(r"C:/Users/Pichau/Documents/Aurora/atlas-kit/source/ciencia-da-computacao")
R = KIT / "audit-output/ubl-b995c11/reconciliation.json"


def main():
    r = json.loads(R.read_text(encoding="utf-8"))

    print("== DECISAO 2: problemas do grafo de pre-requisitos ==")
    for i in r["prerequisiteGraph"]["issues"]:
        print(f"  disciplina: {i['subject']}")
        print(f"  kind      : {i['kind']}")
        print(f"  prereq    : {i.get('prerequisite')}")
        print(f"  urlPrereq : {str(i.get('prerequisiteUrl') or i.get('url'))[:95]}")
        if "subjectRowUrl" in i:
            print(f"  urlLinha  : {str(i['subjectRowUrl'])[:95]}")
        print(f"  linha     : {i['line']}")
    print("  disciplinas sem pre-requisito:",
          len(r["prerequisiteGraph"]["subjectsWithoutPrerequisites"]))
    print("  URLs compartilhadas:",
          [(g["count"], g["titles"]) for g in r["prerequisiteGraph"]["subjectsSharingResourceUrl"]])

    print("\n== DECISAO 3: indice vs arquivos de especializacao ==")
    s = r["specializations"]
    print("linhas no indice:", s["indexRows"], "| arquivos na arvore:", s["filesInTree"])
    print("arquivos NAO referenciados pelo indice:", s["filesNotReferencedByIndex"])
    print("alvos do indice sem arquivo:",
          [(t["title"], t["url"], t["resolvedPath"]) for t in s["indexTargetsMissingFile"]])
    print("detector bruto 'em constru':", s["underConstructionFiles"])

    print("\n== contexto real de cada 'em constru' (para separar trilha toda de parte) ==")
    for p in s["underConstructionFiles"]:
        text = (CLONE / p).read_text(encoding="utf-8", errors="replace")
        hits = [(n, ln.strip()) for n, ln in enumerate(text.splitlines(), start=1)
                if "em constru" in ln.lower()]
        lines = text.splitlines()
        print(f"  --- {p}  ({len(hits)} ocorrencia(s), {len(lines)} linhas)")
        for n, ln in hits[:4]:
            head = next((h for h in reversed(lines[:n]) if h.startswith("#")), "")
            print(f"      linha {n} sob '{head.strip()[:52]}': {ln[:110]}")

    print("\n== contagem de linhas de recurso por arquivo ==")
    print(" ", {k: v for k, v in sorted(s["resourceRowsPerFile"].items())})
    print("\n== seed de especializacoes (estado declarado no kit) ==")
    seed = json.loads((KIT / "content/specializations-seed.json").read_text(encoding="utf-8"))
    items = seed.get("specializations") or seed.get("items") or []
    for it in items:
        print("  ", {k: v for k, v in it.items()
                     if k in ("id", "slug", "title", "state", "sourcePath", "status")})
    return 0


if __name__ == "__main__":
    sys.exit(main())
