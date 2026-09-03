# Tab Focus Policy

**Audience:** humans and coding agents changing keyboard handling, focus management, compose UI, or global app chrome.

**Source of truth:** `app/src/components/layout/DisableAppTabFocus.tsx`

---

## Policy

**Tab / Shift+Tab must not move focus around the Relaybase app UI by default.**

Browser tab-order focus fights the mail keyboard layer (list navigation, command shortcuts, Cmd+K) and other app shortcuts. Do not rely on native tab stops for sidebar links, search, list rows, toolbar buttons, or dashboard chrome.

**Opt-in only:** Tab may cycle focus inside explicitly marked compose-style field groups (e.g. From → To → Cc → Subject → body).

---

## How it works

1. `DisableAppTabFocus` mounts under `DesktopDashboardGate` → `DashboardShell` (desktop and browser).
2. It listens for `keydown` on `window` in the **capture** phase.
3. For `Tab` / `Shift+Tab`:
   - If focus is **outside** a `[data-allow-tab-focus]` ancestor → `preventDefault` (no focus move).
   - If focus is **inside** such a zone → Tab cycles only among that zone’s text fields (inputs, textareas, selects, combobox/textbox roles). Focus wraps within the zone.
4. Action buttons (Send, Discard, etc.) are **not** in the Tab cycle even when they sit inside an allow zone — only field controls matching the selector in `DisableAppTabFocus`.

Constant for the marker: `ALLOW_TAB_FOCUS_ATTR` (`"data-allow-tab-focus"`).

---

## Current allow zones

| UI | File | Marker |
|----|------|--------|
| Compose (standalone + reply compact) | `app/src/email/components/compose/ComposeForm.tsx` | `data-allow-tab-focus` on the form root |

Compose field order (when present): From (select) → To → Cc → Subject → body. Send remains click / ⌘Enter.

---

## Adding a new Tab-allowed region

Only do this for dense form sequences where Tab between fields is expected (compose-like editors). Prefer click + dedicated shortcuts elsewhere.

1. Put `data-allow-tab-focus` on the **smallest** container that wraps the fields (import/use `ALLOW_TAB_FOCUS_ATTR` if useful).
2. Keep primary actions as buttons outside the field cycle when possible.
3. Do **not** mark whole pages, sidebars, dialogs, or the command palette “just in case.”
4. Do **not** remove or bypass `DisableAppTabFocus` to “fix” a control — mark a zone or use click/shortcut instead.

---

## Do not

- Re-enable global browser tab order.
- Scatter `tabIndex={0}` across chrome to restore Tab navigation.
- Handle Tab ad hoc in `MailListView` or other mail views without updating this policy.
- Assume login/setup pages are covered — this handler mounts with the dashboard shell only. Auth/setup pages are outside this gate unless you mount the same component there.

---

## Related

- Keyboard layers for mail commands: [email-command-system.md](email-command-system.md)
