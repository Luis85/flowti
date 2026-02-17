---
type: DecisionNote
adr: ADR-026
title: Composable Folder Filtering
status: Accepted
date: 2026-02-17
domain: session
category: Architecture
drivers:
  - Pure Function Design
  - Separation of Concerns
  - Reusability
tags:
  - decision
  - architecture
  - session
  - filtering
---

# ADR-026: Composable Folder Filtering

## Status

**Accepted** — to be applied in PBI-SW-001 Inc 1.

## Context

The Session Workspaces activity log needs folder filtering to exclude irrelevant paths (e.g., `.obsidian/`, `templates/`, `node_modules/`) from session activity. Two filter scopes are required:

1. **Global filters** — applied to all sessions, persisted in `SettingsService` (e.g., always exclude `.obsidian/`)
2. **Per-session filters** — applied to a specific session, persisted on the `Session` object (e.g., this session only tracks `src/domain/`)

The combined filter determines whether a vault file event is recorded as session activity.

### The Question: How Should Filtering Be Implemented?

Three approaches were considered:

1. **Filter Service** — a `SessionActivityFilterService` that subscribes to settings changes and session filter updates, maintains a merged filter list, and exposes `isExcluded(path)`. SessionService queries the filter service on each file event.

2. **Event-based filtering** — file events flow through a filter pipeline before reaching SessionService. A middleware or event transformer strips excluded events before they arrive.

3. **Pure function** — a stateless `isExcluded(path, globalFilter, perSessionFilter)` function called by SessionService directly. Global filter read from settings, per-session filter read from session state.

## Decision

**Option 3: Pure function `isExcluded()` with global + per-session composition.**

```typescript
function isExcluded(path: string, globalFilter: string[], perSessionFilter: string[]): boolean
```

### Why Pure Function Over Service or Event Pipeline

**A filter service is over-engineered for this use case.** The filtering logic is a simple prefix check against two arrays. Introducing a service adds: constructor injection, lifecycle management, event subscriptions for settings changes, state synchronization, and test setup overhead. This violates ADR-015 (Composition over Inheritance for Service Decomposition) — the simpler approach is preferred when the problem is well-bounded.

**Event-based filtering introduces invisible side effects.** Modifying events in transit makes the system harder to debug. Other consumers of `file.created`/`file.modified` (like artifact tracking) would also lose events, breaking the clean separation established in ADR-025. The filter should be applied at the consumer, not the pipeline.

**A pure function is testable, composable, and transparent:**
- **Testable** — no mocks, no setup, no state. Input → output.
- **Composable** — global and per-session filters are separate arrays, merged at call time. Either can be empty.
- **Transparent** — SessionService calls `isExcluded()` inline; the control flow is visible in a single method.
- **Consistent** — follows the pattern established in ADR-023 (Modal Business Logic Extraction), which moved pure business logic out of modals and into utility functions.

### Filter Semantics

- A path is excluded if it **starts with** any filter entry (prefix match)
- Filters are folder paths (e.g., `".obsidian/"`, `"templates/"`, `"src/ui/"`)
- Global and per-session filters are merged at call time: `isExcluded(path, global, perSession)` checks both arrays
- An empty filter array means "no exclusions" — all paths pass
- Filter entries without a trailing `/` are treated as prefix matches (matching both files and folders)

### Persistence

| Filter Scope | Storage | Accessed Via |
|-------------|---------|-------------|
| Global | `SettingsService` (`sessionActivityFilterGlobal: string[]`) | `settingsService.getSettings().sessionActivityFilterGlobal` |
| Per-session | `Session.activityFilter: string[]` | `session.activityFilter` |

Global filters are read from settings at call time — no caching needed. Per-session filters are stored on the session object and persisted with session state via TypedStorage.

## Consequences

### Positive

- **Zero dependencies** — `isExcluded()` is a standalone pure function in `helpers.ts`
- **100% testable** — ~10 test cases covering exact match, prefix, nested paths, empty arrays, combined filters
- **No new service** — no constructor injection, lifecycle, or wiring needed
- **Reusable** — the function can be used by any future feature that needs path filtering (e.g., activity summary generation, context binding filtering)
- **Follows ADR-023** — pure function extraction pattern already established

### Negative

- **No reactive invalidation** — when global settings change, in-flight activity isn't retroactively filtered. New settings only apply to future events. This is acceptable because activity is a forward-looking log.
- **No centralized filter state** — the merged filter must be computed at each call site. With only one call site (SessionService.onActivityEvent), this is negligible.

### Neutral

- **LOC impact** — ~12 LOC for the function + ~10 LOC for tests. Minimal.

## Files

| File | Change |
|------|--------|
| `src/domain/session/helpers.ts` | NEW: `isExcluded()` pure function |
| `src/domain/session/SessionService.ts` | MODIFIED: calls `isExcluded()` in `onActivityEvent()` |
| `src/domain/settings/settings.ts` | MODIFIED: `sessionActivityFilterGlobal` field in schema |

## Related

- ADR-015: Composition over Inheritance (simpler approach preferred)
- ADR-023: Modal Business Logic Extraction (pure function pattern)
- ADR-025: Activity Log Separate from Artifacts (filtering applies to activity, not artifacts)
- PRD: [[Session Workspaces PRD]] (FR-01: Activity Log)
- PBI: [[PBI-SW-001 Activity Log]]
