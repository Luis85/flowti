---
type: DecisionNote
adr: ADR-008
title: UI Command Bus for User Entry Points
status: Accepted
date: 2026-02-14
domain: infrastructure
category: Architecture
drivers:
  - Observability
  - Decoupling
  - Consistency
tags:
  - decision
  - architecture
  - command-bus
---

# ADR-008: UI Command Bus for User Entry Points

## Status

**Accepted** — implemented Feb 2026.

## Context

The plugin has 13+ user entry points: 8 Obsidian commands, 2 ribbon icons, and 3+ file-menu items. Previously, each entry point directly called Obsidian workspace API to open views/modals. This meant:

- User navigation was not observable (no events emitted)
- Duplicate view-opening logic across commands, ribbon icons, and file menus
- No way to trace what the user did in the activity log

### Alternatives Considered

1. **Keep direct workspace calls** — simple but invisible to the event system
2. **Shared utility function** — `openView(type)` — reduces duplication but still not observable
3. **UI Command Bus (chosen)** — all entry points emit `ui.*` events; `UiCommandService` handles the actual opening

## Decision

Every user entry point emits a `ui.*` event on the EventBus. A dedicated `UiCommandService` listens for these events and performs the actual view/modal opening.

### Event Map (8 events)

| Event | Payload | Opens |
|-------|---------|-------|
| `ui.openEventCatalog` | `{}` | Event Catalog (main workspace) |
| `ui.openEventLog` | `{}` | Event Log (right sidebar) |
| `ui.openComponentShowcase` | `{}` | Component Showcase (right sidebar) |
| `ui.openDataExchangeHub` | `{}` | Data Exchange Hub (main workspace) |
| `ui.openSubscriptionManager` | `{}` | Subscription Manager (modal) |
| `ui.openCsvImport` | `{ filePath?, savedConfig? }` | CSV Import view |
| `ui.openExport` | `{ sourcePath?, sourceType?, format, savedConfig? }` | Export view |
| `ui.opened` | `{ target, timestamp }` | *(completion event)* |

### Callback Injection

`UiCommandService` delegates to `DataExchangeSetup` via setter methods (`setOpenCsvImport`, `setOpenExportView`, `setOpenExportWithSavedConfig`) to avoid circular dependencies. Callbacks are wired during `onLayoutReady`.

### InputModal Fallback

When `filePath`/`sourcePath` is absent (palette command flow), `UiCommandService` shows an `InputModal` first, then delegates to the appropriate callback with the user-provided path.

## Consequences

### Positive

- **Full observability**: Every user action is an event — visible in the activity log
- **Single handler**: View opening logic lives in one place (`UiCommandService`)
- **E2E readiness**: `ui.opened` events enable future E2E tests to assert on user navigation
- **Consistent behavior**: Ribbon icons, commands, and file menus all route through the same handler

### Negative

- **Callback wiring**: Setter methods for data exchange callbacks add indirection
- **Not all modals routed**: Some modals (EventConfigModal, file pickers) still open directly from UI components — identified for future phases

## Related

- [[Backend Architecture]] — UiCommandService component section
- [[Event Catalog]] — UI Commands events section
- [[ADR-001 EventBus as Communication Backbone]]
