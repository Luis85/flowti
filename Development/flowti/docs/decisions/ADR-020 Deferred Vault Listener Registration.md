---
type: DecisionNote
adr: ADR-020
title: Deferred Vault Listener Registration
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Architecture
drivers:
  - Correctness
  - Race Condition Prevention
  - Determinism
tags:
  - decision
  - architecture
  - lifecycle
---

# ADR-020: Deferred Vault Listener Registration

## Status

**Accepted** — critical for correct startup behavior.

## Context

When the plugin loads, Obsidian's vault may already contain files that trigger events (e.g., `metadata.changed`, `file.modified`). If vault listeners are registered before domain services have loaded their state, events fire into services that still hold `DEFAULT_STATE` — causing the dual-state bug where default values overwrite persisted data.

### Alternatives Considered

1. **Register vault listeners immediately** — simplest but causes race conditions
2. **Queue events during startup** — buffer events and replay after init — complex, memory overhead
3. **Deferred registration (chosen)** — register vault listeners as the last step in Phase 6

## Decision

EventBridge registration is split into two phases:

### Phase 1: `register()` (immediate)

Request handlers (`file.create.request`, `frontmatter.get.request`, etc.) are registered immediately because services may need file I/O during their own initialization.

### Phase 6: `registerVaultListeners()` (deferred)

Vault notification handlers (`file.created`, `file.modified`, `metadata.changed`, `workspace.leaf-changed`, etc.) are registered as the **last step** of `onLayoutReady`, after:

1. All services have called `.load()` (persisted state is live)
2. DataExchangeSetup has wired its callbacks
3. IngestionService has completed catch-up scanning

```
onLayoutReady:
  1. settingsService.load()
  2. userService.load()
  3. ... (all services load)
  4. DataExchangeSetup
  5. ingestionService.runCatchUp()
  6. eventBridge.registerVaultListeners()  ← LAST
  7. emit("plugin.ready")
```

## Consequences

### Positive

- **No race conditions**: Services have loaded their state before vault events start flowing
- **Deterministic startup**: Event flow begins at a known point — `plugin.ready`
- **Catch-up completeness**: IngestionService catch-up scan runs against loaded state, not defaults

### Negative

- **Events missed during startup**: Any vault changes between plugin load and `registerVaultListeners()` are not captured — mitigated by catch-up scanning
- **Split API**: EventBridge has two registration methods — slightly harder to understand for new contributors

## Related

- [[Backend Architecture]] — Initialization Sequence section
- [[ADR-011 Six-Phase Initialization Sequence]]
- [[ADR-003 EventBridge as Sole Obsidian API Contact Point]]
