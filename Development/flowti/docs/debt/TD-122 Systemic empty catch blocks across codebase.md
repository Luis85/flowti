---
type: TechDebt
severity: low
category: error-handling
layer: cross-cutting
status: open
created: 2026-02-21
effort: medium
description: "22 empty catch {} blocks across 17 source files. Most have inline comments explaining intent, but several are truly silent. The pattern makes it impossible to distinguish intentional error suppression from accidental swallowing."
---

# TD-122: Systemic empty catch blocks across codebase

## Problem

The codebase contains **22 empty `catch {}` blocks** spread across 17 source files. While many have inline comments explaining the intent (e.g., "file may already exist", "extension already registered"), the pattern is inconsistent and some catches are truly silent.

| Category | Count | Files | Risk |
|----------|-------|-------|------|
| File existence checks | 8 | FileSystemClient, DocService, PipelineExecutor, ConfigDocService, ExportService, SessionWorkspaceView | Low — idiomatic for "try read, if fails, doesn't exist" |
| Idempotent creation | 5 | SessionWorkspaceView (3), FolderPickerModal, fieldHandlers | Low — acceptable "create-if-not-exists" |
| Service error delegation | 2 | DataExchangeService | Medium — assumes child emitted error event |
| Registration idempotency | 2 | main.ts, dataExchangeSetup.ts | Low — "may already be registered" |
| Date/JSON parsing fallback | 3 | EventLogView (2), UserHubView | Low — returns fallback value |
| Silent error suppression | 2 | syncHandlers.ts, FolderSuggest.ts | **Medium** — discards potentially important errors |

### Highest-risk catches

1. **`syncHandlers.ts:120`** — Silently discards ALL reverse sync errors with only a comment "non-critical". This could mask data loss scenarios where session notes fail to parse.
2. **`DataExchangeService.ts:103,118`** — Assumes child service (ImportService/ExportService) already emitted a `*.failed` event. If the child throws before emitting, the error is lost entirely.

## Impact

- Difficult to distinguish intentional suppression from accidental swallowing
- No systematic way to audit which catches are safe vs. risky
- ESLint has no rule enabled to flag empty catches (related to [[TD-117]])

## Suggested Fix

1. Replace silent `catch {}` with `catch { /* intentional: reason */ }` standardized comment
2. For medium-risk catches, add fallback error emission via ErrorService
3. When TD-117 (no-floating-promises) and TD-105 (void emit) are addressed, many of these catches become less necessary since the EventBus will have its own error boundary

## Related

- [[TD-102 FileSystemClient.fileExists conflates not-found with failure]] — one specific instance
- [[TD-107 DataExchangeService catch blocks assume child service emitted error]] — two specific instances
- [[TD-105 void emit fire-and-forget masks handler failures]] — root cause for many fire-and-forget catches
- [[TD-117 ESLint config missing no-floating-promises rule]] — would catch some of these patterns

## Affected Files

- 17 source files with 22 empty catch blocks (see table above)
