---
type: Increment
feature: "[[Hubs PRD]]"
pbi: "[[PBI-002 Documentation Sessions]]"
phase: 4
increment: 4
stage: done
date: 2026-02-16
tasm_score: 34
tasm_review: "[[Three Amigos Review - Focus File and Timeline 2026-02-16]]"
tests_added: 9
tests_total: 1887
test_suites: 82
loc_added: 0
---

# Phase 4, Increment 4: Focus File & Vault File Picker

## Context

Sessions lacked a way to associate a specific vault file as the "focus" of the session, making it hard to stay on-task.

## Scope

`focusFile: string | null` added to Session, threaded through all creation paths (create, rerun, createFromTemplate, saveTemplateFromSession). Focus file text input + "Browse" button on `NewSessionModal`. New `VaultFilePickerModal` using `FuzzySuggestModal`. Clickable focus file link in session detail panel.

## Changes

### New Files

- `src/ui/FilePickerModal.ts` — `VaultFilePickerModal` (~22 LOC) using FuzzySuggestModal

### Modified Files

- `src/domain/session/types.ts` — `focusFile: string | null` on Session, `focusFile?: string` on SessionTemplate
- `src/domain/session/helpers.ts` — `createSession()` accepts optional `focusFile`
- `src/domain/session/SessionService.ts` — `focusFile` threaded through 4 methods
- `src/ui/modals.ts` — Focus file input + Browse button on NewSessionModal
- `src/ui/userHub/UserHubSessions.ts` — Focus file link in detail panel
- `src/ui/userHub/types.ts` — `openFile(path)` callback
- `src/ui/UserHubView.ts` — Wired `openFile` via `app.workspace.openLinkText()`

## Verification

1. 9 tests added, 1,887 tests pass across 82 suites
2. `npm run build` passes
3. Focus file set during creation, clickable in detail panel
4. VaultFilePickerModal shows all vault files
