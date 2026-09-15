# CmdDropdown — searchable domain & account pickers

**Audience:** humans and coding agents changing Scale/CRM/email forms that pick Worker domains or Console account addresses.

**Component:** `app/src/components/ui/cmd-dropdown.tsx` — export `CmdDropdown`, `CmdDropdownOption`.

**Not the same as:** mail **Cmd+K** (`app/src/email/commands/`). That is the command palette; this is a **form control** (popover + `cmdk` filter).

---

## When to use

| Use **CmdDropdown** | Use **Select** (`@/components/ui/select`) |
|---------------------|---------------------------------------------|
| Worker **sending domain** lists | Small fixed enums (e.g. automation **purpose**, 3–5 values) |
| **Account / sender email** on a domain (Console addresses) | **Display name** when options are short and rarely searched |
| Any long or growing list where users expect **type-to-filter** | **Default template** and similar compact catalogs when search adds little value |

Do **not** use native `<select>` / `<option>` for new UI (see workspace shadcn form-control rules).

---

## UX conventions

- **Label + `triggerId`:** pair `<Label htmlFor="…">` with `triggerId` on `CmdDropdown` for accessibility.
- **Placeholders:** reflect loading / empty / blocked states (mirror previous `SelectValue placeholder` copy).
- **`searchPlaceholder`:** short hint (`Search domains…`, `Search accounts…`).
- **`triggerClassName="min-w-0"`** inside grids or `max-w-*` layouts so the trigger can shrink.
- **Domain change:** when the domain changes, clear **from email** / **reply-to** if they no longer match that domain (same rules as legacy Select handlers).
- **Clear row:** `CmdDropdown` shows “Clear selection” when `required` is false (default). Keep `required` for fields that must stay set on save.

---

## Example (single select)

```tsx
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import { Label } from "@/components/ui/label";

const domainOptions = domainNames.map((d) => ({ value: d, label: d }));

<Label htmlFor="send-domain">Domain</Label>
<CmdDropdown
  triggerId="send-domain"
  triggerClassName="min-w-0"
  value={sendDomain}
  placeholder="Select sending domain"
  searchPlaceholder="Search domains…"
  options={domainOptions}
  disabled={domainsLoading && domainOptions.length === 0}
  onValueChange={(next) => {
    if (!next) {
      setSendDomain(null);
      return;
    }
    setSendDomain(next);
    // clear dependent account fields when domain changes…
  }}
/>
```

**Reference implementations:** `AutomationSettingsView`, `BroadcastSettingsView`, `AddEmailAccountDialog`.

---

## Adding options

```ts
type CmdDropdownOption = {
  value: string;
  label: string;
  keywords?: string; // optional extra search text
  disabled?: boolean;
  icon?: React.ReactNode;
};
```

Multi-select: `multiple` + `value: string[]` — use only when product UX needs it (CmdDropdown supports it; most identity forms are single-select).
