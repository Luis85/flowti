---
type: DecisionNote
adr: ADR-016
title: Real EventBus in Tests (No Mocking)
status: Accepted
date: 2026-01-15
domain: testing
category: Quality
drivers:
  - Test Fidelity
  - Simplicity
  - Confidence
tags:
  - decision
  - testing
  - pattern
---

# ADR-016: Real EventBus in Tests (No Mocking)

## Status

**Accepted** — applied across all 54 test files.

## Context

The EventBus is the backbone of all inter-service communication. Tests need to verify that services correctly emit and react to events. The question is whether to mock the EventBus or use real instances.

### Alternatives Considered

1. **Mock EventBus** (`vi.fn()` for `emit`, `on`, `off`) — verifies calls but not actual behavior
2. **Spy on real EventBus** — hybrid, but still tests implementation details
3. **Real EventBus per test (chosen)** — each test gets a fresh instance via `beforeEach()`

## Decision

Tests use **real `EventBus` instances**, not mocks. Each test creates a fresh instance to prevent listener leakage:

```typescript
let eventBus: IEventBus;

beforeEach(() => {
  eventBus = new EventBus();
  service = new SomeService({ eventBus, storage: mockStorage });
});
```

### Key Patterns

- **Assert on emitted events**: `eventBus.on("event", spy)` + verify `spy` was called with expected payload
- **Trigger via emit**: `await eventBus.emit("command", payload)` to test service reactions
- **Isolation**: Fresh EventBus per test prevents wildcard listeners from leaking between tests
- **Mock storage**: Only `IStorageProvider` is mocked (via `vi.fn()`), not the EventBus

### What IS Mocked

| Dependency | Mock Strategy | Why |
|------------|---------------|-----|
| `IStorageProvider` | `vi.fn()` for `load`/`save` | Avoid actual file I/O |
| Obsidian API | `obsidian-stub.ts` polyfills | No Obsidian runtime in tests |
| `SubscriptionManagerModal` | `vi.mock()` class replacement | Modal constructor needs DOM |
| Timers | `vi.useFakeTimers()` | Deterministic time control |

## Consequences

### Positive

- **High fidelity**: Tests exercise the actual pub/sub mechanism, not a mock
- **Catches real bugs**: Event ordering, wildcard behavior, and listener cleanup are all tested
- **Simple setup**: `new EventBus()` is trivial — no mock configuration needed

### Negative

- **Leaked listeners**: If `beforeEach` doesn't create a fresh EventBus, wildcard listeners leak between tests — discovered and documented as a gotcha
- **Factory functions required**: `DEFAULT_STATE` must use factory functions (not shared objects) to prevent mutation bleed

## Related

- [[Testplan and Teststrategy]] — Test Isolation section
- [[ADR-012 Build Pipeline as Quality Gate]]
