---
type: DecisionNote
adr: ADR-011
title: Six-Phase Initialization Sequence
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Architecture
drivers:
  - Correctness
  - Determinism
  - Dependency Safety
tags:
  - decision
  - architecture
  - lifecycle
---

# ADR-011: Six-Phase Initialization Sequence

## Status

**Accepted** — defines the plugin startup contract.

## Context

The plugin has infrastructure components, domain services, UI views, and vault listeners that must initialize in a specific order. Services need the EventBus before they can subscribe. Views need services before they can render. Vault listeners must not fire until all services are ready to handle events.

### Alternatives Considered

1. **Lazy initialization** — components initialize on first use — race conditions, unpredictable order
2. **Flat sequential init** — simple list, no phases — hard to reason about dependencies
3. **Phased initialization (chosen)** — 6 explicit phases with clear contracts

## Decision

Plugin startup follows 6 phases:

| Phase | Name | What Happens |
|-------|------|-------------|
| 1 | Core Infrastructure | EventBus, Logger, ErrorService, EventBridge `.register()` |
| 2 | Containers | ServiceContainer, CommandRegistry, ViewRegistry |
| 3 | Registration | 11 services, 4 commands, 3 views registered (not initialized) |
| 4 | Service Initialization | `services.initializeAll()` — topological sort by dependencies |
| 5 | UI Binding | SettingTab, `bindViews()`, `bindCommands()`, UiCommandService |
| 6 | Post-Load (`onLayoutReady`) | All `.load()` calls, DataExchangeSetup, vault listeners, `plugin.ready` |

### Critical: Phase 6 Ordering

Within `onLayoutReady`:
1. All services call `.load()` first (prevents dual-state bug)
2. DataExchangeSetup wires callbacks and registers views
3. Vault listeners registered **last** (events only fire when services are ready)
4. `plugin.ready` emitted as the final signal

### Shutdown

Reverse order: `plugin.unloading` → EventBridge.dispose → services.disposeAll (reverse init) → commands/views clear → eventBus.clear → `plugin.unloaded`.

## Consequences

### Positive

- **Deterministic**: Every startup produces the same initialization order
- **Dependency-safe**: Services are initialized in topological order — dependencies are always ready
- **Debug-friendly**: Each phase emits lifecycle events observable in the log
- **Dual-state prevention**: Explicit `.load()` calls in Phase 6 prevent default-state overwrites

### Negative

- **Rigid**: Adding a new phase or moving a component between phases requires careful analysis
- **Long startup**: 6 sequential phases — acceptable at current scale (~50ms total)
- **Phase 6 complexity**: `onLayoutReady` handles too many concerns — acknowledged as tech debt (TD-05)

## Related

- [[Backend Architecture]] — Initialization Sequence section
- [[ADR-020 Deferred Vault Listener Registration]]
