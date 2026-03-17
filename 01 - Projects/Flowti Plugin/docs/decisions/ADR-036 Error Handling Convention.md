---
type: ADR
status: accepted
date: 2026-02-22
relates:
  - "[[TD-29 Error handling inconsistency]]"
  - "[[TD-122 Systemic empty catch blocks]]"
tags:
  - architecture
  - error-handling
  - convention
---

# ADR-036: Error Handling Convention

## Context

An audit of the codebase (Cycle 16 Inc 3) found 85+ catch blocks across 37 files. While most follow reasonable patterns, 6 catches silently discarded error information, and 3 high-risk catches masked failures in critical paths (state persistence, plugin startup, note sync).

This ADR establishes a convention for all error handling in the Flowti plugin, eliminating ambiguity about when empty catches are acceptable vs when they mask bugs.

## Decision

### Strategy Classification

Every catch block MUST use one of these 6 strategies:

| Strategy | When to use | Pattern |
|---|---|---|
| **emit** | Domain services with eventBus access | `await eventBus.emit("domain.operation.failed", { error: msg })` |
| **rethrow** | Infrastructure code, middleware, adapters | `throw new Error("Context: " + original)` |
| **log+continue** | Non-critical operations where parent should proceed | `console.warn("[Flowti] Context:", err.message)` |
| **user-notify** | UI actions where user needs feedback | `new Notice("Operation failed — details in console")` |
| **fallback** | Operations with a valid alternative path | `catch { return defaultValue; }` |
| **intentional-silent** | Race conditions, existence checks, optional operations | `catch { /* intentional: file may not exist yet */ }` |

### Rules

1. **No unnamed empty catches.** Every `catch {}` or `catch { }` MUST have a comment starting with `// intentional:` explaining why no action is taken.

2. **Always capture the error variable** unless the catch is intentional-silent for a well-understood, narrow condition. Use `catch (err: unknown)` not `catch`.

3. **Never swallow persistence failures.** If `saveState()`, `storage.save()`, or `vault.modify()` can fail inside a try block, the catch MUST at minimum log the error.

4. **Critical path errors must surface.** Plugin startup (`onLayoutReady`), settings persistence, and session state persistence must use `emit` or `errorService.handle()` — never silent catches.

5. **UI actions must notify users.** When a user-initiated action (button click, form submit) fails, use `new Notice()` in addition to `console.error`.

6. **Fallback catches must document the fallback.** When a catch returns a default value, comment what the default is and why it's safe.

### Justified Silent Catches

These patterns are explicitly acceptable with an `// intentional:` comment:

- **File existence probes**: `fileSystem.fileExists()` or `vault.getAbstractFileByPath()` returning null
- **Race condition recovery**: File created between check and create — retry with `getAbstractFileByPath()`
- **Extension registration**: `registerExtensions()` may fail if another plugin registered first
- **Optional metadata reads**: `metadataCache.getFileCache()` returning null for missing files
- **JSON parse of user content**: Malformed frontmatter or config — fall back to defaults

## Consequences

### Positive
- Developers can audit catch blocks by searching for `// intentional:` vs missing comments
- Critical failures (persistence, startup) are always surfaced
- Users get feedback when their actions fail
- Error context is preserved for debugging

### Negative
- Slightly more verbose catch blocks
- Developers must choose a strategy for each catch (but the 6-strategy table makes this straightforward)

## Audit Summary (Cycle 16)

| Metric | Count |
|---|---|
| Total catch blocks audited | 85+ |
| Files with catch blocks | 37 |
| Justified empty catches | 17 |
| Unjustified catches fixed | 6 |
| High-risk catches addressed | 3 |
| New event type added | `settings.saveFailed` |

### Fixes Applied

| ID | File | Issue | Fix |
|---|---|---|---|
| U1 | `AzureDevOpsAdapter.ts` | Mapping error discarded detail | Include `err.message` in SyncError |
| U2 | `syncHandlers.ts` | Reverse sync silently swallowed | Added `console.warn` with session ID |
| U3 | `fieldHandlers.ts` | Output artifact creation error masked | Check error message before suppressing |
| U4 | `fieldHandlers.ts` | Notes file link append silently failed | Added `console.warn` |
| U5 | `DefinitionFormPage.ts` | Transform save only console.error | Added `new Notice()` for user feedback |
| U6 | `SessionWorkspaceView.ts` | Notes file creation silently failed | Added `console.warn` when file truly missing |
| R2 | `SettingsService.ts` | Save failure only console.error | Added `settings.saveFailed` event emission |
