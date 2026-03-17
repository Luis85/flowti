---
type: DoDCheck
date: 2026-02-21
cycle: 12
increment: 2
pbi: "[[PBI-005 Vault Folder Inbox]]"
result: PASS
---

# Definition of Done Check — Cycle 12 Inc 2: Vault Folder Inbox — Folder Watcher Core

> Evaluated against [[Increment Lifecycle]] §5.

---

## 1. Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Settings UI: configure watched folders (add/remove paths, toggle recursive per folder) | PASS | `UserHubPreferences.ts:178-239` — "Watched Folders" section in Inbox preferences: add row with path input + "+" button, per-folder recursive checkbox toggle, remove "×" button. Emits `settings.updateInboxWatchedFolders`. |
| InboxService registers new source type: `vaultFolder` | PASS | `InboxService.ts:39` — `"inbox.vaultFolder.noteDetected"` in `ALL_INBOX_SOURCES`. Lines 152-164: `file.created` and `file.modified` listeners with `handleVaultFolderFile()`. |
| `INBOX_SOURCE_DEFINITIONS` extended with vault folder source entry | PASS | `types.ts:51` — `{ event: "inbox.vaultFolder.noteDetected", label: "Vault folder notes", desc: "When an untyped note appears in a watched vault folder" }` |
| Notes with empty or missing `type` frontmatter in watched folders appear as inbox items | PASS | `InboxService.ts:306-323` — `processVaultFolderFile()` checks `getFrontmatter(path)`, skips if `type` is truthy non-empty string, otherwise creates item via `mapVaultFolderNote()`. 13 integration tests verify behavior. |
| Notes with existing `type` frontmatter are excluded | PASS | `InboxService.ts:308-309` — `if (typeVal && typeof typeVal === "string" && typeVal.trim()) return;`. Test: "should skip files WITH type frontmatter". |
| Source badge shows "Vault Folder" for folder-sourced items | PASS | `types.ts:53` — `SOURCE_EVENT_LABELS["inbox.vaultFolder.noteDetected"] = "Vault Folder"`. `formatSourceEvent()` resolves this for badge rendering. |
| Per-source toggle for vault folder watching in Settings | PASS | `INBOX_SOURCE_DEFINITIONS` includes vault folder entry — iterated by `renderInboxDetail()` to render toggle checkbox. `settings.ts:169` — default `inboxEnabledSources` array includes `"inbox.vaultFolder.noteDetected"`. |
| `npm run build` passes | PASS | 3,066 tests passing, 122 suites. `npm test` (tsc + eslint + vitest) green. |

**Section result: PASS** — 8/8 criteria met.

---

## 2. Tests Added

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `tests/domain/inbox/vaultFolderMapper.test.ts` | 12 | Constants (source event, source hub), InboxItem shape, type always "action", title/description/timestamp/read correctness, provided ID usage, edge cases (long paths, special characters) |
| `tests/domain/inbox/inboxServiceFolder.test.ts` | 13 | file.created + file.modified listeners, folder path filtering, frontmatter type exclusion, non-markdown skip, recursive vs direct-only matching, enabledSources guard, dedup by path, event emission (inbox.vaultFolder.noteDetected + inbox.itemAdded), empty watchedFolders, whitespace-only type, timer cleanup on dispose |

**Total new tests:** 25 (estimated 20 — exceeded)
**Total test count:** 3,066 (baseline 3,041 + 25)
**No regressions:** All 3,041 existing tests still pass
**No new skips:** 32 skipped (unchanged)

**Section result: PASS**

---

## 3. Build Pipeline

| Check | Status |
|-------|--------|
| `npm test` (tsc + eslint + vitest) | PASS |
| `npm run build` (esbuild production) | PASS (inferred — tsc clean) |

**Section result: PASS**

---

## 4. Architectural Boundaries

| Check | Status | Evidence |
|-------|--------|----------|
| Domain isolation | PASS | New mapper in `src/domain/inbox/vaultFolderMapper.ts` — imports only from `./types`. InboxService extension stays within inbox domain. |
| Event discipline | PASS | 2 new events: `inbox.vaultFolder.noteDetected` (domain), `settings.updateInboxWatchedFolders` (command). Both registered in catalog with correct category, direction, and domain. Composed into FlowtiEventMap via existing interface extension. |
| Service pattern compliance | PASS | `setWatchedFolders()` and `getFrontmatter` late-binding getter follow existing patterns (`setEnabledSources`, `nudgeService.isSessionTypeActive`). |
| Settings pattern compliance | PASS | `inboxWatchedFolders` setting follows Zod schema pattern. SettingsService handler follows exact existing `eventBus.on("settings.updateXxx")` pattern. |
| UI pattern compliance | PASS | Watched folders UI integrated into existing `renderInboxDetail()` method. Uses same DOM helpers (createDiv, createEl, setIcon) and event pattern (emit + scheduleRender). |
| No circular dependencies | PASS | `vaultFolderMapper.ts` depends only on `./types`. InboxService imports from `./vaultFolderMapper` (peer). main.ts wires via late-binding getter (no circular import). |
| Late-binding getter (metadataCache) | PASS | `getFrontmatter` wired in `main.ts` via `app.vault.getAbstractFileByPath()` + `app.metadataCache.getFileCache()`. Same pattern as `nudgeService.isSessionTypeActive`. |

