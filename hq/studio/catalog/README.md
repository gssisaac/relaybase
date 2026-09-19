# Template gallery blueprints

Each `templates/*.yaml` file is a read-only message blueprint shown in Studio (`GET /studio/templates`).

- Edit YAML here and commit to git.
- Studio loads this directory from disk at runtime (`catalog/templates/`).
- After adding a file, register it in `src/lib/templates/builtin-catalog.imports.ts` (Worker bundle).

## Metadata

| Field | Purpose |
|-------|---------|
| `target` | Primary Studio surface: `newsletter` (broadcasts), `trigger` (automations / 1:1), or `both`. |
| `category` | Style / compliance hint: `newsletter`, `transactional`, `conversational`, or `marketing`. |

If `target` or `category` is omitted, hq/studio infers them from the template `id` prefix (`msgtpl_broadcast_*` → newsletter, `msgtpl_automation_*` → trigger).
