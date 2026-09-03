# Inbound search (D1 FTS5) — moved

This doc has been folded into **[mailbox-d1.md](../architecture/mailbox-d1.md)**.

Mail search + list + counts + Sent are now one D1, `relaybase-mail` (`mailbox_messages` + `mailbox_fts`), for both inbound and sent. The old inbound-only `RELAYBASE_INBOX_INDEX` / `inbound_search_fts` setup is retired. See:

- **[mailbox-d1.md](../architecture/mailbox-d1.md)** — schema, querying, sync model, backfill.
- **[mailbox-r2.md](../architecture/mailbox-r2.md)** — R2 object layout (thin `meta.json` + `raw.eml`).
- **[d1-migrations-and-init-db.md](../architecture/d1-migrations-and-init-db.md)** — `init-db` / `migrate-db` for the `mail` target.
