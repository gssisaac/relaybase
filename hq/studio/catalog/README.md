# Template gallery blueprints

Each `templates/*.yaml` file is a read-only message blueprint shown in Studio (`GET /studio/templates`).

- Edit YAML here and commit to git.
- After adding a file, register it in `src/lib/templates/builtin-catalog.imports.ts` (Worker bundle).
- Local Node dev reads this directory from disk; Cloudflare Workers use the bundled imports.
