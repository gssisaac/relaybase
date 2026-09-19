#!/usr/bin/env python3
"""Rewrite relative imports to @db, @lib, @services, @/ aliases."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

IMPORT_RE = re.compile(
    r'(?P<prefix>(?:import|export)\s+(?:type\s+)?(?:[^"\';]*?\s+from\s+|))'
    r'(?P<quote>["\'])'
    r'(?P<spec>\.{1,2}/[^"\']+)'
    r'(?P=quote)'
    r'|import\s*\(\s*(?P<quote2>["\'])'
    r'(?P<spec2>\.{1,2}/[^"\']+)'
    r'(?P=quote2)\s*\)'
)


def resolve_spec(from_file: Path, spec: str) -> Path | None:
    base = (from_file.parent / spec).resolve()
    candidates = [base, Path(str(base) + ".ts"), base / "index.ts"]
    for c in candidates:
        if c.is_file():
            return c
    return None


def to_alias(target: Path) -> str | None:
    try:
        rel = target.relative_to(SRC.resolve())
    except ValueError:
        return None
    parts = rel.parts
    stem = rel.stem
    def part_name(p: str) -> str:
        return p[:-3] if p.endswith(".ts") else p

    if parts[0] == "db":
        segs = [part_name(p) for p in (parts[1:-1] if stem == "index" else parts[1:])]
        path = "/".join(segs)
        return f"@db/{path}" if path else "@db"
    if parts[0] == "lib":
        segs = [part_name(p) for p in (parts[1:-1] if stem == "index" else parts[1:])]
        return f"@lib/{'/'.join(segs)}"
    if parts[0] == "services":
        segs = [part_name(p) for p in (parts[1:-1] if stem == "index" else parts[1:])]
        return f"@services/{'/'.join(segs)}"
    if stem == "index":
        path = "/".join(parts[:-1])
    else:
        path = "/".join(parts[:-1] + (stem,))
    return f"@/{path}"


def should_alias(spec: str) -> bool:
    return spec.startswith("../") or (
        spec.startswith("./") and "/" in spec.replace("\\", "/")
    )


def convert_spec(from_file: Path, spec: str) -> str:
    if not should_alias(spec):
        return spec
    target = resolve_spec(from_file, spec)
    if not target:
        return spec
    alias = to_alias(target)
    return alias if alias else spec


def rewrite_file(path: Path) -> bool:
    text = path.read_text()
    changed = False

    def repl(m: re.Match[str]) -> str:
        nonlocal changed
        spec = m.group("spec") or m.group("spec2")
        new = convert_spec(path, spec)
        if new == spec:
            return m.group(0)
        changed = True
        if m.group("spec2"):
            return f'import("{new}")'
        quote = m.group("quote")
        return f'{m.group("prefix")}{quote}{new}{quote}'

    new_text = IMPORT_RE.sub(repl, text)
    if changed:
        path.write_text(new_text)
    return changed


def main() -> None:
    count = 0
    for ts in SRC.rglob("*.ts"):
        if rewrite_file(ts):
            count += 1
    print(f"updated {count} files")


if __name__ == "__main__":
    main()
