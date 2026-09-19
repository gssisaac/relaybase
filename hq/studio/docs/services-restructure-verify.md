# Services restructure — plan vs done

Reference plan: domain folders under `services/` with singleton `service.ts`, move `lib/{templates,messages,...}` into matching domains.

## Completed

| Plan item | Status | Notes |
|-----------|--------|-------|
| `services/template/` + `catalog-store.ts` | Done | `template-catalog-store.ts` → `catalog-store.ts` |
| `services/message/` | Done | All `lib/messages/*` moved |
| `services/newsletter/` | Done | All `lib/newsletters/*`; `mapper.ts`; not `news-letter/` (kept `newsletter`) |
| `services/trigger/` | Done | All `lib/triggers/*` moved |
| `services/subscriber/` | Done | `lib/subscriber-groups/*` + `lib/unsubscribe/*` |
| `services/account/` | Done | compliance, account-link serialize, suppression, console-domains |
| `services/tracking/` | Done | `lib/tracking/*` |
| `services/analytics/` | Done | `lib/analytics/*` + `lib/dashboard/*` |
| `services/asset/` | Done | `lib/assets/*` |
| `services/job/service.ts` | Done | Minimal scheduled-job helpers |
| Singleton `TemplateService`, `MessageService`, … | Done | See `services/index.ts` |
| `lib/` infra-only | Done | auth, orm, db, mail, render, shared, vault, webhooks remain |
| Remove `services/domain/` | Done | Merged into `newsletter/` + `account/service.ts` |
| `@lib/templates` → `@services/template` imports | Done | No remaining `@lib/templates` etc. |
| `pnpm run typecheck` | Pass | |

## Partial / follow-up

| Plan item | Status | Notes |
|-----------|--------|-------|
| Routes call only `*Service` via `@services/index` | Done | `routes/*.ts` (except `auth.ts` → `authService`); `@lib/*` domain imports removed |
| Scheduler uses services only | Done | `scheduler.ts` → `studioDocumentService`, `newsletterService`, `subscriberGroupService` |
| `RecipientService` separate file | Partial | Recipient logic stays in `newsletter/dispatch.ts` |
| `ComplianceService` separate class | Partial | Folded into `AccountService` |
| `services/auth/service.ts` singleton | Partial | HTTP auth stays `lib/auth/hq-auth-service.ts` + `services/auth-service.ts` |
| Phase out `readStudioDocument` / `mutateStudioDocument` | Partial | Routes/scheduler use `studioDocumentService`; dispatch internals still call document helpers |
| `pipelineCards` / CRM services | N/A | No routes yet |

## Directory map (after)

```
services/
  index.ts
  repositories.ts
  auth-service.ts
  auth/auth.repository.ts
  studio/          # document bootstrap + persist
  template/        # service.ts + catalog-store.ts + …
  message/
  newsletter/
  trigger/
  subscriber/
  account/
  tracking/
  analytics/
  asset/
  job/
```
