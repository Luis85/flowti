# Journey 3: Catch Up After a Weekend Away

> **Persona:** A user who was offline for the weekend while their Dropbox folder
> accumulated changes. On Monday, they open Obsidian and reconciliation kicks in.

> **Test file:** `tests/acceptance/user-journeys.test.ts`

## Steps

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | Obsidian opens, plugin loads settings with `syncOnStart: true` | UC-36 Settings |
| 2 | ReconcileService checks enabled mappings with `reconcileOnStart: true` | UC-20 Reconciliation |
| 3 | SyncStateService reports unchanged files → skipped (incremental) | UC-21 Incremental |
| 4 | Modified files (different mtime/size) are synced | UC-21 Incremental |
| 5 | New files pass the filter pipeline and are synced | UC-15–18 Filtering |
| 6 | Concurrent reconcile guard prevents double-run if triggered again | UC-24 Concurrent Guard |
| 7 | User cancels mid-reconciliation → cooperative stop after current file | UC-23 Cancel |

## Happy Path Test

Load settings → reconcile enabled mappings → skip unchanged → sync modified → sync new files → verify concurrent guard blocks second run → verify cancel stops processing.
