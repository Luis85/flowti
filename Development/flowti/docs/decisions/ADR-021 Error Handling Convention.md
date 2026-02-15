---
type: DecisionNote
adr: ADR-021
title: Error Handling Convention
status: Accepted
date: 2026-02-15
domain: cross-cutting
category: Architecture
drivers:
  - Consistency
  - Debuggability
  - Resilience
tags:
  - decision
  - architecture
  - error-handling
---

# ADR-021: Error Handling Convention

## Status

**Accepted** — codifies the 4 strategies already in use across 62 catch blocks.

## Context

The plugin has 62 `catch` blocks across 24 files. Four distinct error handling strategies emerged organically. Without a documented convention, new code uses whichever pattern the author first encounters, leading to inconsistency (TD-29).

### Alternatives Considered

1. **Single strategy** — use `FlowtiError` everywhere — too heavy for UI code and background saves
2. **Global error boundary** — catch-all at plugin level — loses context, can't make per-operation decisions
3. **No convention** — status quo — inconsistency grows with codebase
4. **Codified 4-strategy convention (chosen)** — document when to use each existing pattern

## Decision

### Strategy 1: Domain Wrapping (`FlowtiError` subclasses)

**When**: Critical failures that need structured context — error code, severity, category.

```typescript
throw new ServiceError("Failed to initialize SettingsService", {
  code: "SETTINGS_INIT_FAILED",
  severity: "critical",
  cause: originalError,
});
```

**Used by**: `ErrorService`, `FlowtiError` hierarchy, `EventBridge` (9 catch blocks)

### Strategy 2: Logged + Emitted

**When**: Service-level errors that other services or UI need to react to. Emit a `domain.*.failed` event so listeners can show notifications or trigger recovery.

```typescript
catch (err: unknown) {
  console.error("[Flowti] Import failed:", err);
  await this.eventBus.emit("dataExchange.import.failed", {
    error: err instanceof Error ? err.message : String(err),
  });
}
```

**Used by**: `DataExchangeService`, `CommandRegistry`, `CsvActionView` (~18 catch blocks)

### Strategy 3: Console-Only

**When**: Graceful degradation — the operation fails but the service continues with safe defaults. No other service needs to know.

```typescript
catch (err: unknown) {
  console.warn("[Flowti] Settings load failed, using defaults:", err);
  this.settings = DEFAULT_SETTINGS;
}
```

**Used by**: `SettingsService.load()`, `ExportView`, `PipelinePreview` (~25 catch blocks)

### Strategy 4: Fire-and-Forget (`safeSave`)

**When**: Background persistence where failure is non-critical. The save will be retried on the next mutation cycle.

```typescript
this.safeSave().catch((err: unknown) => {
  console.warn("[Flowti] Background save failed:", err);
});
```

**Used by**: `IngestionService` ledger save, `TypedStorage` background flushes (~6 catch blocks)

### Rules

1. **Never use empty `catch {}`** — always log or handle
2. **Use `[Flowti]` prefix** in all console messages for filterability
3. **Safe stringification**: `error instanceof Error ? error.message : String(error)`
4. **Domain services**: emit `domain.*.failed` events for operations that UI needs to react to
5. **Infrastructure**: use `ErrorService.handle()` for lifecycle and service-level errors
6. **UI code**: use console + `new Notice()` for user-visible errors

### Decision Matrix

| Layer | Operation Type | Strategy |
|-------|---------------|----------|
| Infrastructure | Lifecycle failures | Domain wrapping |
| Domain service | User-triggered operations | Logged + emitted |
| Domain service | State loading | Console-only (fallback to defaults) |
| Domain service | Background persistence | Fire-and-forget |
| UI | Rendering errors | Console-only |
| UI | User actions (save, delete) | Logged + emitted (via eventBus) |

## Consequences

### Positive

- **Predictable**: New contributors know which pattern to use for each situation
- **Debuggable**: `[Flowti]` prefix makes all errors filterable in console
- **Resilient**: Fire-and-forget for non-critical saves prevents cascading failures
- **Observable**: Domain errors surface to UI via event bus

### Negative

- **4 strategies to learn**: More than a single pattern, requires reading this ADR
- **Convention-based**: Not enforced by linter or types — relies on code review

## Related

- [[ADR-001 EventBus as Communication Backbone]] — error events flow through EventBus
- [[ADR-012 Build Pipeline as Quality Gate]] — catches empty catch blocks via lint
- TD-29: Error handling inconsistency — this ADR addresses the convention gap
