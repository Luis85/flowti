---
type: TechDebt
severity: high
category: architecture
layer: domain
status: open
effort: high
updated: 2026-02-19
description: SessionService at 1,729 LOC — well above 1,300 threshold. ~35 handler methods deeply coupled to service state. Extract into free-function modules with SessionHandlerContext interface.
domain: session
---

# TD-101: SessionService Handler Extraction

## Problem

`SessionService.ts` is the largest file in the codebase at **1,729 LOC**. It contains ~35 private async handler methods across 7 logical groups, all deeply coupled to shared service state (eventBus, fileSystem, timers, overload maps).

This makes the service:
- Difficult to navigate and reason about
- Risky to modify (high blast radius per change)
- Hard to test handler groups in isolation
- A bottleneck for parallel development

## Analysis (Cycle 8)

### Handler Groups Identified

| Group | Handlers | LOC | Shared State |
|-------|----------|-----|-------------|
| Lifecycle | start, pause, resume, complete, archive, rerun | ~180 | eventBus, state, fileSystem, timers |
| Field handlers | setIntent, setMode, setEnergy, updateNotes, updateDuration | ~80 | eventBus, state |
| Goal handlers | goalAdd, goalToggle, goalRemove, goalReorder | ~80 | eventBus, state |
| Task handlers | addTask, toggleTask, removeTask, reorderTasks | ~100 | eventBus, state |
| Reflection handlers | reflectionAdd, reflectionRemove | ~50 | eventBus, state |
| Closure handlers | completeClosure, skipClosure, finishReview | ~70 | eventBus, state |
| Tracking | trackActivity, checkCognitiveOverload, recordDecision | ~60 | eventBus, state, overload maps |
| Note sync | scheduleSyncNotesFile, syncNotesFile, executeReverseSync | ~100 | eventBus, fileSystem, timers |

### Proposed Pattern

Extract handlers as free functions receiving a `SessionHandlerContext`:

```typescript
interface SessionHandlerContext {
    eventBus: EventBus;
    state: SessionState;
    fileSystem: FileSystemClient | null;
    save(): void;
    scheduleSyncNotesFile(sessionId: string): void;
    checkCognitiveOverload(sessionId: string): void;
}
```

### Estimated Outcome

| Metric | Before | After |
|--------|--------|-------|
| SessionService LOC | 1,729 | ~580 (constructor + public API + delegation) |
| Handler modules | 0 | 4-5 files under `src/domain/session/handlers/` |
| Test impact | Existing tests unchanged | New handler-level unit tests possible |

## Constraints

- Must maintain backward compatibility — all public methods, event contracts, and test assertions unchanged
- Extract must be verified with `npm test` after each module extraction
- Handlers modify `this.state` directly — context must provide mutable state access

## Priority

**Required before PBI-SW-017** (Main/Sidebar Mode Separation). The SessionService needs to be manageable before the major UI refactor that SW-017 requires.

Promoted from stretch goal (Cycle 8) to required (Cycle 9).

## References

- Previous analysis: [[Cycle 8 - Complete Execution Layer]] (Inc 5 deferral section)
- PRD priority ranking: TD-101 → PBI-SW-017 → PBI-SW-015
- Related: [[TD-01 UI files exceed size convention]] (same class of issue)

> **Note:** This item was originally referenced as "TD-092" in Cycle 8 docs and PRD. The actual TD-92 is [[TD-92 No pull-request process in place]]. This file (TD-101) is the canonical debt item for SessionService extraction.
