# Journey 2: Edit from Both Obsidian and VS Code

> **Persona:** A developer who edits markdown files in both Obsidian and VS Code,
> using bidirectional sync to keep both sides in sync.

> **Test file:** `tests/acceptance/user-journeys.test.ts`

## Steps

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | User configures a bidirectional mapping with `debounceDelay: 800` | UC-36 Settings |
| 2 | User edits `vault/imported/file.md` in Obsidian | UC-03 Bidirectional |
| 3 | VaultWatcher debounces rapid saves (min 1500ms for reverse) | UC-28 Debounce |
| 4 | After debounce, reverse sync writes to `/external/file.md` | UC-03 Bidirectional |
| 5 | SyncLoopDetector records the sync to prevent bounce-back | UC-27 Loop Prevention |
| 6 | Source watcher sees the change but loop detector blocks it | UC-27 Loop Prevention |
| 7 | After 5s cooldown expires, a genuine external edit is detected | UC-27 Loop Prevention |
| 8 | ConflictResolver uses "keepNewer" — source is newer, overwrites vault | UC-08 Conflict |

## Happy Path Test

Vault edit → debounced reverse sync → loop detector blocks bounce → cooldown expires → forward sync proceeds with keepNewer resolution.
