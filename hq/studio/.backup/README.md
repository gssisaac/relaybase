# Studio `data/` backups

Local gzip tar archives of `hq/studio/data/`. Not for production — dev snapshots only.

## What is backed up

| Included | Notes |
|----------|--------|
| `data/store/*.json` | Sharded dev store |
| `data/messages/*.yaml` | Message bodies |
| `data/templates/*.yaml` | Template gallery copies |
| `data/auth.json` | HQ dev users / JWT-related records |

Excluded from the archive: `.DS_Store` (macOS).

**Sensitive:** archives contain `auth.json`. Do not upload, commit, or share.

## Filename

```
YYYY-MM-DD_HH-MM-SS.tar.gz
```

Example: `2026-09-17_11-38-58.tar.gz` (local wall-clock time when the archive is created).

## Create a backup

Run from the **repository root**:

```bash
mkdir -p hq/studio/.backup
COPYFILE_DISABLE=1 tar -czf "hq/studio/.backup/$(date +%Y-%m-%d_%H-%M-%S).tar.gz" \
  --exclude='.DS_Store' \
  -C hq/studio data
```

One-liner from `hq/studio`:

```bash
mkdir -p .backup
COPYFILE_DISABLE=1 tar -czf ".backup/$(date +%Y-%m-%d_%H-%M-%S).tar.gz" \
  --exclude='.DS_Store' \
  -C . data
```

## Restore

**Replace** the current tree (destructive). Stop `pnpm dev` first if the server is running.

From repo root:

```bash
rm -rf hq/studio/data
mkdir -p hq/studio/data
tar -xzf hq/studio/.backup/YYYY-MM-DD_HH-MM-SS.tar.gz -C hq/studio
```

The archive unpacks to `hq/studio/data/` (paths inside the tar are `data/...`).

To restore into a temp folder for inspection:

```bash
mkdir -p /tmp/studio-restore
tar -xzf hq/studio/.backup/YYYY-MM-DD_HH-MM-SS.tar.gz -C /tmp/studio-restore
```

## Git

Only `*.tar.gz` files here are gitignored. This README is tracked.

## Related

- Dev data layout: [`../README.md`](../README.md) → **Dev data**
- Override data root: `STUDIO_DATA_DIR`
