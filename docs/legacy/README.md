# Legacy documentation

Archived docs describe **pre–console-only bio gate** behavior (Touch ID on
launch, `offerBiometry`, `unlock { mode: prompting | idle }`, single refresh
token). Current policy stores the owner passtoken in the keyring and uses
Touch ID only as the **read-gate** for that item — do not implement from
these files.

**Current docs** (use these instead):

| Topic | Current doc |
|-------|-------------|
| Auth map + use cases | [../authentication.md](../authentication.md) |
| Desktop phase machine | [../desktop-session-machine.md](../desktop-session-machine.md) |
| Local persistence + keyring | [../relaybase-home-storage.md](../relaybase-home-storage.md) |
| Remote owner auth summary | [../storage-architecture.md](../storage-architecture.md) → *Owner auth* |

## Archived files

| File | Era | Superseded by |
|------|-----|---------------|
| [authentication.md](./authentication.md) | Bio on boot + offerBiometry | [authentication.md](../authentication.md) |
| [desktop-session-machine.md](./desktop-session-machine.md) | Touch ID on launch | [desktop-session-machine.md](../desktop-session-machine.md) |
| [desktop-unlock-unresolved.md](./desktop-unlock-unresolved.md) | 2026-08-27 launch race fix | Console-only gate (no launch bio) |
| [relaybase-home-storage.md](./relaybase-home-storage.md) | `biometryEnabled` in keyring blobs | [relaybase-home-storage.md](../relaybase-home-storage.md) |

Snapshots were taken from `main` at the time of the console-gate migration
(Aug 2026).
