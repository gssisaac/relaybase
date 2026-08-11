# Dashboard page header layout

Canonical pattern for top-level dashboard pages (`/`, Accounts, Domains, Logs, Settings, Broadcasts, Audience, …).

Reference implementations: `UserDashboardView.tsx` (root) and `AccountsView.tsx`.

## Shell

```tsx
<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
  <DesktopTitleBar
    className="px-4 py-3"
    end={
      <>
        {/* filters / primary actions */}
        <Button variant="outline" size="sm" aria-label="Refresh …" onClick={…}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </>
    }
  >
    <div className="min-w-0">
      <h1 className="truncate text-lg font-semibold tracking-tight">
        Page title
      </h1>
      <p className="text-sm text-muted-foreground">
        One-line description
      </p>
    </div>
  </DesktopTitleBar>

  <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
      {/* page body */}
    </div>
  </div>
</div>
```

## Rules

| Do | Don’t |
|----|--------|
| Use `DesktopTitleBar` for the page chrome (Tauri drag region + toolbar) | Inline `flex justify-between` header rows with `h2` / `text-sm` titles |
| Title: `h1` + `truncate text-lg font-semibold tracking-tight` | Smaller `h2` / `text-sm font-semibold` page titles |
| Subtitle: `text-sm text-muted-foreground` | `text-xs` subtitles in the title bar |
| Put filters / Add / Refresh in `DesktopTitleBar` `end` | Leave Refresh or filters only inside the scroll body |
| Icon-only Refresh (`size-4`) with `aria-label` | Labeled “Refresh …” text on the toolbar refresh button |
| Body: scroll wrapper → `mx-auto w-full max-w-[1200px] space-y-4 p-4` | Full-bleed `px-4 py-4` without the max-width column (or a different max like `1100px`) |

## Notes

- Primary create actions still open a **Dialog** from the toolbar (see workspace rule `dashboard-add-dialog`).
- Nested detail shells (account sheet, broadcast/audience detail tabs) may use a tighter header; top-level list/overview pages must match this shell.
- When touching a page that still uses the old inline header or full-bleed body, bring it up to this format.
- `EmailShell` must treat every dashboard tab route as full-bleed (`dashboardScoped` in `email/components/EmailShell.tsx`). If a new top-level dashboard path is added to `useDashboardPaths().tabs` but omitted there, the page gets an extra outer `p-4` + `max-w-[1200px]` and looks more padded than Accounts / Dashboard.
