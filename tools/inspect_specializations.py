"""Inspect how the README references specialization pages, and the real shape of
the specialization source files. Read-only.

v2: fixes two bugs of v1
  - broken regex (unbalanced parenthesis) that aborted the run
  - row detection assumed markdown table rows START with '|'; the README
    specialization index rows start with '[Title](url) | `tag`, ...' instead.
    That assumption is why derive_overlays.py reported indexedInReadme=0 and
    marked all 8 pages as unindexed.
"""

import json
import pathlib
import re

CLONE = pathlib.Path("C:/Users/Pichau/Documents/Aurora/atlas-kit/source/ciencia-da-computacao")
KIT = pathlib.Path("C:/Users/Pichau/Desktop/atlas-planning-kit")

MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
REL_LINK = re.compile(r"\[([^\]]+)\]\(((?!https?://)[^)]+)\)")


def main():
    readme_lines = (CLONE / "README.md").read_text(encoding="utf-8").splitlines()
    text = "\n".join(readme_lines)

    print("== link syntaxes in README ==")
    print("markdown links total :", len(MD_LINK.findall(text)))
    print("  of which http(s)   :", len([u for _, u in MD_LINK.findall(text) if u.startswith("http")]))
    print("  of which relative  :", len(REL_LINK.findall(text)))
    for title, url in REL_LINK.findall(text)[:12]:
        print("     rel: %-28s -> %s" % (title[:28], url))

    print()
    print("== rows that CONTAIN a pipe (not necessarily starting with one) ==")
    starts_pipe, contains_pipe = 0, 0
    for number, line in enumerate(readme_lines, start=1):
        stripped = line.strip()
        if "|" not in stripped:
            continue
        contains_pipe += 1
        if stripped.startswith("|"):
            starts_pipe += 1
        else:
            links = MD_LINK.findall(line)
            if links:
                print("l.%-4d NO-LEADING-PIPE %r" % (number, stripped[:120]))
    print("containsPipe=%d startsWithPipe=%d noLeadingPipeWithLink=%d"
          % (contains_pipe, starts_pipe, contains_pipe - starts_pipe))

    print()
    print("== every URL that mentions 'specializations' anywhere ==")
    for number, line in enumerate(readme_lines, start=1):
        for match in re.finditer(r"https?://[^\s)\]|\"'<>]*specializations[^\s)\]|\"'<>]*", line):
            print("l.%-4d %s" % (number, match.group(0)))

    print()
    print("== seed specializationPages: keys and one full page ==")
    pages = json.loads((KIT / "content" / "specialization-resources-seed.json")
                       .read_text(encoding="utf-8")).get("specializationPages", {})
    print("keys:", sorted(pages.keys()))
    first = sorted(pages.items())[0]
    print("-- %s" % first[0])
    print(json.dumps(first[1], ensure_ascii=False, indent=2)[:1200])

    print()
    print("== specialization source files: real structure ==")
    for path in sorted((CLONE / "specializations").glob("*.md")):
        raw = path.read_bytes()
        lines = raw.decode("utf-8", errors="replace").splitlines()
        headings = [(i, l) for i, l in enumerate(lines, 1) if re.match(r"^#{1,6}\s", l)]
        pipe_rows = sum(1 for l in lines if "|" in l and l.strip())
        bullets = sum(1 for l in lines if re.match(r"^\s*[-*+]\s", l))
        http = len(re.findall(r"https?://\S+", "\n".join(lines)))
        linked_rows = sum(1 for l in lines if MD_LINK.search(l))
        print("-- %-34s %5d bytes %4d lines" % (path.name, len(raw), len(lines)))
        print("   first lines: %r" % ([l[:60] for l in lines[:3]]))
        print("   headings=%d %s" % (len(headings), [(n, h[:34]) for n, h in headings[:3]]))
        print("   pipeRows=%d bullets=%d httpLinks=%d rowsWithMarkdownLink=%d"
              % (pipe_rows, bullets, http, linked_rows))


if __name__ == "__main__":
    main()
