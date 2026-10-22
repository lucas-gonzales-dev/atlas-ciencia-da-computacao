#!/usr/bin/env python3
"""Imprime SOMENTE as evidencias de P-1 (eletivas comentadas) e P-2 (extraBooks).

Leitura pura: nao escreve no kit nem no clone.
"""
import json
import re
import sys
from pathlib import Path

KIT = Path(r"C:/Users/Pichau/Desktop/atlas-planning-kit")
CLONE = Path(r"C:/Users/Pichau/Documents/Aurora/atlas-kit/source/ciencia-da-computacao")
RECON = KIT / "audit-output/ubl-b995c11/reconciliation.json"

ROW_LINK_RE = re.compile(r'^\s*\[([^\]]+)\]\(([^)]+)\)')


def head(t):
    print("\n" + "=" * 78)
    print(t)
    print("=" * 78)


def main():
    r = json.loads(RECON.read_text(encoding="utf-8"))

    head("P-1 / reconciliation.json :: commentedContent")
    print(json.dumps(r.get("commentedContent"), ensure_ascii=False, indent=2))

    head("P-2 / reconciliation.json :: extras")
    e = r.get("extras", {})
    print(json.dumps({k: e.get(k) for k in ("sourceCounts", "seedCounts", "countMismatches")},
                     ensure_ascii=False, indent=2))
    print("extraBookRows:", json.dumps(e.get("extraBookRows"), ensure_ascii=False, indent=2))

    head("SEED / commented-electives-seed.json")
    s = json.loads((KIT / "content/commented-electives-seed.json").read_text(encoding="utf-8"))
    print(json.dumps(s, ensure_ascii=False, indent=2)[:3000])

    head("SEED / auxiliary-seed.json -> extraBooks + chaves")
    a = json.loads((KIT / "content/auxiliary-seed.json").read_text(encoding="utf-8"))
    print("chaves:", list(a.keys()))
    for k in a:
        if isinstance(a[k], list):
            print(f"  {k}: {len(a[k])} itens")
    print("extraBooks:", json.dumps(a.get("extraBooks"), ensure_ascii=False, indent=2))

    head("FONTE / README.md linhas dentro de comentarios HTML")
    text = (CLONE / "README.md").read_text(encoding="utf-8")
    inside = False
    for n, line in enumerate(text.splitlines(), 1):
        was = inside
        if "<!--" in line:
            inside = True
        if inside or was or "-->" in line:
            print(f"{n:4d}| {line}")
        if "-->" in line:
            inside = False

    head("FONTE / extras/books.md (inteiro)")
    b = (CLONE / "extras/books.md").read_text(encoding="utf-8")
    print(f"--- {len(b)} bytes, {len(b.splitlines())} linhas ---")
    for n, line in enumerate(b.splitlines(), 1):
        print(f"{n:4d}| {line}")
        if n > 90:
            print("... (cortado)")
            break

    head("FONTE / extras/courses.md contagem de linhas com ROW_LINK_RE")
    c = (CLONE / "extras/courses.md").read_text(encoding="utf-8")
    rows = [(n, l) for n, l in enumerate(c.splitlines(), 1) if ROW_LINK_RE.match(l)]
    print("linhas:", len(rows))
    for n, l in rows[:40]:
        print(f"{n:4d}| {l[:150]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
