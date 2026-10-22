"""Introspect the Atlas planning kit seeds/schemas WITHOUT modifying anything.

Purpose: find out the exact shape of the structured data before deciding how to
express (a) the resource-alias layer and (b) the two orphan specializations.

Read-only. Stdlib only. Deterministic output order.
"""

import json
import pathlib

KIT = pathlib.Path("C:/Users/Pichau/Desktop/atlas-planning-kit")
SKIP_PARTS = ("audit-output", "__pycache__", ".git")


def interesting(path):
    parts = path.relative_to(KIT).parts
    return not any(part in SKIP_PARTS for part in parts)


def brief(obj, depth=0):
    """One-line structural summary, no full dumps."""
    if isinstance(obj, dict):
        keys = list(obj.keys())
        return "dict keys=%s" % keys[:14]
    if isinstance(obj, list):
        head = obj[0] if obj else None
        if isinstance(head, dict):
            return "list[%d] item keys=%s" % (len(obj), list(head.keys())[:14])
        return "list[%d] of %s" % (len(obj), type(head).__name__)
    return type(obj).__name__


def main():
    print("== files (json/md under content, schemas, seeds) ==")
    targets = []
    for pattern in ("*.json", "content/*.json", "content/**/*.json",
                    "schemas/**/*", "data/**/*", "*.schema.json"):
        for path in sorted(KIT.glob(pattern)):
            if path.is_file() and interesting(path):
                targets.append(path)
    seen = set()
    for path in targets:
        rel = str(path.relative_to(KIT)).replace("\\", "/")
        if rel in seen:
            continue
        seen.add(rel)
        print("%-64s %7d" % (rel, path.stat().st_size))

    print()
    print("== structure of each json ==")
    for rel in sorted(seen):
        path = KIT / rel
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # report, never guess
            print("%s -> UNREADABLE: %s" % (rel, exc))
            continue
        print("%s -> %s" % (rel, brief(data)))
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, (list, dict)):
                    print("    .%s: %s" % (key, brief(value)))

    print()
    print("== specialization-shaped records: field vocabulary ==")
    for rel in sorted(seen):
        path = KIT / rel
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        blocks = []
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, list) and value and isinstance(value[0], dict):
                    blocks.append((key, value))
        elif isinstance(data, list) and data and isinstance(data[0], dict):
            blocks.append(("<root>", data))
        for name, rows in blocks:
            keys = set()
            for row in rows:
                keys.update(row.keys())
            lowered = " ".join(sorted(keys)).lower()
            if "special" in rel.lower() or "special" in name.lower() or "track" in lowered:
                print("%s .%s rows=%d" % (rel, name, len(rows)))
                print("    fields=%s" % sorted(keys))
                print("    sample=%s" % json.dumps(rows[0], ensure_ascii=False)[:420])


if __name__ == "__main__":
    main()
