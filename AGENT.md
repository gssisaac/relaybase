# Agent guide — Relaybase (`main` repo)

Private product monorepo: desktop app, Next.js UI, HQ, mobile. The product Worker lives in the sibling **`../worker/`** repo.

**Deep rules:** [AGENTS.md](AGENTS.md) — read before editing storage, auth, inbox, releases, etc.

**Workspace layout** (all repos under `productions/relaybase/`): see [`../AGENT.md`](../AGENT.md) at the workspace root when using a multi-repo Cursor workspace.

---

## Quick routing

| Task | Go to |
|------|-------|
| Inbox / dashboard / compose UI | `app/` |
| macOS app, DMG, updater | `desktop/` |
| Marketing / download page | `hq/website/` |
| **Cutting a release** | **[docs/release/workflow.md](docs/release/workflow.md)** |
| Version pairing (desktop ↔ Worker) | [docs/release/version-sync.md](docs/release/version-sync.md) |
| macOS build / R2 / notarize | [desktop/docs/release.md](desktop/docs/release.md) |
| Worker pack + GitHub publish | [../worker/docs/RELEASE.md](../worker/docs/RELEASE.md) |
| New API route or mail logic | `../worker/src/` |
| Architecture, auth, features | `docs/` |

---

## Release (summary)

1. Branch: `release-X.Y.Z` (never bump versions on `main` directly).
2. Release notes + version bumps (desktop; Worker too when `worker/` changed).
3. `cd desktop && RELAYBASE_NOTARIZE=1 pnpm run build:macos` → R2 + `latest.json`.
4. `cd ../worker && pnpm run publish:github` when Worker shipped (**required** for in-app Worker updates).
5. `cd hq/website && pnpm run deploy:cf`.
6. Push branch → PR → merge.

Full checklist and common mistakes: **[docs/release/workflow.md](docs/release/workflow.md)**.
