# Journey 5: Sync Content Across Devices

> **Persona:** [The Content Creator (Max)](Content%20Creator.md) — a multi-device user who
> captures ideas on his phone, refines them on his tablet, and uses the desktop vault as
> the authoritative documentation platform, all synced through OneDrive.

> **Test file:** `tests/user-journeys/journey-5-sync-across-devices.test.ts`

## Steps

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | Max configures a bidirectional mapping: OneDrive folder ↔ vault, `conflictResolution: "keepNewer"` | UC-36 Settings |
| 2 | Max captures a quick idea on his phone → file lands in OneDrive | (external — outside plugin scope) |
| 3 | OneDrive client syncs the file to the local folder — a `.tmp` partial appears first | UC-17 Temp Filtering |
| 4 | The `.tmp` file is filtered out, not imported into the vault | UC-17 Temp Filtering |
| 5 | The final file stabilizes (mtime/size unchanged across stability checks) | UC-25 Stability Checks |
| 6 | Forward sync imports the stable file into the vault | UC-01 Source-Only Sync, UC-03 Bidirectional |
| 7 | SyncStateService records the file's mtime and size | UC-43 Persistence |
| 8 | Max edits the same note on his tablet while the desktop vault is open — OneDrive delivers a newer version | UC-08 Conflict — Keep Newer |
| 9 | ConflictResolver detects the source is newer → overwrites the vault copy | UC-08 Conflict — Keep Newer |
| 10 | Max edits in Obsidian on the desktop at the same time as on the tablet — both versions arrive simultaneously | UC-09 Conflict — Rename |
| 11 | ConflictResolver creates a renamed conflict copy, preserving both versions | UC-09 Conflict — Rename |
| 12 | The file has an accented name (`café-ideas.md`) — Unicode NFC normalization ensures consistent matching | UC-33 Unicode Normalization |
| 13 | A file created on Android uses NFD — `toVaultPath()` normalizes it to NFC, preventing duplicates | UC-33 Unicode Normalization |
| 14 | OneDrive is temporarily unavailable (EBUSY on the local cached file) — retry succeeds | UC-26 Retry |
| 15 | SyncLoopDetector prevents the forward sync from bouncing back as a reverse sync | UC-27 Loop Prevention |
| 16 | Next morning, Max opens Obsidian after a night of phone-only edits — reconciliation catches up | UC-20 Reconciliation |
| 17 | Reconciliation skips files whose mtime+size haven't changed (incremental mode) | UC-21 Incremental Reconciliation |

## Happy Path Test

Capture idea on phone → OneDrive syncs to local folder → temp file filtered → stability check passes → forward sync imports into vault → state recorded → tablet edit arrives as newer version → keepNewer overwrites → simultaneous edit → rename preserves both → Unicode names normalized → retry on EBUSY succeeds → loop detector blocks bounce → reconciliation catches overnight edits → unchanged files skipped.
