# Make — Bulk-select on instances Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Select" mode to `MakeTypeInstances.vue` that lets a user select multiple instance rows and bulk-delete them, with a partial-result Retry dialog on failure and proper cross-action serialization with `updateType` (folder moves).

**Architecture:** A new shared `per-type-queue.ts` util is extracted from the private `chains` map currently inside `update-type-ops.ts:181-187`. The queue is constructed once in `make-service.ts` and threaded into both `createUpdateTypeOps` and the new bulk-delete code path in `make-service-instances.ts`. The new `service.deleteInstances(typeId, paths)` runs inside that queue, deletes paths sequentially via `ports.vault.delete`, returns a structured `BulkDeleteReport` (`{deletedPaths, failures}`), and emits ONE `make:instances-deleted-batch` event regardless of size. The store gains a `bulkDeleting: shallowRef<ReadonlySet<TypeId>>` UI guard plus a `bulkDeleteInstances` action; the page owns selection state, the select-mode toggle, the toolbar, and reuses the existing `ConfirmDialog` component for both the destructive confirm and the partial-result Retry dialog.

**Tech Stack:** TypeScript (ES2022, NodeNext, strict), Vue 3 + Pinia + vue-i18n, Vitest (`forks` pool, two projects: `unit` + `storybook`), ESLint (architecture rules), Obsidian Plugin SDK. Tabs-4 indentation, kebab-case filenames, `.js` import extensions (ESM), no `any` / `@ts-ignore` / TODO comments.

**Spec:** `01 - Projects/Agentonomous/docs/specs/2026-04-19-make-bulk-select-instances-design.md` (the authoritative design — refer to it for rationale on any decision below).

**Working directory for all commands:** `cd "01 - Projects/Agentonomous"` from git root `c:\Projects\flowti`. Git commands run from git root using full paths.

**Test invocation convention (used throughout):**
- Full green gate (lint + typecheck + unit): `npm test`
- Single test file: `npx vitest run <path> --project unit`
- Lint only: `npm run lint`
- Typecheck only: `npm run typecheck`
- Storybook smoke: `npx vitest run --project storybook` (browser-based, may flake on Windows; not a blocker)

**TDD discipline** (from `superpowers:test-driven-development`): write the failing test before the implementation. Run it. See it fail. Then implement. Run again. See it pass. Commit. No exceptions unless a step explicitly says "no new behavior — refactor only."

**Commit convention (matches recent Polish commits):** `<type>(agentonomous): <subject> (Polish P1 #N)`. The Polish numbering for this work continues from #11 (storybook coverage, already shipped). Suggested numbering: this whole feature is Polish P1 #13 (one umbrella issue) with each commit referencing it. If you'd rather use sub-numbers (#13.1, #13.2…), pick one convention and stick with it.

---

## Chunk 0: Preflight

One-time verification that the repository is on the documented baseline before any work begins.

### Task 0: Verify green baseline

**Files:** none (verification only).

- [ ] **Step 0.1: Confirm working tree clean and at the spec's tip commit (or a descendant)**

Run from git root `c:\Projects\flowti`:
```bash
git status
git log --oneline -3
```
Expected: `nothing to commit, working tree clean` (the `.claude/scheduled_tasks.lock` untracked file is fine — runtime artifact). The current `HEAD` should be `9bc38e9b` (`docs(agentonomous): clarify per-type-queue lifetime in bulk-select spec`) or a descendant that has not modified any of:
- `src/modules/make/**`
- `src/ui/pages/make/**` or `src/ui/components/make/**` or `src/ui/stores/make-store.ts`
- the spec at `docs/specs/2026-04-19-make-bulk-select-instances-design.md`

If newer commits touched any of those paths, stop and re-read the spec before proceeding — the line numbers and code snippets cited below may be stale.

