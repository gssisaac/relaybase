# relaybase-studio

Central Studio backend. Unlike `worker/` (deployed to each customer's Cloudflare account),
this runs as a plain Node server operated by Relaybase — see
[`docs/features/studio-mode-v0.2.md`](../../docs/features/studio-mode-v0.2.md) §1.3.

## Run

```bash
cd hq/studio
pnpm install
pnpm dev
```

Listens on `http://localhost:32831` (override with `PORT`).
