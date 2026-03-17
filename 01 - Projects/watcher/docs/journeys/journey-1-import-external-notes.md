# Journey 1: Import External Notes into Obsidian

> **Persona:** A researcher who keeps notes in an external folder (synced via Dropbox)
> and wants them automatically imported into their Obsidian vault.

> **Test file:** `tests/acceptance/user-journeys.test.ts`

## Steps

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | User configures a source-only mapping (`/external/notes` → `vault/imported`) | UC-36 Settings |
| 2 | A new file `report.md` appears in the source folder | UC-01 Core Sync |
| 3 | Temp files (`~$report.docx`) and dotfiles (`.DS_Store`) are filtered out | UC-17, UC-18 Filtering |
| 4 | File extension filter allows `.md` but blocks `.exe` | UC-15 Filtering |
| 5 | Path traversal check validates source and target paths | UC-31 Safety |
| 6 | ConflictResolver decides "overwrite" (first sync, no conflict) | UC-06 Conflict |
| 7 | File is written to `vault/imported/report.md` | UC-01 Core Sync |
| 8 | SyncState records the file's mtime and size | UC-43 Persistence |
| 9 | Subsequent reconciliation skips the unchanged file | UC-21 Incremental |

## Happy Path Test

Configure mapping → filter pipeline accepts `report.md` → validate paths → resolve conflict → record sync state → verify incremental skip on re-check.