- [ ] **Step 0.2: Run the full test suite from the Agentonomous project**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected tail (numbers from this session's verification):
```
 Test Files  102 passed (102)
      Tests  963 passed (963)
```
Lint: 0 errors (~30 pre-existing style warnings are acceptable — do not fix them in this work). Typecheck: clean.

- [ ] **Step 0.3: Snapshot the baseline numbers**

Note these for verification at the end of every chunk:
- Test files: 102 baseline
- Tests: 963 baseline
- Lint errors: 0 (must remain 0)

Per-chunk endpoints (cumulative test counts after each chunk's commits — verify at the end of each chunk):

| End of chunk | Files | Tests | Notes |
|---|---|---|---|
| Chunk 0 | 102 | 963 | Baseline. |
| Chunk 1 | 103 | 969 | +1 file (`per-type-queue.test.ts`), +5 from Task 1.1, +1 from Task 1.2.8. |
| Chunk 2 | 104 | 971 | +1 file (`tests/domain/make/types.test.ts` — new), +2 tests (BulkDeleteReport shape + onInstancesDeletedBatch wire). |
| Chunk 3 | 105 | 976 | +1 file (`make-service-instances-bulk-delete.test.ts`), +5 tests. |
| Chunk 4 | 105 | 983 | 0 new files (extends `make-store.test.ts`), +7 tests (6 action + 1 subscription). |
| Chunk 5 | 105 | 990 | 0 new files (extends `MakeTypeInstances.test.ts`), +7 tests (select-mode foundation). |

If at any chunk-end the count is below the table or lint errors > 0, stop and diagnose before proceeding.

---

## Chunk 1: Per-type queue extraction

Extract the per-`typeId` promise queue from `update-type-ops.ts` into a shared util that can be consumed by both `createUpdateTypeOps` and the new bulk-delete path. **Pure refactor** — no observable behavior change for any existing caller.

This chunk delivers two commits:
1. New `per-type-queue.ts` util + tests (no consumers yet).
2. `update-type-ops.ts` refactor: consume the injected queue + thread it through from `make-service.ts` → `make-service-types.ts`.

### Task 1.1: Create `per-type-queue.ts` util + tests

**Files:**
- Create: `src/modules/make/per-type-queue.ts`
- Create: `tests/modules/make/per-type-queue.test.ts`

- [ ] **Step 1.1.1: Write the failing test file**

Create `tests/modules/make/per-type-queue.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { createPerTypeQueue } from '../../../src/modules/make/per-type-queue.js';

describe('createPerTypeQueue', () => {
	it('runs work and returns its result', async () => {
		const q = createPerTypeQueue();
		const out = await q.enqueue('t1', async () => 42);
		expect(out).toBe(42);
	});

	it('serializes two enqueues for the same typeId (FIFO)', async () => {
		const q = createPerTypeQueue();
		const order: string[] = [];
		const a = q.enqueue('t1', async () => {
			await new Promise((r) => setTimeout(r, 30));
			order.push('a');
			return 'a';
		});
		const b = q.enqueue('t1', async () => {
			order.push('b');
			return 'b';
		});
		await Promise.all([a, b]);
		expect(order).toEqual(['a', 'b']);
	});

	it('runs enqueues for different typeIds concurrently', async () => {
		const q = createPerTypeQueue();
		const order: string[] = [];
		const a = q.enqueue('t1', async () => {
			await new Promise((r) => setTimeout(r, 30));
			order.push('a');
		});
		const b = q.enqueue('t2', async () => {
			order.push('b');
		});
		await Promise.all([a, b]);
		// b finished first because it did not wait for a.
		expect(order).toEqual(['b', 'a']);
	});

	it('does not break the chain when a prior work rejects', async () => {
		const q = createPerTypeQueue();
		const a = q.enqueue('t1', async () => { throw new Error('boom'); });
		await expect(a).rejects.toThrow('boom');
		const b = await q.enqueue('t1', async () => 'ok-after-reject');
		expect(b).toBe('ok-after-reject');
	});

	it('propagates synchronous throws inside work as rejections', async () => {
		const q = createPerTypeQueue();
		const a = q.enqueue('t1', () => { throw new Error('sync'); });
		await expect(a).rejects.toThrow('sync');
	});
});
```

- [ ] **Step 1.1.2: Run test to verify it fails (file does not exist yet)**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/per-type-queue.test.ts --project unit
```
Expected: FAIL with module-resolution error (`Cannot find module '...per-type-queue.js'`).

- [ ] **Step 1.1.3: Create the implementation**

Create `src/modules/make/per-type-queue.ts` with:

```ts
export interface PerTypeQueue {
	enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T>;
}

export function createPerTypeQueue(): PerTypeQueue {
	const chains = new Map<string, Promise<unknown>>();
	return {
		enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T> {
			const previous = chains.get(typeId) ?? Promise.resolve();
			const current  = previous.then(work);
			chains.set(typeId, current.catch(() => undefined));
			return current;
		},
	};
}
```

This is a verbatim lift of the closure-private `chains`/`enqueue` at `update-type-ops.ts:181-187`, exposed behind a typed factory.

- [ ] **Step 1.1.4: Run test to verify it passes**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/per-type-queue.test.ts --project unit
```
Expected: 5 tests pass.

- [ ] **Step 1.1.5: Run the full gate to ensure nothing else regressed**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected tail: `Test Files 103 passed (103)` (102 baseline + this new file), `Tests 968 passed (968)` (963 + 5). Lint: 0 errors.

- [ ] **Step 1.1.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/make/per-type-queue.ts" "01 - Projects/Agentonomous/tests/modules/make/per-type-queue.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): per-type-queue util — extract chains map for shared use (Polish P1 #13)

Lifts the closure-private per-typeId promise queue from update-type-ops.ts into
a shared util so the upcoming deleteInstances path can serialize against
updateType / retryFailedMoves on the same typeId. No consumers yet — pure
addition. The existing chains map in update-type-ops.ts is replaced in the
next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: Refactor `update-type-ops.ts` to consume the injected queue

**Files:**
- Modify: `src/modules/make/update-type-ops.ts` (lines 14–25 deps interface; lines 181–203 chains/enqueue/return)
- Modify: `src/modules/make/make-service-types.ts` (around line 194 — `createUpdateTypeOps` call site)
- Modify: `src/modules/make/make-service.ts` (lines 30–57 — service composition root)
- Modify: any existing tests that construct `createUpdateTypeOps` directly (find with `grep -rln "createUpdateTypeOps" tests/`)

- [ ] **Step 1.2.1: Confirm the only call sites are the production ones**

```bash
cd "01 - Projects/Agentonomous" && grep -rn "createUpdateTypeOps\|createTypeOps\|createInstanceOps" src/ tests/
```

Expected — exactly four results, all in `src/`:
- `src/modules/make/make-service-types.ts:17` (import of `createUpdateTypeOps`) and `:194` (call)
- `src/modules/make/make-service.ts:38` — `createTypeOps` call
- `src/modules/make/make-service.ts:44` — `createInstanceOps` call

**Tests do NOT construct these factories directly** — they all go through `createMakeService` (verify by `grep` returning zero `tests/` matches). This means no test files will need editing for the queue parameter; the seam is added entirely in `src/`. If for any reason `grep` returns a `tests/` match, treat it as new context and add the queue arg there too.

- [ ] **Step 1.2.2: Add `queue` to `UpdateTypeOpsDeps` and consume it (no behavior change)**

Edit `src/modules/make/update-type-ops.ts`:

1. Add to the imports section near the top:
```ts
import type { PerTypeQueue } from './per-type-queue.js';
```

2. Extend the `UpdateTypeOpsDeps` interface (currently lines 14–25) by adding a `queue` field:
```ts
export interface UpdateTypeOpsDeps {
	readonly ports: ModulePorts;
	readonly getSettings: () => MakeSettings;
	readonly peers: TypeOpsPeers;
	readonly loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
	readonly listTypes: () => Promise<Result<ListTypesResult, MakeError>>;
	readonly validateSchema: (schema: {
		readonly name: string;
		readonly instancesFolder: string;
		readonly fields: readonly Field[];
	}) => SchemaError[];
	readonly queue: PerTypeQueue;
}
```

3. Destructure `queue` from `deps` (line 43):
```ts
const { ports, getSettings, peers, loadType, listTypes, validateSchema, queue } = deps;
```

4. Replace the closure-private chains/enqueue (lines 177–187) with a comment + delegation. Delete:
```ts
// Per-typeId serialization. ...
const chains = new Map<string, Promise<unknown>>();
function enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T> {
	const previous = chains.get(typeId) ?? Promise.resolve();
	const current = previous.then(work);
	chains.set(typeId, current.catch(() => undefined));
	return current;
}
```

5. Update `updateType` and `retryFailedMoves` (lines 189–201) to call `queue.enqueue` instead of the local `enqueue`:
```ts
function updateType(
	typeId: string,
	changes: TypeSchemaPatch,
	options: UpdateTypeOptions = {},
): Promise<Result<UpdateTypeResult, MakeError>> {
	return queue.enqueue(typeId, () => updateTypeImpl(typeId, changes, options));
}

function retryFailedMoves(
	typeId: string, failedPaths: readonly string[],
): Promise<Result<MoveReport, MakeError>> {
	return queue.enqueue(typeId, () => retryFailedMovesImpl(typeId, failedPaths));
}
```

- [ ] **Step 1.2.3: Update the `createUpdateTypeOps` call site in `make-service-types.ts`**

Find the call (around line 194):
```ts
const { updateType, retryFailedMoves } = createUpdateTypeOps({
	ports, getSettings, peers, loadType, listTypes, validateSchema,
});
```

`createTypeOps` will need to accept and forward a `queue` parameter. Edit the `createTypeOps` signature in `make-service-types.ts`:

```ts
export function createTypeOps(
	ports: ModulePorts,
	getSettings: () => MakeSettings,
	peers: TypeOpsPeers,
	queue: PerTypeQueue,
): TypeServiceMethods {
```

…and add the import at the top of the file:
```ts
import type { PerTypeQueue } from './per-type-queue.js';
```

…and pass `queue` through to `createUpdateTypeOps`:
```ts
const { updateType, retryFailedMoves } = createUpdateTypeOps({
	ports, getSettings, peers, loadType, listTypes, validateSchema, queue,
});
```

- [ ] **Step 1.2.4: Add an optional queue-injection seam to `createMakeService`, construct the queue, thread it through**

Edit `src/modules/make/make-service.ts`:

1. Add imports at the top:
```ts
import { createPerTypeQueue, type PerTypeQueue } from './per-type-queue.js';
```

2. Extend the `createMakeService` signature with an optional 3rd param so tests can inject and observe queue ordering (default behavior unchanged for production):
```ts
export function createMakeService(
	ports: ModulePorts,
	getSettings: () => MakeSettings,
	queueOverride?: PerTypeQueue,
): MakeService {
```

3. Inside the body, before the `createTypeOps` call, resolve the queue:
```ts
const queue = queueOverride ?? createPerTypeQueue();
```

4. Update the `createTypeOps` call (line 38) to pass `queue` as the 4th arg:
```ts
const types = createTypeOps(ports, getSettings, {
	listInstances: (typeId) => instancesRef.current!.listInstances(typeId),
	listInstancesInFolder: (folder, typeId) => instancesRef.current!.listInstancesInFolder(folder, typeId),
}, queue);
```

(Note: leave `createInstanceOps` untouched in this chunk — the queue is added to the instances factory in Chunk 3.)

- [ ] **Step 1.2.5: (Skipped if Step 1.2.1 returned zero `tests/` matches.)** No tests construct `UpdateTypeOpsDeps` directly today, so no test files need editing for the queue parameter. If `grep` from Step 1.2.1 surprised you with new matches, add `queue: createPerTypeQueue()` to each deps literal.

- [ ] **Step 1.2.6: Run typecheck first to surface every remaining wiring gap**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck
```
Expected: clean. If errors, the most likely cause is a test file that constructs `UpdateTypeOpsDeps` directly and was missed in Step 1.2.5 — fix and re-run.

- [ ] **Step 1.2.7: Run the full test gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected tail: `Test Files 103 passed (103)`, `Tests 968 passed (968)`. Lint: 0 errors. The existing `update-type-ops` serialization tests should continue to pass — they're now exercising the same logic via the injected queue, which is the proof the refactor is behavior-preserving.

- [ ] **Step 1.2.8: Add a service-level cross-action serialization test through the public surface**

Add a test to `tests/modules/make/make-service.test.ts` (the existing serialization tests for `updateType` live there; verify with `grep -n "updateType\|serialization\|chains" tests/modules/make/make-service.test.ts | head -10`).

The injected-queue seam from Step 1.2.4 makes this test possible without reaching into private state:

```ts
import { createPerTypeQueue } from '../../../src/modules/make/per-type-queue.js';

it('shared per-type-queue: an external enqueue on the same typeId FIFO-waits behind in-flight updateType', async () => {
	// This guards the contract that the queue is shared — the upcoming
	// deleteInstances (Chunk 3) will FIFO behind updateType for the same typeId.
	const queue = createPerTypeQueue();
	// Build a service with the test's queue injected (Step 1.2.4 added the optional 3rd arg).
	const vault = fakeVault({ /* whatever the existing slow-updateType test uses to make the
	                            update path observable; commonly: pre-seed a type file so
	                            updateType has to read+rewrite it */ });
	const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS, queue);
	const order: string[] = [];

	// Pre-seed whatever state updateType needs to do real work for typeId 'book'.
	// (Mirror the setup from the closest existing updateType test in this file.)

	const updatePromise = svc.updateType('book', { /* a no-op-ish patch is fine */ }).then(() => order.push('updateType'));
	const externalPromise = queue.enqueue('book', async () => { order.push('external'); });
	await Promise.all([updatePromise, externalPromise]);

	expect(order).toEqual(['updateType', 'external']);
});
```

If pre-seeding for a real `updateType` call is heavy, the simpler alternative is to call two `queue.enqueue('book', ...)` directly with `await Promise.all` and assert FIFO — that proves the queue contract without exercising `updateType`. Pick whichever fits the existing test style. The point of this test is to lock in the **shared-queue contract**, not to re-test `updateType`.

- [ ] **Step 1.2.9: Re-run the full test gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Tests 969 passed (969)` (the +1 from Step 1.2.8). Lint: 0.

- [ ] **Step 1.2.10: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/make/update-type-ops.ts" "01 - Projects/Agentonomous/src/modules/make/make-service-types.ts" "01 - Projects/Agentonomous/src/modules/make/make-service.ts" "01 - Projects/Agentonomous/tests/modules/make/make-service.test.ts"
git commit -m "$(cat <<'EOF'
refactor(agentonomous): inject PerTypeQueue into createUpdateTypeOps (Polish P1 #13)

update-type-ops.ts now consumes a shared per-type-queue instead of constructing
its own chains map. The queue is constructed once in make-service.ts and threaded
through createTypeOps. Existing updateType / retryFailedMoves serialization
behavior is preserved (verified by the existing test suite); a new
cross-action test asserts that external enqueues on the same shared queue
FIFO behind in-flight updateType — the prerequisite for Chunk 3's bulk
delete to share serialization with folder moves.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Domain types + event map + handler wiring

Ship the typed surface for the new bulk-delete operation: a `BulkDeleteReport` type, a new `make:instances-deleted-batch` event, and the matching `MakeEventHandlers` entry + `subscribe()` wire. **No runtime emitters or consumers yet** — those land in Chunks 3 and 4. This chunk is purely additive type/wiring scaffolding so the next two chunks can each be self-contained.

### Task 2.1: Add `BulkDeleteReport` to domain types

**Files:**
- Modify: `src/domain/make/types.ts`

- [ ] **Step 2.1.1: Locate the existing `MoveReport` declaration as a layout reference**

```bash
cd "01 - Projects/Agentonomous" && grep -n "MoveReport\|FailedMove\|FailedDelete" src/domain/make/types.ts
```

Expected: `MoveReport` is the structural sibling for the new `BulkDeleteReport` — same `report` shape (a list of successes + a list of failures with a `path` and an error string).

- [ ] **Step 2.1.2: Write the failing test**

Add a new test file `tests/domain/make/types.test.ts` (or, if one exists, append to it — check first with `ls tests/domain/make/types.test.ts`). The test verifies the type exists and has the expected shape via a structural assertion:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { BulkDeleteReport } from '../../../src/domain/make/types.js';

describe('BulkDeleteReport', () => {
	it('is shaped { deletedPaths, failures: {path, error} }', () => {
		expectTypeOf<BulkDeleteReport>().toEqualTypeOf<{
			readonly deletedPaths: readonly string[];
			readonly failures: ReadonlyArray<{ readonly path: string; readonly error: string }>;
		}>();
	});
});
```

(If the project doesn't already use `expectTypeOf`, fall back to a runtime test that constructs an example value and asserts shape with `expect(typeof report.deletedPaths[0]).toBe('string')` etc. — pick whatever pattern other domain-type tests use; check `tests/domain/make/instance-ops.test.ts` for precedent.)

- [ ] **Step 2.1.3: Run test to verify it fails**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/domain/make/types.test.ts --project unit
```
Expected: FAIL with "module has no exported member 'BulkDeleteReport'".

- [ ] **Step 2.1.4: Add the type**

Edit `src/domain/make/types.ts`. Find the `MoveReport` / `FailedMove` block as a placement anchor and add nearby:

```ts
export type BulkDeleteFailure = {
	readonly path:  string;
	readonly error: string;
};

export type BulkDeleteReport = {
	readonly deletedPaths: readonly string[];
	readonly failures:     readonly BulkDeleteFailure[];
};
```

- [ ] **Step 2.1.5: Run test to verify it passes + run typecheck**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/domain/make/types.test.ts --project unit && npm run typecheck
```
Expected: PASS, typecheck clean.

### Task 2.2: Add `make:instances-deleted-batch` to the event map

**Files:**
- Modify: `src/modules/make/make-events.ts`

- [ ] **Step 2.2.1: Add the event declaration**

Edit `src/modules/make/make-events.ts`. Inside the `interface EventMap` augmentation block (currently at lines 6–20), add the new event next to the existing `make:instance-deleted` and `make:orphan-deleted` entries (lines 11–14):

```ts
'make:instance-deleted':         { readonly typeId: TypeId; readonly path: string };
/** Fired when a file was deleted via deleteInstance but its folder does not
 *  match any registered type (orphan from a prior type rename/delete). */
'make:orphan-deleted':           { readonly path: string };
/** Fired ONCE by service.deleteInstances regardless of how many paths were
 *  deleted. The store consumer triggers a single loadInstances refresh. */
'make:instances-deleted-batch':  { readonly typeId: TypeId } & BulkDeleteReport;
```

Add the `BulkDeleteReport` import at the top of the file:
```ts
import type { BulkDeleteReport, MoveReport, TypeId } from '../../domain/make/types.js';
```

The intersection form (`{ readonly typeId: TypeId } & BulkDeleteReport`) keeps `BulkDeleteReport` as the single source of truth — if its shape ever changes, the event payload follows automatically.

- [ ] **Step 2.2.2: Run typecheck (no behavior to test yet)**

```bash
cd "01 - Projects/Agentonomous" && npm run typecheck
```
Expected: clean. The augmentation is type-only — no test required at this step.

### Task 2.3: Add `onInstancesDeletedBatch` to `MakeEventHandlers` + subscribe wire

**Files:**
- Modify: `src/modules/make/make-module.ts` (lines 21–48)

- [ ] **Step 2.3.1: Extend the `MakeEventHandlers` type**

Edit `src/modules/make/make-module.ts`. Inside the `MakeEventHandlers` type (currently lines 21–32), add a new optional field next to the existing `onInstanceDeleted` and `onOrphanDeleted` entries:

```ts
readonly onInstanceDeleted?:        (payload: EventMap['make:instance-deleted']) => void;
readonly onOrphanDeleted?:          (payload: EventMap['make:orphan-deleted']) => void;
readonly onInstancesDeletedBatch?:  (payload: EventMap['make:instances-deleted-batch']) => void;
```

- [ ] **Step 2.3.2: Wire the new handler in `subscribe()`**

In the same file, inside the `subscribe()` function body (currently lines 34–49), add a new conditional `bus.on(...)` next to the existing `make:instance-deleted` / `make:orphan-deleted` wires:

```ts
if (handlers.onInstanceDeleted)        unsubs.push(bus.on('make:instance-deleted',         (e) => { handlers.onInstanceDeleted!(e.payload); }));
if (handlers.onOrphanDeleted)          unsubs.push(bus.on('make:orphan-deleted',           (e) => { handlers.onOrphanDeleted!(e.payload); }));
if (handlers.onInstancesDeletedBatch)  unsubs.push(bus.on('make:instances-deleted-batch',  (e) => { handlers.onInstancesDeletedBatch!(e.payload); }));
```

- [ ] **Step 2.3.3: Add a wiring test to the existing `getMakeModuleState subscribe` describe block**

Append to `tests/modules/make/make-module.test.ts` inside the existing `describe('getMakeModuleState subscribe', ...)` block (starts at line 111). Mirror the existing `onTypeCreated` and "subscribes to multiple channels independently" tests (lines 113–145) for setup. Add:

```ts
it('invokes onInstancesDeletedBatch when make:instances-deleted-batch is emitted', async () => {
	// Use the same setup the surrounding tests use: fakeModulePorts({ eventBus: createEventBus() })
	// + MakeModule.init(...) + getMakeModuleState() + moduleState!.subscribe({ ... }).
	const calls: Array<{ typeId: string; deletedPaths: readonly string[]; failures: readonly { path: string; error: string }[] }> = [];
	const unsubscribe = moduleState!.subscribe({
		onInstancesDeletedBatch: (payload) => { calls.push(payload); },
	});
	ports.eventBus.emit('make:instances-deleted-batch', {
		typeId: 'book',
		deletedPaths: ['Books/Dune.md'],
		failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
	});
	expect(calls).toEqual([{
		typeId: 'book',
		deletedPaths: ['Books/Dune.md'],
		failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
	}]);
	unsubscribe();
});
```

(Use whatever variable names the surrounding tests use for `ports` and `moduleState` — typically these are set up in a `beforeEach` at the top of the describe block. Check lines 111–155 to copy the pattern exactly.)

- [ ] **Step 2.3.4: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files` increased by the count of new files in this chunk; `Tests` increased by the count of new tests; lint 0 errors; typecheck clean.

- [ ] **Step 2.3.5: Commit**

```bash
git add "01 - Projects/Agentonomous/src/domain/make/types.ts" "01 - Projects/Agentonomous/src/modules/make/make-events.ts" "01 - Projects/Agentonomous/src/modules/make/make-module.ts" "01 - Projects/Agentonomous/tests/domain/make/types.test.ts" "01 - Projects/Agentonomous/tests/modules/make/make-module.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): typed surface for make:instances-deleted-batch (Polish P1 #13)

Adds BulkDeleteReport type, the make:instances-deleted-batch event in the
EventMap augmentation, and the matching onInstancesDeletedBatch entry in
MakeEventHandlers + subscribe(). No emitters or consumers yet — purely
additive type/wiring scaffolding for Chunks 3 and 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: Service-layer `deleteInstances`

Implement the actual bulk-delete operation in `make-service-instances.ts`, enqueued through the shared per-type-queue, returning a `BulkDeleteReport`, and emitting one `make:instances-deleted-batch` event.

### Task 3.1: Thread the queue into `createInstanceOps`

**Files:**
- Modify: `src/modules/make/make-service-instances.ts` (signature of `createInstanceOps`)
- Modify: `src/modules/make/make-service.ts` (the `createInstanceOps` call at line 44)
- Modify: any tests that construct `createInstanceOps` directly

- [ ] **Step 3.1.1: Confirm only the production call site touches `createInstanceOps`**

```bash
cd "01 - Projects/Agentonomous" && grep -rn "createInstanceOps" src/ tests/
```

Expected — exactly two results in `src/`: `make-service.ts:11` (import) and `:44` (call). **Zero `tests/` matches** (tests use `createMakeService` end-to-end). If `grep` surprises you, treat any test match as new context.

- [ ] **Step 3.1.2: Add `_queue` to the factory signature (underscored — it's consumed in Task 3.2)**

Edit `src/modules/make/make-service-instances.ts`. Add the import at the top:
```ts
import type { PerTypeQueue } from './per-type-queue.js';
```

Extend the factory signature (currently `createInstanceOps(ports, _getSettings, peers)` at line 39). The `queue` parameter is added underscored because it is unused until Task 3.2 — the project's ESLint config sets `@typescript-eslint/no-unused-vars` to **`error`** with `argsIgnorePattern: '^_'`, so an unprefixed unused parameter would fail the lint gate.

```ts
export function createInstanceOps(
	ports: ModulePorts,
	_getSettings: () => MakeSettings,
	peers: InstanceOpsPeers,
	_queue: PerTypeQueue,
): InstanceOpsInternal {
```

The underscore is dropped in Task 3.2.3 Step 3 when `deleteInstances` references `queue`.

- [ ] **Step 3.1.3: Update the call site in `make-service.ts`**

Edit `src/modules/make/make-service.ts` line 44:
```ts
const instances = createInstanceOps(ports, getSettings, {
	loadType:  (typeId) => typesRef.current!.loadType(typeId),
	listTypes: () => typesRef.current!.listTypes(),
}, queue);
```

(`queue` was constructed in Chunk 1 Step 1.2.4 — reuse the same instance.)

- [ ] **Step 3.1.4: (Skipped if Step 3.1.1 returned zero `tests/` matches.)** No test files instantiate `createInstanceOps` directly today.

- [ ] **Step 3.1.5: Typecheck + full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: green, same test count as end of Chunk 2 (103 / 971). Lint: 0 errors (the underscore prefix on `_queue` keeps it acceptable to `no-unused-vars`).

- [ ] **Step 3.1.6: Do NOT commit yet** — Task 3.2 builds on this and they should ship as one commit. The intermediate state is structurally fine but exposes an unused dep.

### Task 3.2: Implement `deleteInstances` (TDD)

**Files:**
- Modify: `src/modules/make/make-service-instances.ts` (add new function + export from `InstanceServiceMethods` and `InstanceOpsInternal`)
- Modify: `src/modules/make/make-service.ts` (extend `MakeService` interface at lines 14–28; the spread on line 56 already picks up new methods automatically as long as they're returned by `createInstanceOps`)
- Create: `tests/modules/make/make-service-instances-bulk-delete.test.ts` (focused test file for the new method; keeps the existing `make-service-instances.test.ts` from growing too large)

- [ ] **Step 3.2.1: Write the failing tests (5 cases) using the existing fakes pattern**

Create `tests/modules/make/make-service-instances-bulk-delete.test.ts`. The codebase has no `setupModule` helper — the established pattern (see `tests/modules/make/make-service.test.ts`) is `fakeVault({...})` + `fakeModulePorts({vault, eventBus?})` + `createMakeService(ports, () => MAKE_DEFAULTS, queue?)`. We use that directly.

The event-bus assertion pattern: `fakeModulePorts` returns a real `EventBus` by default; capture emissions with `bus.on('channel', listener)` registrations set up in `beforeEach`, OR pass an explicit captured `eventBus` into `fakeModulePorts({ eventBus })`. Confirm the easier path with one line:
```bash
cd "01 - Projects/Agentonomous" && grep -n "eventBus\|createEventBus" tests/__fakes__/fake-ports.ts | head -5
```

Then write the test file:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakeService } from '../../../src/modules/make/make-service.js';
import { createPerTypeQueue } from '../../../src/modules/make/per-type-queue.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts, fakeVault } from '../../__fakes__/fake-ports.js';
import { createEventBus } from '../../../src/domain/shared/event-bus.js'; // adjust if path differs
import type { BulkDeleteReport } from '../../../src/domain/make/types.js';

type CapturedEvent = { channel: string; payload: unknown };

function captureEvents(bus: ReturnType<typeof createEventBus>): CapturedEvent[] {
	const events: CapturedEvent[] = [];
	bus.on('make:instances-deleted-batch', (e) => events.push({ channel: 'make:instances-deleted-batch', payload: e.payload }));
	bus.on('make:instance-deleted',        (e) => events.push({ channel: 'make:instance-deleted',        payload: e.payload }));
	bus.on('make:orphan-deleted',          (e) => events.push({ channel: 'make:orphan-deleted',          payload: e.payload }));
	return events;
}

describe('service.deleteInstances', () => {
	let vault: ReturnType<typeof fakeVault>;
	let bus:   ReturnType<typeof createEventBus>;
	let events: CapturedEvent[];
	let svc:   ReturnType<typeof createMakeService>;

	beforeEach(() => {
		vault = fakeVault();
		bus   = createEventBus();
		events = captureEvents(bus);
		svc   = createMakeService(fakeModulePorts({ vault, eventBus: bus }), () => MAKE_DEFAULTS);
	});

	it('all-success: returns deletedPaths=paths and emits one batch event', async () => {
		// Override vault.delete on the fake (it is a vi.fn, see fake-ports.ts:175).
		vault.delete.mockResolvedValue({ kind: 'ok', value: undefined });
		const paths = ['Books/Dune.md', 'Books/Foundation.md'];
		const result = await svc.deleteInstances('book', paths);
		expect(result).toEqual({ kind: 'ok', value: { deletedPaths: paths, failures: [] } });
		expect(vault.delete).toHaveBeenCalledTimes(2);
		expect(vault.delete).toHaveBeenNthCalledWith(1, 'Books/Dune.md');
		expect(vault.delete).toHaveBeenNthCalledWith(2, 'Books/Foundation.md');
		const batch = events.filter((e) => e.channel === 'make:instances-deleted-batch');
		expect(batch).toHaveLength(1);
		expect(batch[0]!.payload).toEqual({ typeId: 'book', deletedPaths: paths, failures: [] });
		expect(events.some((e) => e.channel === 'make:instance-deleted')).toBe(false);
		expect(events.some((e) => e.channel === 'make:orphan-deleted')).toBe(false);
	});

	it('mixed: collects per-path failures, never short-circuits, still emits one batch event', async () => {
		vault.delete.mockImplementation(async (p: string) =>
			p === 'Books/Foundation.md'
				? { kind: 'err', error: 'locked' }
				: { kind: 'ok', value: undefined },
		);
		const paths = ['Books/Dune.md', 'Books/Foundation.md', 'Books/Neuromancer.md'];
		const result = await svc.deleteInstances('book', paths);
		expect(result.kind).toBe('ok');
		const report = (result as { kind: 'ok'; value: BulkDeleteReport }).value;
		expect(report.deletedPaths).toEqual(['Books/Dune.md', 'Books/Neuromancer.md']);
		expect(report.failures).toEqual([{ path: 'Books/Foundation.md', error: 'locked' }]);
		const batch = events.filter((e) => e.channel === 'make:instances-deleted-batch');
		expect(batch).toHaveLength(1);
		expect(batch[0]!.payload).toEqual({
			typeId: 'book',
			deletedPaths: ['Books/Dune.md', 'Books/Neuromancer.md'],
			failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
		});
	});

	it('empty paths: returns ok with empty arrays and emits NO event', async () => {
		const result = await svc.deleteInstances('book', []);
		expect(result).toEqual({ kind: 'ok', value: { deletedPaths: [], failures: [] } });
		expect(vault.delete).not.toHaveBeenCalled();
		expect(events.some((e) => e.channel === 'make:instances-deleted-batch')).toBe(false);
	});

	it('sequential ordering: vault.delete is called once per path in input order', async () => {
		const order: string[] = [];
		vault.delete.mockImplementation(async (p: string) => { order.push(p); return { kind: 'ok', value: undefined }; });
		await svc.deleteInstances('book', ['a.md', 'b.md', 'c.md']);
		expect(order).toEqual(['a.md', 'b.md', 'c.md']);
	});

	it('runs inside the per-type-queue: a follow-up enqueue on the same typeId waits for the batch to settle', async () => {
		// Inject a queue so the test can enqueue alongside service.deleteInstances.
		const queue = createPerTypeQueue();
		const localVault = fakeVault();
		const localBus   = createEventBus();
		const localSvc   = createMakeService(fakeModulePorts({ vault: localVault, eventBus: localBus }), () => MAKE_DEFAULTS, queue);
		localVault.delete.mockImplementation(async () => {
			await new Promise((r) => setTimeout(r, 30));
			return { kind: 'ok', value: undefined };
		});
		const order: string[] = [];
		const bulk  = localSvc.deleteInstances('book', ['a.md', 'b.md']).then(() => order.push('bulk'));
		const after = queue.enqueue('book', async () => { order.push('after'); });
		await Promise.all([bulk, after]);
		expect(order).toEqual(['bulk', 'after']);
	});
});
```

**Notes on the snippet:**
- `fakeModulePorts({ vault, eventBus })` already accepts an `eventBus` override (see `tests/__fakes__/fake-ports.ts:298`).
- `vault.delete.mockResolvedValue(...)` works because `fake-ports.ts:175` makes `delete` a `vi.fn(async ...)`.
- `createEventBus` is exported from `src/domain/shared/event-bus.ts` (line 35); the `bus.on('channel', listener)` envelope `{ channel, payload, ... }` matches the test snippet's `e.payload` access.

- [ ] **Step 3.2.2: Run tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-service-instances-bulk-delete.test.ts --project unit
```
Expected: 5 FAILs, all because `service.deleteInstances` does not exist.

- [ ] **Step 3.2.3: Implement `deleteInstances`**

Edit `src/modules/make/make-service-instances.ts`:

1. Update the `InstanceServiceMethods` and `InstanceOpsInternal` types (lines 12–16) to include the new method:
```ts
export type InstanceServiceMethods = Pick<MakeService, 'listInstances' | 'createInstance' | 'deleteInstance' | 'deleteInstances'>;

export type InstanceOpsInternal = InstanceServiceMethods & {
	listInstancesInFolder: (folder: string, typeId: string) => Promise<readonly InstanceRef[]>;
};
```

2. Add the `BulkDeleteReport` import:
```ts
import type { BulkDeleteReport, /* …existing imports… */ } from '../../domain/make/types.js';
```

3. Drop the underscore from `_queue` in the factory signature (line 39, set in Step 3.1.2) — it's about to be consumed:
```ts
export function createInstanceOps(
	ports: ModulePorts,
	_getSettings: () => MakeSettings,
	peers: InstanceOpsPeers,
	queue: PerTypeQueue,
): InstanceOpsInternal {
```

4. Add the implementation function inside the factory body (after `deleteInstance`, around line 134):

```ts
async function deleteInstances(
	typeId: string,
	paths: readonly string[],
): Promise<Result<BulkDeleteReport, MakeError>> {
	if (paths.length === 0) return ok({ deletedPaths: [], failures: [] });
	return queue.enqueue(typeId, async () => {
		const deletedPaths: string[] = [];
		const failures:     Array<{ path: string; error: string }> = [];
		for (const path of paths) {
			const r = await ports.vault.delete(path);
			if (r.kind === 'ok') deletedPaths.push(path);
			else failures.push({ path, error: String(r.error) });
		}
		ports.eventBus.emit('make:instances-deleted-batch', { typeId, deletedPaths, failures });
		return ok({ deletedPaths, failures });
	});
}
```

5. Add `deleteInstances` to the returned object (currently lines 136–141):
```ts
return {
	listInstances,
	createInstance,
	deleteInstance,
	deleteInstances,
	listInstancesInFolder,
};
```

6. Edit `src/modules/make/make-service.ts` `MakeService` interface (lines 14–28). Add:
```ts
deleteInstances(typeId: string, paths: readonly string[]): Promise<Result<BulkDeleteReport, MakeError>>;
```

…and add `BulkDeleteReport` to the existing import block (lines 6–9):
```ts
import type {
	BulkDeleteReport, CreateInstanceOptions, DeleteTypeOptions, DeleteTypeReport, InstanceRef, KpiSnapshot, ListTypesResult,
	MoveReport, NewTypeDraft, TypeSchemaPatch, UpdateTypeOptions, UpdateTypeResult,
} from '../../domain/make/types.js';
```

(The spread at line 56 — `return { ...types, ...instancePublic, ...maintenance };` — automatically picks up `deleteInstances` from `instancePublic` because we added it to `InstanceServiceMethods`.)

7. **Update the test fixture** `tests/__fixtures__/fake-make-context.ts`. The `fakeMakeService` factory uses `satisfies MakeService`, so adding a new interface method makes typecheck fail until the fixture provides a default. Add a default override slot (alphabetically with the others, around line 21):
```ts
deleteInstances:     overrides.deleteInstances     ?? (() => Promise.resolve({ kind: 'ok' as const, value: { deletedPaths: [], failures: [] } })),
```

A no-op `ok({deletedPaths:[], failures:[]})` is a safe default — tests that need to assert `deleteInstances` behavior will override it via the overrides arg.

- [ ] **Step 3.2.4: Run the new tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-service-instances-bulk-delete.test.ts --project unit
```
Expected: 5 tests pass.

- [ ] **Step 3.2.5: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: file count +1 (the new bulk-delete test file), test count +5 (vs. end of Chunk 2). Lint: 0 errors.

- [ ] **Step 3.2.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/make/make-service-instances.ts" "01 - Projects/Agentonomous/src/modules/make/make-service.ts" "01 - Projects/Agentonomous/tests/modules/make/make-service-instances-bulk-delete.test.ts" "01 - Projects/Agentonomous/tests/__fixtures__/fake-make-context.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): service.deleteInstances + make:instances-deleted-batch (Polish P1 #13)

New service method deleteInstances(typeId, paths) runs inside the shared
per-type-queue (FIFO with updateType / retryFailedMoves on the same typeId),
deletes paths sequentially via ports.vault.delete, returns a structured
BulkDeleteReport, and emits exactly one make:instances-deleted-batch event
regardless of input size. Empty input is a no-op (no event).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: Store action + subscription

Add the `bulkDeleteInstances` action to `make-store.ts`, plus the `bulkDeleting` state and the `onInstancesDeletedBatch` subscription handler. This chunk is purely the store layer — no UI yet.

### Task 4.1: `bulkDeleting` state + `bulkDeleteInstances` action (TDD)

**Files:**
- Modify: `src/ui/stores/make-store.ts` (add state at lines 99–104; add action near `deleteInstance` at line 167; add to return object at line 261)
- Modify: `tests/ui/stores/make-store.test.ts` (extend with new describe block)

- [ ] **Step 4.1.1: Write the failing tests for the action**

Append a new `describe` block to `tests/ui/stores/make-store.test.ts`. Use the existing `mountStore()` helper at the top of that file (lines 25–47).

```ts
describe('make-store — bulkDeleteInstances', () => {
	const REPORT_SUCCESS = { deletedPaths: ['Books/Dune.md', 'Books/Foundation.md'], failures: [] };
	const REPORT_PARTIAL = {
		deletedPaths: ['Books/Dune.md'],
		failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
	};

	it('returns ok({deletedPaths:[], failures:[]}) and does NOT call the service when paths is empty', async () => {
		const deleteInstances = vi.fn();
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ deleteInstances }),
		}));
		const result = await store.bulkDeleteInstances('book', []);
		expect(result).toEqual({ kind: 'ok', value: { deletedPaths: [], failures: [] } });
		expect(deleteInstances).not.toHaveBeenCalled();
	});

	it('toggles bulkDeleting set around the service call (added before, removed after)', async () => {
		let observedDuringCall: ReadonlySet<string> | null = null;
		const deleteInstances = vi.fn(async (typeId: string, _paths: readonly string[]) => {
			observedDuringCall = new Set(store.bulkDeleting.value);
			return { kind: 'ok' as const, value: REPORT_SUCCESS };
		});
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ deleteInstances }),
		}));
		expect(store.bulkDeleting.value.has('book')).toBe(false);
		await store.bulkDeleteInstances('book', ['Books/Dune.md', 'Books/Foundation.md']);
		expect(observedDuringCall!.has('book')).toBe(true);
		expect(store.bulkDeleting.value.has('book')).toBe(false);
	});

	it('returns err({kind:"busy"}) when a concurrent call is already in flight for the same typeId', async () => {
		// Hold the first call open with a manual promise so we can test concurrent invocation.
		let resolveFirst: ((r: { kind: 'ok'; value: typeof REPORT_SUCCESS }) => void) | null = null;
		const deleteInstances = vi.fn(() => new Promise<{ kind: 'ok'; value: typeof REPORT_SUCCESS }>((r) => { resolveFirst = r; }));
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ deleteInstances: deleteInstances as MakeService['deleteInstances'] }),
		}));
		const first = store.bulkDeleteInstances('book', ['a.md']);
		const second = await store.bulkDeleteInstances('book', ['b.md']);
		expect(second).toEqual({ kind: 'err', error: { kind: 'busy' } });
		expect(deleteInstances).toHaveBeenCalledTimes(1); // second never reached the service
		resolveFirst!({ kind: 'ok', value: REPORT_SUCCESS });
		await first;
	});

	it('passes through the service result on success', async () => {
		const deleteInstances = vi.fn(async () => ({ kind: 'ok' as const, value: REPORT_SUCCESS }));
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ deleteInstances }),
		}));
		const result = await store.bulkDeleteInstances('book', ['Books/Dune.md', 'Books/Foundation.md']);
		expect(result).toEqual({ kind: 'ok', value: REPORT_SUCCESS });
	});

	it('passes through partial-failure results', async () => {
		const deleteInstances = vi.fn(async () => ({ kind: 'ok' as const, value: REPORT_PARTIAL }));
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ deleteInstances }),
		}));
		const result = await store.bulkDeleteInstances('book', ['Books/Dune.md', 'Books/Foundation.md']);
		expect(result).toEqual({ kind: 'ok', value: REPORT_PARTIAL });
	});

	it('clears bulkDeleting even if the service rejects', async () => {
		const deleteInstances = vi.fn(async () => { throw new Error('boom'); });
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ deleteInstances: deleteInstances as MakeService['deleteInstances'] }),
		}));
		await expect(store.bulkDeleteInstances('book', ['a.md'])).rejects.toThrow('boom');
		expect(store.bulkDeleting.value.has('book')).toBe(false);
	});
});
```

You'll need to add `import type { MakeService } from '../../../src/modules/make/make-service.js';` to the test file's imports if it's not already there.

- [ ] **Step 4.1.2: Run the new tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/stores/make-store.test.ts -t "bulkDeleteInstances" --project unit
```
Expected: 6 FAILs, all because `store.bulkDeleteInstances` and `store.bulkDeleting` don't exist.

- [ ] **Step 4.1.3: Add `bulkDeleting` state**

Edit `src/ui/stores/make-store.ts`. Inside the "Write state" block (lines 99–104), add a new shallowRef next to `regeneratingForId` and `favoriteToggling`:

```ts
const savingType                  = ref(false);
const saveError                   = ref<string | null>(null);
const regeneratingForId           = shallowRef<ReadonlySet<TypeId>>(new Set());
const regenerationError           = shallowRef<ReadonlyMap<TypeId, string>>(new Map());
const favoriteToggling            = shallowRef<ReadonlySet<TypeId>>(new Set());
const optimisticFavoriteOverrides = shallowRef<ReadonlyMap<TypeId, boolean>>(new Map());
const bulkDeleting                = shallowRef<ReadonlySet<TypeId>>(new Set());
```

- [ ] **Step 4.1.4: Add the `bulkDeleteInstances` action**

In the same file, after the existing `deleteInstance` action (line 167), add:

```ts
async function bulkDeleteInstances(
	typeId: TypeId,
	paths: readonly string[],
): Promise<Result<BulkDeleteReport, MakeError>> {
	if (paths.length === 0) return { kind: 'ok', value: { deletedPaths: [], failures: [] } };
	if (bulkDeleting.value.has(typeId)) return { kind: 'err', error: { kind: 'busy' } };
	const next = new Set(bulkDeleting.value); next.add(typeId); bulkDeleting.value = next;
	try {
		return await ctx.service.deleteInstances(typeId, paths);
	} finally {
		const done = new Set(bulkDeleting.value); done.delete(typeId); bulkDeleting.value = done;
	}
}
```

Add `BulkDeleteReport` to the existing type import (line 7):
```ts
import type { BulkDeleteReport, CreateInstanceOptions, InstanceRef, MoveReport, TypeId, NewTypeDraft, TypeSchemaPatch, DeleteTypeOptions, DeleteTypeReport, UpdateTypeOptions, UpdateTypeResult } from '../../domain/make/types.js';
```

**About `MakeError` and the `'busy'` kind:** `MakeError` is a discriminated union in `src/domain/make/errors.ts`. Verify whether `{kind: 'busy'}` is already a member; if not, add it as a new variant. Find the union with:
```bash
grep -n "type MakeError\|kind:" src/domain/make/errors.ts | head -20
```
If `'busy'` is missing, add `| { kind: 'busy' }` to the `MakeError` union — minimal, no extra fields needed since the surface meaning is "operation is already in flight." Update `formatError` in `make-store.ts:13-20` if it has a switch that needs the new variant (likely just falls through to the default).

- [ ] **Step 4.1.5: Add `bulkDeleteInstances` and `bulkDeleting` to the store's return object**

Find the return statement around line 231 and add:
```ts
return {
	// ... existing fields ...
	deleteInstance,
	bulkDeleteInstances,
	bulkDeleting,
	openInstance,
	// ... rest ...
};
```

- [ ] **Step 4.1.6: Run the action tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/stores/make-store.test.ts -t "bulkDeleteInstances" --project unit
```
Expected: 6 tests pass.

### Task 4.2: `onInstancesDeletedBatch` subscription handler (TDD)

**Files:**
- Modify: `src/ui/stores/make-store.ts` (add to the `ctx.subscribe(...)` block at lines 204–229)
- Modify: `tests/ui/stores/make-store.test.ts` (extend with a subscription test)

- [ ] **Step 4.2.1: Write the failing test**

Append to the same `make-store.test.ts` file. The existing tests for `onInstanceDeleted` are good templates (find with `grep -n "onInstanceDeleted\|onInstancesMoved" tests/ui/stores/make-store.test.ts`). Add:

```ts
it('onInstancesDeletedBatch handler triggers exactly one loadInstances call regardless of deletedPaths size', async () => {
	let listInstancesCalls = 0;
	const listInstances = vi.fn(async (_typeId: string) => {
		listInstancesCalls += 1;
		return { kind: 'ok' as const, value: [] };
	});
	const { store, handlers } = mountStore(createFakeMakeContext({
		service: fakeMakeService({ listInstances }),
	}));
	// Establish a baseline call from any setup.
	listInstancesCalls = 0;

	// Fire the handler with 1 deletedPath then with 10 deletedPaths.
	handlers.onInstancesDeletedBatch?.({ typeId: 'book', deletedPaths: ['a.md'], failures: [] });
	await new Promise((r) => setTimeout(r, 0)); // let safeRefresh microtask settle
	expect(listInstancesCalls).toBe(1);

	const tenPaths = Array.from({ length: 10 }, (_, i) => `Books/${i}.md`);
	handlers.onInstancesDeletedBatch?.({ typeId: 'book', deletedPaths: tenPaths, failures: [] });
	await new Promise((r) => setTimeout(r, 0));
	expect(listInstancesCalls).toBe(2); // one more, not eleven more
});
```

- [ ] **Step 4.2.2: Run the test to verify it fails**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/stores/make-store.test.ts -t "onInstancesDeletedBatch" --project unit
```
Expected: FAIL with `handlers.onInstancesDeletedBatch is undefined` (or equivalent — the handler is not yet registered).

- [ ] **Step 4.2.3: Add the subscription handler**

Edit `src/ui/stores/make-store.ts`. Inside the `ctx.subscribe({ ... })` block (currently lines 204–229), add a new handler next to the existing `onInstanceDeleted`:

```ts
onInstanceDeleted: ({ typeId }) => { safeRefresh('instance-deleted', () => loadInstances(typeId)); },
onInstancesDeletedBatch: ({ typeId }) => { safeRefresh('instances-deleted-batch', () => loadInstances(typeId)); },
// make:orphan-deleted intentionally not subscribed — no cached list matches an orphan path.
```

- [ ] **Step 4.2.4: Run the test to verify it passes**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/stores/make-store.test.ts -t "onInstancesDeletedBatch" --project unit
```
Expected: PASS.

- [ ] **Step 4.2.5: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: end of Chunk 4 → 105 files, 983 tests (976 + 6 from Task 4.1 + 1 from Task 4.2). Lint: 0 errors.

- [ ] **Step 4.2.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/ui/stores/make-store.ts" "01 - Projects/Agentonomous/tests/ui/stores/make-store.test.ts" "01 - Projects/Agentonomous/src/domain/make/errors.ts"
# (errors.ts only if you added the 'busy' variant in Step 4.1.4)
git commit -m "$(cat <<'EOF'
feat(agentonomous): make-store bulkDeleteInstances action + batch subscription (Polish P1 #13)

Adds the bulkDeleting per-typeId set as a UI optimistic guard, the
bulkDeleteInstances action that single-flights per typeId and returns
err({kind:'busy'}) on overlap, and the onInstancesDeletedBatch
subscription handler that triggers exactly one loadInstances refresh
per batch — regardless of how many paths were deleted.

Real cross-action serialization with updateType is provided by the
service-layer per-type-queue (Chunk 1); this store-level set is the
UI affordance that disables buttons and hides spinners.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 5: Page UI — select mode foundation

Add the select-mode toggle, the checkbox column, the selection-state hygiene watcher, and the basic ARIA semantics. **No bulk-action toolbar or dialogs in this chunk** — just the toggle + selection state. The toolbar and partial-result flow land in Chunk 6.

### Task 5.1: Select-mode state + toggle + checkbox rendering (TDD)

**Files:**
- Modify: `src/ui/pages/make/MakeTypeInstances.vue` (script + template + styles)
- Modify: `tests/ui/pages/make/MakeTypeInstances.test.ts` (extend with a new describe block)

- [ ] **Step 5.1.1: Write the failing tests**

Append a new describe block to `tests/ui/pages/make/MakeTypeInstances.test.ts`. Use the existing `mountPage()` helper and `InstanceRef` fixtures from the existing tests in that file (the keyboard-a11y describe block from Polish P1 #8 is a good template — see commit `2fe654c2`).

```ts
describe('MakeTypeInstances — select mode foundation', () => {
	const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',        title: 'Dune',         createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };
	const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer',  createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
	const FOUND: InstanceRef = { typeId: 'book', path: 'Books/Foundation.md',  title: 'Foundation',   createdAt: '2026-04-17T00:00:00.000Z', updatedAt: '2026-04-17T00:00:00.000Z' };

	beforeEach(() => {
		setActivePinia(createPinia());
		document.body.innerHTML = '';
	});

	it('renders a Select toggle button in the header (default off, no checkboxes shown)', () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const toggle = wrapper.find('[data-testid="select-mode-toggle"]');
		expect(toggle.exists()).toBe(true);
		expect(toggle.attributes('aria-pressed')).toBe('false');
		expect(wrapper.findAll('[data-testid^="instance-row-checkbox-"]')).toHaveLength(0);
		wrapper.unmount();
	});

	it('clicking the Select toggle enters select mode: shows checkboxes, hides per-row delete buttons', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		const checkboxes = wrapper.findAll('[data-testid^="instance-row-checkbox-"]');
		expect(checkboxes).toHaveLength(3);
		// Per-row delete buttons should NOT render in select mode.
		expect(wrapper.findAll('[data-testid^="delete-instance-"]')).toHaveLength(0);
		expect(wrapper.find('[data-testid="select-mode-toggle"]').attributes('aria-pressed')).toBe('true');
		wrapper.unmount();
	});

	it('toggling a row checkbox adds/removes its path from the selection', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		const cb = wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`);
		expect(cb.element.getAttribute('aria-checked')).toBe('false');
		await cb.trigger('click');
		expect(cb.element.getAttribute('aria-checked')).toBe('true');
		await cb.trigger('click');
		expect(cb.element.getAttribute('aria-checked')).toBe('false');
		wrapper.unmount();
	});

	it('list gets aria-multiselectable="true" only in select mode; rows expose aria-selected', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const list = () => wrapper.find('.instances-list');
		expect(list().attributes('aria-multiselectable')).toBeUndefined();
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		expect(list().attributes('aria-multiselectable')).toBe('true');
		const rows = wrapper.findAll('li.instance-row');
		expect(rows).toHaveLength(3);
		expect(rows[0]!.attributes('aria-selected')).toBe('false');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(rows[0]!.attributes('aria-selected')).toBe('true');
		wrapper.unmount();
	});

	it('exiting select mode clears selection', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('true');
		// Toggle off:
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		// Re-enter to inspect:
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('false');
		wrapper.unmount();
	});

	it('selection hygiene: paths removed from the list also leave the selection set', async () => {
		// Mount with three instances; select two; then re-render with one removed; the survivor stays selected.
		const { wrapper, rerenderInstances } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		// Drop NEURO from the props.
		await rerenderInstances([DUNE, FOUND]);
		const rows = wrapper.findAll('li.instance-row');
		expect(rows).toHaveLength(2);
		// DUNE survives selected; FOUND was never selected.
		expect(rows[0]!.attributes('aria-selected')).toBe('true');  // DUNE
		expect(rows[1]!.attributes('aria-selected')).toBe('false'); // FOUND
		wrapper.unmount();
	});

	it('select-mode toggle is disabled while loading=true', () => {
		const { wrapper } = mountPage({ instances: undefined, loading: true });
		const toggle = wrapper.find('[data-testid="select-mode-toggle"]');
		expect(toggle.attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
});
```

The `mountPage` helper currently takes `{ instances, loading?, error? }`. The "selection hygiene" test needs to update the `instances` prop after mount — verify the existing helper supports this (`grep -n "function mountPage" tests/ui/pages/make/MakeTypeInstances.test.ts`); if it returns the wrapper but no setProps shorthand, add a thin `rerenderInstances(next)` that calls `wrapper.setProps({ instances: next }); await nextTick();`.

- [ ] **Step 5.1.2: Run tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/pages/make/MakeTypeInstances.test.ts -t "select mode foundation" --project unit
```
Expected: 7 FAILs.

- [ ] **Step 5.1.3: Add the script-side state to `MakeTypeInstances.vue`**

Edit the `<script setup>` block of `src/ui/pages/make/MakeTypeInstances.vue`. Add after the existing `pendingInstanceDelete` ref (around line 37):

```ts
// --- Bulk select mode ---
const selectMode    = ref(false);
const selectedPaths = shallowRef<ReadonlySet<string>>(new Set());

function toggleSelectMode(): void {
	if (props.loading) return;          // off→on guard (selection hygiene §)
	selectMode.value = !selectMode.value;
	if (!selectMode.value) selectedPaths.value = new Set();
}

function isRowSelected(path: string): boolean {
	return selectedPaths.value.has(path);
}

function toggleRowSelection(path: string): void {
	const next = new Set(selectedPaths.value);
	if (next.has(path)) next.delete(path); else next.add(path);
	selectedPaths.value = next;
}

// Selection hygiene: when the sorted list changes (refresh, external delete),
// drop any selected paths that no longer exist in the rendered set.
watch(
	() => sorted.value.map((r) => r.path),
	(currentPaths) => {
		const allowed = new Set(currentPaths);
		const next = new Set([...selectedPaths.value].filter((p) => allowed.has(p)));
		if (next.size !== selectedPaths.value.size) selectedPaths.value = next;
	},
);
```

Add `shallowRef` to the existing Vue import (line 2):
```ts
import { computed, inject, nextTick, ref, shallowRef, watch } from 'vue';
```

- [ ] **Step 5.1.4: Update the template — header toggle + checkbox column + ARIA**

Edit the template:

1. In the header (currently lines 136–146), add the Select toggle next to the "+ New" button:

```vue
<header class="make-type-instances__header">
	<h2 data-testid="make-type-instances-heading">{{ t('make.instances.heading') }}</h2>
	<div class="make-type-instances__header-actions">
		<button
			type="button"
			data-testid="select-mode-toggle"
			:aria-pressed="selectMode ? 'true' : 'false'"
			:disabled="loading"
			@click="toggleSelectMode"
		>
			{{ selectMode ? t('make.instances.bulk.done-button') : t('make.instances.bulk.select-button') }}
		</button>
		<button
			type="button"
			data-testid="new-instance-button"
			:aria-expanded="panelOpen ? 'true' : 'false'"
			@click="togglePanel"
		>
			+ {{ t('make.instances.new-button') }}
		</button>
	</div>
</header>
```

(The `make.instances.bulk.*` keys are added in Chunk 8; for now the test passes by data-testid alone, but tsc/lint won't fault on missing i18n at runtime — the missing-key fallback returns the key itself. Tests assert structure, not text.)

2. On the `<ul class="instances-list">` (currently line 170), add `:aria-multiselectable` conditionally:

```vue
<ul
	v-else
	role="list"
	class="instances-list"
	:aria-label="t('make.instances.heading')"
	:aria-multiselectable="selectMode ? 'true' : undefined"
>
```

3. On the `<li class="instance-row">` (currently lines 171–183), add `:aria-selected`:

```vue
<li
	v-for="(instanceRef, index) in sorted"
	:key="instanceRef.path"
	:ref="(el) => setRowRef(el as Element | null, index)"
	:data-testid="`instance-row-${instanceRef.path}`"
	class="instance-row"
	role="listitem"
	:tabindex="index === focusedRowIndex ? 0 : -1"
	:aria-posinset="index + 1"
	:aria-setsize="sorted.length"
	:aria-selected="selectMode ? (isRowSelected(instanceRef.path) ? 'true' : 'false') : undefined"
	@focus="focusedRowIndex = index"
	@keydown="(e: KeyboardEvent) => onRowKeydown(e, index)"
>
```

4. Inside the row (between `<span class="instance-title">` and `<span class="instance-row__actions">`), add a checkbox visible only in select mode, and wrap the actions span with `v-if="!selectMode"`:

```vue
	<span
		v-if="selectMode"
		role="checkbox"
		:data-testid="`instance-row-checkbox-${instanceRef.path}`"
		:aria-checked="isRowSelected(instanceRef.path) ? 'true' : 'false'"
		:aria-label="`${t('make.instances.bulk.select-row-aria', { title: instanceRef.title })}`"
		tabindex="-1"
		class="instance-row__checkbox"
		@click="() => toggleRowSelection(instanceRef.path)"
	>
		<!-- Visual: simple inline SVG or unicode glyph; tests only assert aria-checked. -->
		{{ isRowSelected(instanceRef.path) ? '☑' : '☐' }}
	</span>
	<span class="instance-title">{{ instanceRef.title }}</span>
	<span class="instance-date">{{ t('make.type.instances.createdLabel', { date: shortDate(instanceRef.createdAt) }) }}</span>
	<span v-if="!selectMode" class="instance-row__actions">
		<!-- existing two buttons unchanged -->
	</span>
```

(Using `role="checkbox"` on a `<span>` with `aria-checked` is a deliberate choice: it composes cleanly with the row's roving-tabindex story without introducing a focusable native control inside the row that would break Tab semantics. The visual glyph is a placeholder — design polish can come later.)

5. Add minimal CSS in the existing `<style scoped>` block:

```css
.make-type-instances__header-actions { display: flex; gap: 0.5rem; align-items: center; }
.instance-row__checkbox { user-select: none; cursor: pointer; padding: 0 0.25rem; font-size: 1.1em; }
.instance-row[aria-selected="true"] { background: var(--background-modifier-hover); }
```

- [ ] **Step 5.1.5: Run tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/pages/make/MakeTypeInstances.test.ts -t "select mode foundation" --project unit
```
Expected: 7 tests pass.

- [ ] **Step 5.1.6: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: end of Chunk 5 → 105 files, 990 tests (983 + 7). Lint: 0 errors. (If `mountPage` was extended with `rerenderInstances`, lint should still be 0.)

- [ ] **Step 5.1.7: Commit**

```bash
git add "01 - Projects/Agentonomous/src/ui/pages/make/MakeTypeInstances.vue" "01 - Projects/Agentonomous/tests/ui/pages/make/MakeTypeInstances.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): MakeTypeInstances select-mode toggle + checkbox column (Polish P1 #13)

Adds a "Select" toggle button in the header that switches the instances
list into select mode: per-row delete buttons hide, a checkbox span
appears at the start of every row, the list gains aria-multiselectable,
rows expose aria-selected, and a watcher prunes stale paths from the
selection set on every list refresh. The toggle is disabled while the
list is loading. No bulk-action toolbar yet — that lands in Chunk 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

