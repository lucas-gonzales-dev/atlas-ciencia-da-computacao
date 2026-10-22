"""Recompute KIT_MANIFEST.json sha256 against the real payload. Read-only.

Answers three things before I add any file to content/:
  1. is the manifest already stale because of an earlier edit?
  2. are there payload files present but not listed (untracked)?
  3. what do .notes / .verification say the manifest is FOR?
"""

import hashlib
import json
import pathlib

KIT = pathlib.Path("C:/Users/Pichau/Desktop/atlas-planning-kit")
SKIP_DIRS = {".git", "__pycache__", "audit-output"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest_path = KIT / "KIT_MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    print("== identity ==")
    for key in ("kit", "version", "generatedAt", "status", "payloadFileCount"):
        print("%-18s %s" % (key, manifest.get(key)))
    print("listed files: %d" % len(manifest.get("files", [])))

    print()
    print("== notes ==")
    for note in manifest.get("notes", []):
        print("- %s" % note)

    print()
    print("== verification ==")
    print(json.dumps(manifest.get("verification", {}), ensure_ascii=False, indent=2))

    listed = {row["path"].replace("\\", "/"): row for row in manifest.get("files", [])}

    mismatch, missing, size_off = [], [], []
    for rel, row in sorted(listed.items()):
        path = KIT / rel
        if not path.exists():
            missing.append(rel)
            continue
        actual = sha256(path)
        if actual != row.get("sha256"):
            mismatch.append((rel, row.get("bytes"), path.stat().st_size))
        elif row.get("bytes") != path.stat().st_size:
            size_off.append(rel)

    present = set()
    for path in KIT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(KIT).parts):
            continue
        rel = str(path.relative_to(KIT)).replace("\\", "/")
        if rel == "KIT_MANIFEST.json":
            continue
        present.add(rel)
    untracked = sorted(present - set(listed))

    print()
    print("== integrity ==")
    print("MISSING (listed, absent):        %d %s" % (len(missing), missing))
    print("SHA MISMATCH (content changed):  %d" % len(mismatch))
    for rel, want, got in mismatch:
        print("    %-52s manifest=%s disk=%s" % (rel, want, got))
    print("BYTES MISMATCH (sha equal):      %d %s" % (len(size_off), size_off))
    print("UNTRACKED (present, not listed): %d" % len(untracked))
    for rel in untracked:
        print("    %s" % rel)

    print()
    print("== does the kit ship a manifest verifier? ==")
    for path in sorted((KIT / "scripts").glob("*.py")):
        text = path.read_text(encoding="utf-8", errors="replace")
        flags = []
        if "KIT_MANIFEST" in text:
            flags.append("reads-KIT_MANIFEST")
        if "sha256" in text.lower():
            flags.append("sha256")
        print("%-42s %s" % (path.name, ",".join(flags) or "-"))


if __name__ == "__main__":
    main()
