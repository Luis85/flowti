---
type: TechDebt
stage: open
domain: infrastructure
severity: medium
source: "[[Cycle 34 - Inventory Discovery & Dashboard Integration]]"
related:
  - "[[TD-100 Session Performance Investigation]]"
  - "[[TD-126 CSV utilities scattered across domains]]"
---

# TD-127: Performance Observability for Growing State

## Problem

`data.json` grows with every new domain that persists state (settings, subscriptions, event definitions, inbox, sessions, analytics queries, dashboards, templates). Currently there is **no instrumentation** to measure:

1. **Load time** — how long does `TypedStorage.load()` take as `data.json` grows?
2. **Save time** — how long does each `storage.save()` call take?
3. **Parse overhead** — JSON parse/stringify cost at current and projected sizes
4. **Domain startup** — how long does each service's `.load()` take in `onLayoutReady()`?
5. **Query execution** — `AnalyticsEngine.run()` timing is tracked per-query but not emitted as events

Without measurement, we cannot know when lazy loading or state splitting becomes necessary. Premature optimization risks adding complexity for no proven gain; missing the threshold risks user-perceptible lag.

### Current state persistence

| Domain | Storage Key | Growth Pattern |
|--------|------------|----------------|
| Settings | `settings` | Static — user preferences, rarely changes |
| Subscriptions | `subscriptions` | Grows with event subscriptions |
| Event Definitions | `eventDefinitions` | Grows with definitions |
| Inbox | `inbox` | Capped at MAX_INBOX_ITEMS (500) |
| Session | `session` | Grows with sessions (reflections, tasks, artifacts) |
| Analytics | `analytics` | Grows with queries, dashboards, templates |
| Signal | `signal` | Grows with sync history |

### What we lack

- No `perf.*` events in the event system for storage operations
- No startup timing breakdown (which service takes longest to load?)
- No `data.json` size tracking over time
- No alerting threshold ("warn when load takes >100ms")

## Proposed Fix

### Phase 1: Performance Events (measure first)

Add lightweight timing instrumentation via the existing EventBus. New event category: `"Performance"` (hidden by default via `["system"]` tag).

**Events to add:**

```typescript
interface PerformanceEventMap {
  "perf.storage.loaded": { key: string; durationMs: number; sizeBytes: number };
  "perf.storage.saved": { key: string; durationMs: number; sizeBytes: number };
  "perf.startup.service": { service: string; durationMs: number };
  "perf.startup.total": { durationMs: number; serviceCount: number };
  "perf.query.executed": { queryId?: string; durationMs: number; sourceRows: number; resultRows: number };
}
```

**Implementation:**
- Wrap `TypedStorage.load()` and `.save()` with `performance.now()` timing
- Wrap each service `.load()` call in `onLayoutReady()` with timing
- Emit `perf.query.executed` from `AnalyticsService.runQuery()` (timing already tracked, just needs event emission)
- All events tagged `["system"]` — hidden in Event Catalog by default, visible when `showSystemEvents` is enabled

**Effort:** ~40 LOC in `TypedStorage`, ~20 LOC in `main.ts` startup, ~5 LOC in `AnalyticsService`

### Phase 2: Performance Dashboard (visualize)

Once Phase 1 events flow, build a "Performance" analytics dashboard:
- Storage load/save times over sessions
- Startup breakdown by service
- `data.json` size trend
- Query execution time distribution

This uses the existing Analytics Hub — no new UI code, just saved queries on perf event data.

### Phase 3: Lazy Loading (optimize — only if data proves need)

Potential optimizations to consider **only after Phase 1 data shows a bottleneck**:
- **Split storage** — separate `TypedStorage` instances per domain (load only what's needed)
- **Lazy domain loading** — defer analytics/session state loading until first hub open
- **State pruning** — archive old sessions, compact analytics query history
- **Incremental save** — save only changed domain state, not full `data.json`

## Impact

- **User experience**: As vaults mature, startup lag becomes noticeable but invisible without metrics
- **Decision quality**: Without data, optimization efforts are guesswork
- **Proactive**: Catching degradation before users report it

## References

- TD-100: Session Performance Investigation — resolved render debounce but didn't address storage growth
- `src/infrastructure/services/TypedStorage.ts` — current load/save implementation
- `src/main.ts` `onLayoutReady()` — service startup sequence
- EventBus wildcard listener already skips `log.*` — would also need to skip `perf.*` if trace becomes noisy
