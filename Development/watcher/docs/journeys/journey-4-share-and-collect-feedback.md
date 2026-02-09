# Journey 4: Share Drafts and Collect Feedback

> **Persona:** [The Collaborator (Chris)](../personas/collaborator.md) — a team lead who shares drafts
> via a shared team folder and pulls back colleague edits into Obsidian.

> **Test file:** `tests/acceptance/user-journeys.test.ts`

## Steps

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | Chris configures a bidirectional mapping with `conflictResolution: "rename"` | UC-36 Settings |
| 2 | Chris writes `proposal.md` in Obsidian — VaultWatcher picks up the change | UC-03 Bidirectional |
| 3 | Reverse sync exports `proposal.md` to the shared team folder | UC-03 Bidirectional |
| 4 | A colleague opens the file in Word, creating `~$proposal.docx` lock file | UC-17 Temp Filtering |
| 5 | The lock file is filtered out — not imported into the vault | UC-17 Temp Filtering |
| 6 | The colleague saves edits to `proposal.md` while Chris also edits in Obsidian | UC-09 Conflict — Rename |
| 7 | ConflictResolver creates `proposal (conflict ...).md` — both versions preserved | UC-09 Conflict — Rename |
| 8 | Source file is initially locked (EBUSY) — retry succeeds on second attempt | UC-26 Retry |
| 9 | SyncLoopDetector prevents the forward sync from bouncing back as a reverse sync | UC-27 Loop Prevention |
| 10 | Next morning, Chris opens Obsidian — reconciliation catches any missed changes | UC-20 Reconciliation |

## Happy Path Test

Write draft in vault → reverse sync to shared folder → colleague edits while Chris edits → conflict creates renamed copy preserving both versions → temp/lock files filtered → retry on locked file succeeds → loop detector prevents bounce → reconciliation catches up on next start.
