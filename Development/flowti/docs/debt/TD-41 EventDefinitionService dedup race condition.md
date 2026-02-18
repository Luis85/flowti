---
type: TechDebt
status: resolved
severity: medium
category: concurrency
layer: domain
created: 2026-02-15
updated: 2026-02-15
effort: none
description: EventDefinitionService "once" emission policy was analyzed for a TOCTOU race — investigation found the code is already correct.
source: "[[Technical Review 2026-02-15]]"
---
# TD-41: EventDefinitionService dedup race condition

## Original Concern

The initial review identified a potential TOCTOU (time-of-check-to-time-of-use) race in the "once" emission policy of `EventDefinitionService.matchDefinitions()`.

## Resolution: False Positive

Detailed code analysis confirmed the race **cannot occur**:

1. **`extractPayload()` is synchronous** — a pure function performing regex matching and property lookup. There is no async window.

2. **`addToEmittedKeys()` is called BEFORE extraction** — at line 233, before `extractPayload()` at line 237. The key is optimistically reserved.

3. **`matchDefinitions()` itself is synchronous** — called from the event handler without `await`. In JavaScript's single-threaded execution model, a synchronous function cannot be interrupted by another synchronous function.

4. **The only async operations are fire-and-forget emits** — `void this.eventBus?.emitCustom(...)` and `void this.saveState()` at lines 238-248. These run after the key is already in the Set.

The code order is already correct:
```
Line 232: if (this.emittedKeys.has(emitKey)) continue;  // CHECK
Line 233: this.addToEmittedKeys(emitKey);                // ADD (before extraction)
Line 237: const extracted = extractPayload(...);          // EXTRACT (sync)
Line 238: void this.eventBus?.emitCustom(...);            // EMIT (fire-and-forget)
```

No code changes required.

## Affected Files

- `src/domain/eventDefinition/EventDefinitionService.ts` (no changes needed)