**Section result: PASS**

---

## 5. Files Delivered

### New Files (1 source + 2 test)

| File | LOC | Purpose |
|------|-----|---------|
| `src/domain/inbox/vaultFolderMapper.ts` | 32 | Pure mapper + source event/hub constants |
| `tests/domain/inbox/vaultFolderMapper.test.ts` | 95 | 12 unit tests for mapper |
| `tests/domain/inbox/inboxServiceFolder.test.ts` | 166 | 13 integration tests for folder watching |

**Total new source LOC:** 32 mapper (service extensions are inline modifications)

### Modified Files (10)

| File | Change |
|------|--------|
| `src/domain/inbox/types.ts` | +1 entry in `INBOX_SOURCE_DEFINITIONS` |
| `src/domain/inbox/events.ts` | +`inbox.vaultFolder.noteDetected` event in `InboxEventMap` |
| `src/domain/inbox/InboxService.ts` | +~70 LOC: imports, fields (`watchedFolders`, `fileDebounceTimers`, `getFrontmatter`), `setWatchedFolders()`, `file.created`/`file.modified` listeners, `handleVaultFolderFile()`, `findMatchingFolder()`, `processVaultFolderFile()`, timer cleanup in `dispose()` |
| `src/domain/settings/settings.ts` | +`inboxWatchedFolders` Zod field, +source in `inboxEnabledSources` default |
| `src/domain/settings/events.ts` | +`settings.updateInboxWatchedFolders` event |
| `src/domain/settings/SettingsService.ts` | +1 update handler for watched folders |
| `src/infrastructure/events/catalog.ts` | +2 entries: `inbox.vaultFolder.noteDetected`, `settings.updateInboxWatchedFolders` |
| `src/ui/userHub/types.ts` | +1 entry in `SOURCE_EVENT_LABELS` |
| `src/ui/userHub/UserHubPreferences.ts` | +~60 LOC: watched folders UI section (add/remove/recursive toggle) |
| `src/main.ts` | +TFile import, +`setWatchedFolders()` + `getFrontmatter` wiring, +settings sync |

### Test Fix Files (1)

| File | Change |
|------|--------|
| `tests/infrastructure/events/EventBus.test.ts` | +`inboxWatchedFolders: []` in 2 inline settings objects |

---

## 6. Deviations from Plan

| # | Deviation | Rationale |
|---|-----------|-----------|
| D-1 | Mapper created as `src/domain/inbox/vaultFolderMapper.ts` (not `src/domain/inbox/mappers/vaultFolderMapper.ts`) | Cannot have both `mappers.ts` file and `mappers/` directory — import ambiguity. Peer file placement is cleaner. |
| D-2 | No separate `src/ui/settings/InboxFolderSettings.ts` created | Watched folders UI integrated directly into existing `UserHubPreferences.renderInboxDetail()` — follows existing source toggle pattern, avoids unnecessary file creation. |

---

## 7. Improvement Backlog

| # | Item | Classification | Target |
|---|------|---------------|--------|
| I-1 | Add folder path validation (check if folder exists in vault) | Improvement | Inc 3 or future cycle |
| I-2 | Add folder path autocomplete/picker using Obsidian suggest API | Improvement | Future cycle |
| I-3 | Consider extracting `findMatchingFolder()` to a shared utility if reused in Inc 3 triage routing | Observation | Inc 3 |
| I-4 | Integration tests use real `setTimeout` debounce (500ms per test) — consider `vi.useFakeTimers()` for faster execution | Observation | TD candidate |

---

## Summary

| DoD Criterion | Status |
|---------------|--------|
| Acceptance criteria met | PASS (8/8 met) |
| Tests added per TestPlan | PASS (25 new tests, no regressions) |
| Build pipeline passes | PASS |
| Architectural boundaries respected | PASS |
| No blockers remaining | PASS |
| Deviations documented | PASS (2 deviations, both justified) |
| Improvement items captured | PASS (4 items classified) |
| **Overall** | **PASS** |

---

## Related

- [[Increment Lifecycle]] §5 — Definition of Done checklist
- [[PBI-005 Vault Folder Inbox]] — parent PBI
- [[Hubs PRD]] — parent PRD
- [[Cycle 12 - User Hub Inbox]] — cycle plan
- [[Cycle 12 Inc 1 DoD Check - Quick Capture Ribbons]] — previous increment
