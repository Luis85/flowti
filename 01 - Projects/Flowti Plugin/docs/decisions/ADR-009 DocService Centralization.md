---
type: DecisionNote
adr: ADR-009
title: Centralized Document Creation via DocService
status: Accepted
date: 2026-02-10
domain: domain/docs
category: Architecture
drivers:
  - Single Responsibility
  - Consistency
  - Observability
tags:
  - decision
  - architecture
  - domain
---

# ADR-009: Centralized Document Creation via DocService

## Status

**Accepted** — implemented in Phase 8 refactoring (Feb 2026).

## Context

Documentation files (events, domains, services, flows, etc.) were created in multiple places: catalog tab components, helper functions (`createEntityDoc`), and direct `fileSystemClient.createFile()` calls. This led to:

- Inconsistent path resolution across 6+ locations
- Duplicated content generation logic
- No central place to enforce naming conventions or existence checks
- No observable events for doc creation

### Alternatives Considered

1. **Keep distributed creation** — each component creates its own docs — scattered logic, inconsistent
2. **Utility function** — `createEntityDoc()` in helpers — better but still called directly, not observable
3. **Event-driven DocService (chosen)** — callers emit `doc.create`, DocService handles path resolution, content generation, and file creation

## Decision

All documentation file creation goes through `DocService` via `doc.create` events:

```
Any view emits "doc.create" { docType, name, ... }
  → DocService
    → resolves path via docsRootPath + type-specific subfolder
    → generates content via contentGenerator
    → checks existence
    → "doc.created" { path, docType }  OR  "doc.exists" { path }  OR  "doc.failed" { error }
```

### Scope

DocService supports 17 document types (see [[Data Dictionary]]). Path resolution and content generation are in dedicated modules (`pathResolver.ts`, `contentGenerator.ts`) — both at 100% test coverage.

### What Changed

- Removed `createEntityDoc()` from `catalog/helpers.ts`
- Migrated 6 catalog tabs to emit `doc.create` instead of direct file creation
- Migrated `DiscoveryService` from direct `fileSystem.createFile()` to `doc.create`
- Added `doc.created`/`doc.exists` listeners in views for post-creation navigation

## Consequences

### Positive

- **Single source of truth**: All path resolution and content generation in one place
- **Observable**: `doc.created` events enable reactive UI updates
- **Existence handling**: Duplicate creation silently succeeds with `doc.exists` event
- **Testable**: PathResolver and ContentGenerator are pure functions with 100% coverage

### Negative

- **Indirection**: Creating a doc requires emitting an event and listening for the result, instead of a direct function call
- **Two-step navigation**: Views must listen for `doc.created` to navigate to the new file

## Related

- [[Frontend Architecture]] — Phase 8 refactoring
- [[Data Dictionary]] — Document types and schemas
- [[ADR-005 File-Driven Entity Model]]
