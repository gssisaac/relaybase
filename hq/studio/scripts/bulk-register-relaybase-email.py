#!/usr/bin/env python3
"""Register all @relaybase.email contacts from store.json on the worker console API."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STORE = DATA / "store.json"
STORE_DIR = DATA / "store"
BASE = os.environ.get("RELAYBASE_WORKER_URL", "https://relaybase-api.gssisaac.workers.dev")
PASS = os.environ.get("RELAYBASE_PASSTOKEN", "")
DOMAIN = "relaybase.email"
UA = "RelaybaseBulkImport/1.0"
CHUNK = 10


def curl(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, str]:
    cmd = [
        "curl",
        "-sS",
        "-w",
        "\n__HTTP__%{http_code}",
        "-X",
        method,
        f"{BASE}{path}",
        "-H",
        "Content-Type: application/json",
        "-H",
        f"User-Agent: {UA}",
        "--max-time",
        "180",
    ]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])
    if body is not None:
        cmd.extend(["-d", json.dumps(body)])
    out = subprocess.check_output(cmd, text=True)
    if "\n__HTTP__" not in out:
        return 0, out
    text, http = out.rsplit("\n__HTTP__", 1)
    return int(http), text


def collect_emails(data: dict) -> dict[str, str]:
    emails: dict[str, str] = {}
    for g in data.get("audienceGroups", []):
        for c in g.get("contacts", []):
            e = (c.get("email") or "").strip().lower()
            if e.endswith(f"@{DOMAIN}"):
                emails[e] = (c.get("name") or "").strip()

    def walk(obj: object) -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in ("email", "memberEmail") and isinstance(v, str) and v.lower().endswith(
                    f"@{DOMAIN}"
                ):
                    emails.setdefault(v.strip().lower(), "")
                else:
                    walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    return emails


def load_store() -> dict:
    if STORE.is_file():
        return json.loads(STORE.read_text())
    if STORE_DIR.is_dir():
        out: dict = {}
        for path in sorted(STORE_DIR.glob("*.json")):
            out[path.stem] = json.loads(path.read_text())
        return out
    raise FileNotFoundError(f"No store data under {DATA}")


def main() -> int:
    if not PASS:
        print("Set RELAYBASE_PASSTOKEN", file=sys.stderr)
        return 1

    data = load_store()
    emails = collect_emails(data)
    local_parts = sorted({e.split("@")[0] for e in emails})
    display_names = {e.split("@")[0]: emails[e] for e in emails if emails[e]}

    code, login_text = curl("POST", "/console/login", {"passtoken": PASS, "label": "bulk-import"})
    login = json.loads(login_text)
    refresh_token = login.get("consoleRefreshToken")
    if not refresh_token:
        print(f"login failed HTTP {code}: {login_text[:300]}", file=sys.stderr)
        return 1

    _, ref_text = curl(
        "POST",
        "/console/refresh",
        {"refreshToken": refresh_token, "scope": "console"},
    )
    ref = json.loads(ref_text)
    token = ref.get("accessToken")
    if not token:
        print(f"refresh failed: {ref_text[:300]}", file=sys.stderr)
        return 1

    _, doms_text = curl("GET", "/console/domains", token=token)
    doms = json.loads(doms_text)
    domain_names = {d.get("domain", "").lower() for d in doms.get("domains", [])}
    if DOMAIN not in domain_names:
        code, add_text = curl("POST", "/console/domains", {"domain": DOMAIN}, token=token)
        print(f"add domain {DOMAIN}: HTTP {code} {add_text[:200]}")

    print(f"Registering {len(local_parts)} addresses on {DOMAIN}...")
    failures: list[tuple[int, int, dict]] = []
    for i in range(0, len(local_parts), CHUNK):
        chunk = local_parts[i : i + CHUNK]
        dn = {lp: display_names[lp] for lp in chunk if lp in display_names}
        body = {"localParts": chunk, "displayNames": dn, "inboundEnabled": True}
        code, text = curl("POST", f"/console/addresses?domain={DOMAIN}", body, token=token)
        try:
            res = json.loads(text)
        except json.JSONDecodeError:
            res = {"error": text[:500]}
        n = i // CHUNK + 1
        if code >= 400:
            failures.append((n, code, res))
            err = res.get("error", text) if isinstance(res, dict) else text
            print(f"  chunk {n}: FAIL HTTP {code} — {str(err)[:160]}")
        else:
            print(f"  chunk {n}: OK ({len(chunk)} addresses)")

    _, listed_text = curl("GET", f"/console/addresses?domain={DOMAIN}", token=token)
    listed = json.loads(listed_text)
    addrs = listed.get("addresses") or []
    print(f"\nWorker now lists {len(addrs)} addresses on {DOMAIN}")
    if failures:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
