#!/usr/bin/env python3
"""Imprime o resultado de P-1/P-2 da reconciliacao REGERADA (leitura pura)."""
import json
import sys
from pathlib import Path

R = Path(r"C:/Users/Pichau/Desktop/atlas-planning-kit/audit-output/ubl-b995c11/reconciliation.json")


def main():
    r = json.loads(R.read_text(encoding="utf-8"))
    c = r["commentedContent"]
    print("== P-1 comentado ==")
    print("linhas de tabela em comentario:", c["sourceCommentedTableRows"])
    print("itens no seed:", c["seedCommentedItems"])
    print("matched:", c["matched"])
    print("onlyInSource:", c["onlyInSource"], "| onlyInSeed:", c["onlyInSeed"])
    for row in c["rows"]:
        print(f"  linha {row['line']} | sem {row['semesterRaw']} | {row['title']}")
        print(f"    url: {row['url']}")
        print(f"    pre: {[p['text'] for p in row['prerequisites']]}")
    for fc in c["fieldChanges"]:
        print(f"  FIELDCHANGE {fc['title']} (linha {fc['sourceLine']}):")
        for ch in fc["changes"]:
            print(f"    - {ch['field']} [{ch['kind']}]")
            print(f"        seed  : {str(ch.get('seed'))[:110]}")
            print(f"        source: {str(ch.get('source'))[:110]}")

    e = r["extras"]
    print("\n== P-2 extras ==")
    print("sourceCounts:", e["sourceCounts"])
    print("seedCounts  :", e["seedCounts"])
    print("countMismatches:", e["countMismatches"])
    print("livros achados:", len(e["extraBookRows"]))
    for b in e["extraBookRows"]:
        print(f"  - {b['title'][:78]}")

    print("\n== grafos/duplicados (contexto) ==")
    print("prerequisiteIssues:", r["prerequisiteGraph"]["issueCount"])
    print("duplicateUrlGroups:", r["duplicateUrls"]["groups"],
          "| crossFile:", len(r["duplicateUrls"]["crossFileGroups"]))
    print("underConstruction:", r["specializations"]["underConstructionFiles"])
    print("semArquivoNoIndice:",
          [t["title"] for t in r["specializations"]["indexTargetsMissingFile"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
