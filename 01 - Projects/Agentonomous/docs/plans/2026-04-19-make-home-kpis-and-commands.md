# Make — MakeHome KPIs + command-palette entries Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first slice of Make Chunk 5: restructure `MakeHome.vue` into a dashboard with KPI tiles + a recently-created instance list, and add two new command-palette entries (`Make: create new type`, `Make: browse types`).

**Architecture:** Three layers in strict order.
1. A pure `format-relative-date.ts` util + a real `getKpis()` service implementation (walks `listTypes` → `listInstances` per type, reduces into `KpiSnapshot`).
2. Store gains `kpis` + `kpisLoading` + `loadKpis()` + subscribes to 6 mutation events (each triggers `safeRefresh`).
3. UI: two new presentation components (`KpiCard`, `RecentInstancesList`) + a restructured `MakeHome.vue` + two new commands wired through a module-level navigation bridge (`let navigateHandler: ((path:string) => void) | null`) that the Vue app registers on mount.

**Tech Stack:** TypeScript (ES2022, NodeNext, strict), Vue 3 + Pinia + vue-i18n, Vitest (`forks` pool, two projects: `unit` + `storybook`), ESLint (architecture rules), Obsidian Plugin SDK. Tabs-4 indentation, kebab-case filenames, `.js` import extensions (ESM), no `any` / `@ts-ignore` / TODO comments.

**Spec:** `01 - Projects/Agentonomous/docs/specs/2026-04-19-make-home-kpis-and-commands-design.md` — refer to it for rationale on any decision below.

**Working directory for all commands:** `cd "01 - Projects/Agentonomous"` from git root `c:\Projects\flowti`. Git commands run from git root using full paths.

**Test invocation convention (used throughout):**
- Full green gate (lint + typecheck + unit): `npm test`
- Single test file: `npx vitest run <path> --project unit`
- Lint only: `npm run lint`
- Typecheck only: `npm run typecheck`
- Storybook smoke: `npx vitest run --project storybook` (browser-based, may flake on Windows; not a blocker)

**TDD discipline** (from `superpowers:test-driven-development`): write the failing test before the implementation. Run it. See it fail. Then implement. Run again. See it pass. Commit. No exceptions unless a step explicitly says "refactor only."

**Commit convention** (matches recent Polish commits): `<type>(agentonomous): <subject> (Chunk 5 #N)`. Numbering below: #1 (util), #2 (service), #3 (store), #4 (components), #5 (MakeHome), #6 (commands), #7 (storybook).

---

## Chunk 0: Preflight

One-time verification that the repository is on the documented baseline before any work begins.

### Task 0: Verify green baseline

**Files:** none (verification only).

- [ ] **Step 0.1: Confirm working tree clean and at expected HEAD**

Run from git root `c:\Projects\flowti`:
```bash
git status
git log --oneline -3
```
Expected: `nothing to commit, working tree clean`. The current `HEAD` should be `1c7cefd9` or a descendant that has not modified any of:
- `src/domain/make/**`
- `src/modules/make/**`
- `src/ui/pages/make/MakeHome.vue` (or `.po.ts`)
- `src/ui/stores/make-store.ts`

If newer commits touched those paths, stop and re-read the spec — the line-number citations below may be stale.

- [ ] **Step 0.2: Run the full test suite from the Agentonomous project**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected tail:
```
 Test Files  104 passed (104)
      Tests  1010 passed (1010)
```
Lint: 0 errors (~30 pre-existing style warnings are acceptable — do not fix them in this work). Typecheck: clean.

- [ ] **Step 0.3: Snapshot baseline numbers**

Note these for verification at the end of every chunk:
- Test files: 104 baseline
- Tests: 1010 baseline
- Lint errors: 0 (must remain 0)

Per-chunk endpoints (cumulative test counts after each chunk's commits — verify at the end of each chunk):

| End of chunk | Files | Tests | Notes |
|---|---|---|---|
| Chunk 0 | 104 | 1010 | Baseline. |
| Chunk 1 | 105 | 1018 | +1 file (`format-relative-date.test.ts`), +8 tests. |
| Chunk 2 | 106 | 1025 | +1 file (`make-service-maintenance.test.ts`), +7 tests (service getKpis). |
| Chunk 3 | 106 | 1034 | 0 new files (extends `make-store.test.ts`), +9 tests (3 action + 6 subs). |
| Chunk 4 | 108 | 1045 | +2 files (`KpiCard.test.ts`, `RecentInstancesList.test.ts`), +11 tests. |
| Chunk 5 | 108 | 1049 | 0 new files (rewrites `MakeHome.test.ts`), net +4 tests (replaces 12 existing with 16 new). |
| Chunk 6 | 109 | 1057 | +1 file (`obsidian-command-adapter.test.ts`), +8 tests (4 command decls + 2 adapter ordering + 2 app.ts wiring). |
| Chunk 7 | 109 | 1057 | 0 new tests (storybook stories aren't unit tests). |

If at any chunk-end the count is below the table or lint errors > 0, stop and diagnose before proceeding.

---

## Chunk 1: Relative-date formatter

A pure function util used by `RecentInstancesList`. Standalone — no dependencies on anything else in the plan. Ship first so it's a known quantity when UI components need it.

### Task 1.1: `format-relative-date.ts` + tests

**Files:**
- Create: `src/ui/pages/make/format-relative-date.ts`
- Create: `tests/ui/pages/make/format-relative-date.test.ts`

- [ ] **Step 1.1.1: Write the failing test file**

Create `tests/ui/pages/make/format-relative-date.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { formatRelativeDate } from '../../../../src/ui/pages/make/format-relative-date.js';

describe('formatRelativeDate', () => {
	const NOW = new Date('2026-04-19T12:00:00.000Z');

	beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
	afterAll(() => { vi.useRealTimers(); });

	it('returns "just now" for <60s in the past', () => {
		expect(formatRelativeDate('2026-04-19T11:59:30.000Z')).toBe('just now');
	});

	it('returns Nm ago for 1m–59m in the past', () => {
		expect(formatRelativeDate('2026-04-19T11:55:00.000Z')).toBe('5m ago');
		expect(formatRelativeDate('2026-04-19T11:01:00.000Z')).toBe('59m ago');
	});

	it('returns Nh ago for 1h–23h in the past', () => {
		expect(formatRelativeDate('2026-04-19T10:00:00.000Z')).toBe('2h ago');
		expect(formatRelativeDate('2026-04-18T13:00:00.000Z')).toBe('23h ago');
	});

	it('returns Nd ago for 1d–6d in the past', () => {
		expect(formatRelativeDate('2026-04-18T12:00:00.000Z')).toBe('1d ago');
		expect(formatRelativeDate('2026-04-13T12:00:00.000Z')).toBe('6d ago');
	});

	it('returns Nw ago for 7d–28d in the past (1w–4w)', () => {
		expect(formatRelativeDate('2026-04-12T12:00:00.000Z')).toBe('1w ago');
		expect(formatRelativeDate('2026-03-22T12:00:00.000Z')).toBe('4w ago');
	});

	it('falls back to ISO date slice for >4w in the past', () => {
		// Anything >28 days ago — use YYYY-MM-DD slice (deterministic, locale-free)
		expect(formatRelativeDate('2026-03-01T12:00:00.000Z')).toBe('2026-03-01');
	});

	it('returns "just now" for any future timestamp (clock skew guard)', () => {
		expect(formatRelativeDate('2026-04-19T12:00:30.000Z')).toBe('just now');
	});

	it('returns empty string for invalid input (non-ISO, empty string)', () => {
		expect(formatRelativeDate('not a date')).toBe('');
		expect(formatRelativeDate('')).toBe('');
	});
});
```

- [ ] **Step 1.1.2: Run test to verify it fails**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/pages/make/format-relative-date.test.ts --project unit
```
Expected: FAIL with module-resolution error (`Cannot find module '…/format-relative-date.js'`).

- [ ] **Step 1.1.3: Create the implementation**

Create `src/ui/pages/make/format-relative-date.ts`:

```ts
/**
 * Pure relative-date formatter used by RecentInstancesList.
 *
 * Buckets:
 *   <60s           → "just now"
 *   1m–59m         → "Nm ago"
 *   1h–23h         → "Nh ago"
 *   1d–6d          → "Nd ago"
 *   7d–28d         → "Nw ago"  (1w–4w)
 *   >28d           → ISO date slice "YYYY-MM-DD"  (deterministic, locale-free)
 *   future / bad   → "just now" or ""  (see impl)
 *
 * Deterministic: relies only on Date.now() and Date.parse(). No locale.
 */
export function formatRelativeDate(iso: string): string {
	const parsed = Date.parse(iso);
	if (Number.isNaN(parsed)) return '';
	const nowMs   = Date.now();
	const deltaMs = nowMs - parsed;

	if (deltaMs < 60_000) return 'just now';

	const minutes = Math.floor(deltaMs / 60_000);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.floor(deltaMs / 3_600_000);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(deltaMs / 86_400_000);
	if (days < 7) return `${days}d ago`;

	const weeks = Math.floor(days / 7);
	if (weeks <= 4) return `${weeks}w ago`;

	return iso.slice(0, 10); // YYYY-MM-DD
}
```

- [ ] **Step 1.1.4: Run test to verify it passes**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/pages/make/format-relative-date.test.ts --project unit
```
Expected: 8 tests pass.

- [ ] **Step 1.1.5: Run the full gate to ensure nothing else regressed**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected tail: `Test Files 105 passed (105)`, `Tests 1018 passed (1018)`. Lint: 0 errors.

- [ ] **Step 1.1.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/ui/pages/make/format-relative-date.ts" "01 - Projects/Agentonomous/tests/ui/pages/make/format-relative-date.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): format-relative-date util for MakeHome recent list (Chunk 5 #1)

Pure ISO-8601 → relative-time formatter with deterministic buckets
(just now / Nm / Nh / Nd / Nw) and YYYY-MM-DD fallback beyond 4 weeks.
No locale, no external deps. 8 tests cover every bucket boundary plus
future-timestamp and invalid-input guards.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Service — implement `getKpis`

Implement the currently-stubbed `getKpis` in `make-service-maintenance.ts` for real. Extend `MaintenanceOpsPeers` with `listTypes` and `listInstances` to match the pattern used by `TypeOpsPeers` (`listInstances`, `listInstancesInFolder`) and `InstanceOpsPeers` (`loadType`, `listTypes`).

### Task 2.1: Extend `MaintenanceOpsPeers` + implement `getKpis` (TDD)

**Files:**
- Modify: `src/modules/make/make-service-maintenance.ts`
- Modify: `src/modules/make/make-service.ts` (the `createMaintenanceOps` call site at line 57–59)
- Create: `tests/modules/make/make-service-maintenance.test.ts`

- [ ] **Step 2.1.1: Confirm the only call site is the production one**

```bash
cd "01 - Projects/Agentonomous" && grep -rn "createMaintenanceOps" src/ tests/
```
Expected — exactly two results in `src/`: the import + the call in `make-service.ts`. Zero `tests/` matches. If surprised by a test match, treat it as new context and update that call site too.

- [ ] **Step 2.1.2: Write the failing test file**

Create `tests/modules/make/make-service-maintenance.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMakeService } from '../../../src/modules/make/make-service.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts, fakeVault } from '../../__fakes__/fake-ports.js';
import { serializeTypeSchema } from '../../../src/domain/make/type-schema-codec.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const RECIPE: TypeSchema = {
	id: 'recipe', name: 'Recipe', instancesFolder: 'Recipes', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('service.getKpis', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
	});

	it('empty vault → all zeros', async () => {
		const svc = createMakeService(fakeModulePorts({ vault: fakeVault() }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis).toEqual({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] });
	});

	it('one type, zero instances → typesCount 1, rest zero, perType entry present', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(1);
		expect(kpis.instancesCount).toBe(0);
		expect(kpis.createdThisWeek).toBe(0);
		expect(kpis.perType).toEqual({ book: 0 });
		expect(kpis.recentlyCreated).toEqual([]);
	});

	it('multiple types + instances → correct counts + perType map', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json',   serializeTypeSchema(BOOK));
		await vault.create('Make/Types/recipe.json', serializeTypeSchema(RECIPE));
		await vault.create('Books/Dune.md',          '# Dune');
		await vault.create('Books/Foundation.md',    '# Foundation');
		await vault.create('Recipes/Pizza.md',       '# Pizza');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(2);
		expect(kpis.instancesCount).toBe(3);
		expect(kpis.perType).toEqual({ book: 2, recipe: 1 });
	});

	it('createdThisWeek counts only instances with ctime ≥ now - 7d', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		// fakeVault timestamps every create with Date.now(). System time is 2026-04-19T12:00:00.
		// Move the clock back 6 days, create one instance, then back to now.
		vi.setSystemTime(new Date('2026-04-13T12:00:00.000Z')); // 6d ago (inside)
		await vault.create('Books/Recent.md', '# Recent');
		vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z')); // 9d ago (outside)
		await vault.create('Books/Old.md',    '# Old');
		vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.instancesCount).toBe(2);
		expect(kpis.createdThisWeek).toBe(1);
	});

	it('recentlyCreated sorted descending by createdAt, capped at 10', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		// Create 12 instances at distinct timestamps.
		for (let i = 0; i < 12; i++) {
			vi.setSystemTime(new Date(Date.UTC(2026, 3, i + 1, 12, 0, 0))); // April 2026-04-01 … 04-12
			await vault.create(`Books/Book${i}.md`, `# Book${i}`);
		}
		vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.recentlyCreated).toHaveLength(10);
		// Most recent first: Book11 (2026-04-12) → Book2 (2026-04-03)
		expect(kpis.recentlyCreated[0]!.title).toBe('Book11');
		expect(kpis.recentlyCreated[9]!.title).toBe('Book2');
		// Strictly descending
		for (let i = 0; i < kpis.recentlyCreated.length - 1; i++) {
			expect(kpis.recentlyCreated[i]!.createdAt >= kpis.recentlyCreated[i + 1]!.createdAt).toBe(true);
		}
	});

	it('returns typesCount 0 + empty structure when listTypes errors', async () => {
		// Force listTypes to err by seeding a malformed type file that fails to parse.
		const vault = fakeVault();
		await vault.create('Make/Types/broken.json', '{{not valid json');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		// listTypes recovers parse issues as `issues[]` rather than erroring, so typesCount
		// is 0 (no valid schemas) and perType is empty. No crash is the key assertion.
		expect(kpis.typesCount).toBe(0);
		expect(kpis.instancesCount).toBe(0);
		expect(kpis.perType).toEqual({});
	});

	it('per-type listInstances errors are graceful-degraded (type counts as 0 instances, others unaffected)', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json',   serializeTypeSchema(BOOK));
		await vault.create('Make/Types/recipe.json', serializeTypeSchema(RECIPE));
		await vault.create('Recipes/Pizza.md',       '# Pizza');
		// Inject a failure for book's listInstances by corrupting the Books folder read.
		// Simplest: leave Books folder nonexistent. listInstancesInFolder returns [] in that
		// case (see make-service-instances.ts:45-48), which is success-empty, NOT an error.
		// So to truly exercise the error path we must make ports.vault.list fail for the
		// books folder specifically. Use options.listError to force ALL list calls to err.
		// For scoped err we pass a custom vault — but ports.vault.list is a vi.fn, so
		// overriding it per-call is the cleanest route.
		const ports = fakeModulePorts({ vault });
		const originalList = ports.vault.list;
		ports.vault.list = vi.fn(async (folder: string) => {
			if (folder === 'Books') return { kind: 'err' as const, error: 'scoped' };
			return originalList(folder);
		}) as typeof ports.vault.list;
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(2);
		expect(kpis.instancesCount).toBe(1); // only Pizza counted
		expect(kpis.perType).toEqual({ book: 0, recipe: 1 });
	});
});
```

Notes on test mechanics:
- `fakeVault` returns files with `stat.ctime` set to `Date.now()` at create time — verify by reading `tests/__fakes__/fake-ports.ts` lines ~110–170. This is why `vi.setSystemTime` before each create works.
- The last test asserts graceful degradation. `listInstancesInFolder` returns `[]` when `vault.list` errors (`make-service-instances.ts:47`), so the corresponding `listInstances` returns `ok([])`. `getKpis` treats that as 0 instances for the type — no error propagates out.

- [ ] **Step 2.1.3: Run tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-service-maintenance.test.ts --project unit
```
Expected: 7 FAILs — all because `getKpis` returns the stubbed zeros.

- [ ] **Step 2.1.4: Extend `MaintenanceOpsPeers` and implement `getKpis`**

Edit `src/modules/make/make-service-maintenance.ts`:

1. Extend imports at the top:
```ts
import type { InstanceRef, KpiSnapshot, ListTypesResult } from '../../domain/make/types.js';
```

2. Extend the `MaintenanceOpsPeers` interface (currently lines 12–14):
```ts
export interface MaintenanceOpsPeers {
	loadType: (typeId: string) => Promise<Result<TypeSchema, MakeError>>;
	listTypes: () => Promise<Result<ListTypesResult, MakeError>>;
	listInstances: (typeId: string) => Promise<Result<readonly InstanceRef[], MakeError>>;
}
```

3. Replace the stubbed `getKpis` line (currently line 65) with a real implementation. Add a `getKpis` function inside the factory body (after `regenerateBaseFile`):

```ts
async function getKpis(): Promise<KpiSnapshot> {
	const typesResult = await peers.listTypes();
	if (typesResult.kind === 'err') {
		return { typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] };
	}
	const types = typesResult.value.types;
	const perType: Record<string, number> = {};
	const all: InstanceRef[] = [];
	for (const type of types) {
		const list = await peers.listInstances(type.id);
		const refs = list.kind === 'ok' ? list.value : [];
		perType[type.id] = refs.length;
		for (const r of refs) all.push(r);
	}
	const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
	const weekCutoff = Date.now() - sevenDaysMs;
	let createdThisWeek = 0;
	for (const r of all) {
		if (Date.parse(r.createdAt) >= weekCutoff) createdThisWeek += 1;
	}
	const recentlyCreated = [...all]
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.slice(0, 10);
	return {
		typesCount:     types.length,
		instancesCount: all.length,
		createdThisWeek,
		perType,
		recentlyCreated,
	};
}
```

4. Replace the return object (currently lines 62–66):
```ts
return {
	deleteCorruptFile,
	regenerateBaseFile,
	getKpis,
};
```

- [ ] **Step 2.1.5: Thread the new peer methods through `make-service.ts`**

Edit `src/modules/make/make-service.ts`. Update the `createMaintenanceOps` call (currently lines 57–59):

```ts
const maintenance = createMaintenanceOps(ports, getSettings, {
	loadType:      (typeId) => typesRef.current!.loadType(typeId),
	listTypes:     () => typesRef.current!.listTypes(),
	listInstances: (typeId) => instancesRef.current!.listInstances(typeId),
});
```

**Why after both refs are assigned:** the existing call is already after `typesRef.current = types` (line 49) and `instancesRef.current = instances` (line 55), so forward-declaration is safe.

- [ ] **Step 2.1.6: Run the new tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-service-maintenance.test.ts --project unit
```
Expected: 7 tests pass.

- [ ] **Step 2.1.7: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files 106 passed (106)`, `Tests 1025 passed (1025)`. Lint: 0.

- [ ] **Step 2.1.8: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/make/make-service-maintenance.ts" "01 - Projects/Agentonomous/src/modules/make/make-service.ts" "01 - Projects/Agentonomous/tests/modules/make/make-service-maintenance.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): real getKpis implementation (Chunk 5 #2)

MaintenanceOpsPeers gains listTypes + listInstances (mirrors the peer
pattern from TypeOpsPeers / InstanceOpsPeers). service.getKpis walks
listTypes → listInstances per type, reduces into KpiSnapshot
{typesCount, instancesCount, createdThisWeek, perType, recentlyCreated}.
Per-type listInstances errors are graceful-degraded (count as 0, others
unaffected). Recently-created is sorted descending by createdAt and
capped at 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: Store — `kpis` state + `loadKpis` + subscriptions

Add `kpis`, `kpisLoading`, `loadKpis` to `make-store.ts`. Subscribe to 6 mutation events, each triggering `safeRefresh('kpis', () => loadKpis())`.

### Task 3.1: `kpis` state + `loadKpis` action (TDD)

**Files:**
- Modify: `src/ui/stores/make-store.ts`
- Modify: `tests/ui/stores/make-store.test.ts`

- [ ] **Step 3.1.1: Write the failing test block**

Append to `tests/ui/stores/make-store.test.ts` (the file already has a `make-store — bulkDeleteInstances` block at the end from Polish P1 #13; append after it):

```ts
describe('make-store — kpis', () => {
	const SNAPSHOT = {
		typesCount: 3, instancesCount: 12, createdThisWeek: 4,
		perType: { book: 5, recipe: 7 } as Record<string, number>,
		recentlyCreated: [] as ReadonlyArray<{ typeId: string; path: string; title: string; createdAt: string; updatedAt: string }>,
	};

	it('initial state: kpis is null, kpisLoading is false', () => {
		const { store } = mountStore();
		expect(store.kpis).toBeNull();
		expect(store.kpisLoading).toBe(false);
	});

	it('loadKpis populates store.kpis, toggles loading, calls service.getKpis once', async () => {
		const getKpis = vi.fn().mockResolvedValue(SNAPSHOT);
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ getKpis: getKpis as MakeService['getKpis'] }),
		}));
		const p = store.loadKpis();
		expect(store.kpisLoading).toBe(true);
		await p;
		expect(store.kpisLoading).toBe(false);
		expect(store.kpis).toEqual(SNAPSHOT);
		expect(getKpis).toHaveBeenCalledTimes(1);
	});

	it('loadKpis does NOT throw if the service rejects — logs through ctx.logger.warn via safeRefresh', async () => {
		const warn = vi.fn();
		const getKpis = vi.fn().mockRejectedValue(new Error('boom'));
		const ctx = createFakeMakeContext({
			service: fakeMakeService({ getKpis: getKpis as MakeService['getKpis'] }),
			logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
		});
		const { store } = mountStore(ctx);
		// loadKpis itself awaits the service; the safeRefresh wrap is what catches.
		// Here we test the direct-call path — await + assert no unhandled rejection.
		await expect(store.loadKpis()).resolves.toBeUndefined();
		expect(store.kpisLoading).toBe(false);
		expect(store.kpis).toBeNull();
	});
});
```

Then (same describe block), add 6 subscription tests:

```ts
describe('make-store — kpis event subscriptions', () => {
	function setupWithGetKpis() {
		const getKpis = vi.fn().mockResolvedValue({
			typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [],
		});
		const mounted = mountStore(createFakeMakeContext({
			service: fakeMakeService({ getKpis: getKpis as MakeService['getKpis'] }),
		}));
		return { ...mounted, getKpis };
	}

	it('make:type-created triggers a kpis refresh', async () => {
		const { handlers, getKpis } = setupWithGetKpis();
		handlers.onTypeCreated?.({ schema: { id: 'x', name: 'X', instancesFolder: 'X', titleFieldName: null, fields: [], createdAt: '', updatedAt: '' } });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});

	it('make:type-deleted triggers a kpis refresh', async () => {
		const { handlers, getKpis } = setupWithGetKpis();
		handlers.onTypeDeleted?.({ typeId: 'x', name: 'X' });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});

	it('make:instance-created triggers a kpis refresh', async () => {
		const { handlers, getKpis } = setupWithGetKpis();
		handlers.onInstanceCreated?.({ typeId: 'x', path: 'X/a.md' });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});

	it('make:instance-deleted triggers a kpis refresh', async () => {
		const { handlers, getKpis } = setupWithGetKpis();
		handlers.onInstanceDeleted?.({ typeId: 'x', path: 'X/a.md' });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});

	it('make:instances-deleted-batch triggers a kpis refresh', async () => {
		const { handlers, getKpis } = setupWithGetKpis();
		handlers.onInstancesDeletedBatch?.({ typeId: 'x', deletedPaths: ['X/a.md'], failures: [] });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});

	it('make:instances-moved triggers a kpis refresh', async () => {
		const { handlers, getKpis } = setupWithGetKpis();
		handlers.onInstancesMoved?.({ typeId: 'x', report: { oldFolder: 'X', newFolder: 'Y', movedCount: 0, failedMoves: [] } });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});
});
```

Test count: 3 action tests + 6 subscription tests = 9. The subscription tests verify only the kpis side-effect added to existing handlers (which already fired `loadInstances`). End of Chunk 3 → 1034 (matches the table above).

- [ ] **Step 3.1.2: Run tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/stores/make-store.test.ts -t "kpis" --project unit
```
Expected: 9 FAILs.

- [ ] **Step 3.1.3: Add `kpis` state + `loadKpis` action**

Edit `src/ui/stores/make-store.ts`.

1. Extend the type import (line 7):
```ts
import type { BulkDeleteReport, CreateInstanceOptions, InstanceRef, KpiSnapshot, MoveReport, TypeId, NewTypeDraft, TypeSchemaPatch, DeleteTypeOptions, DeleteTypeReport, UpdateTypeOptions, UpdateTypeResult } from '../../domain/make/types.js';
```

2. Add state refs inside the setup function, near the existing `bulkDeleting` ref (line 105 area — check by grep):
```ts
const kpis        = shallowRef<KpiSnapshot | null>(null);
const kpisLoading = ref(false);
```

3. Add the action function (place near `loadInstances`, around line 46):
```ts
async function loadKpis(): Promise<void> {
	kpisLoading.value = true;
	const result = await ctx.service.getKpis().catch((e: unknown) => {
		ctx.logger.warn('make-store', `getKpis failed: ${e instanceof Error ? e.message : String(e)}`);
		return null;
	});
	kpisLoading.value = false;
	if (result !== null) kpis.value = result;
}
```

**Why `.catch()` not `try/catch`:** ESLint bans `TryStatement` outside `src/infrastructure/**` (see `eslint.config.mjs:58–62`). The existing `safeRefresh` helper in the same file (`make-store.ts:211–215`) and the `init(...).catch(...)` pattern in `make-module.ts:111` are the precedents.

4. Extend the `ctx.subscribe` block. Find the existing handlers near line 218–244 and **add** `loadKpis` calls to the 6 target events:

```ts
onTypeCreated: ({ schema }) => {
	if (!types.value.some((t) => t.id === schema.id)) types.value = [...types.value, schema];
	safeRefresh('kpis-after-type-created', () => loadKpis());
},
onTypeDeleted: ({ typeId }) => {
	types.value = types.value.filter((t) => t.id !== typeId);
	const nextInstances = new Map(instancesByTypeId.value); nextInstances.delete(typeId); instancesByTypeId.value = nextInstances;
	const nextInstanceErr = new Map(instancesError.value); nextInstanceErr.delete(typeId); instancesError.value = nextInstanceErr;
	const nextRegenErr = new Map(regenerationError.value); nextRegenErr.delete(typeId); regenerationError.value = nextRegenErr;
	safeRefresh('kpis-after-type-deleted', () => loadKpis());
},
// onTypeUpdated stays unchanged — updating a type schema does not change KPI counts.
onInstanceCreated: ({ typeId }) => {
	safeRefresh('instance-created', () => loadInstances(typeId));
	safeRefresh('kpis-after-instance-created', () => loadKpis());
},
onInstanceDeleted: ({ typeId }) => {
	safeRefresh('instance-deleted', () => loadInstances(typeId));
	safeRefresh('kpis-after-instance-deleted', () => loadKpis());
},
onInstancesDeletedBatch: ({ typeId }) => {
	safeRefresh('instances-deleted-batch', () => loadInstances(typeId));
	safeRefresh('kpis-after-instances-deleted-batch', () => loadKpis());
},
onInstancesMoved: () => {
	safeRefresh('instances-moved', () => loadTypes());
	safeRefresh('kpis-after-instances-moved', () => loadKpis());
},
```

5. Add `kpis`, `kpisLoading`, `loadKpis` to the return object (around line 247–282). Place alphabetically near existing fields:
```ts
return {
	// … existing entries …
	kpis,
	kpisLoading,
	loadKpis,
	// … remaining entries …
};
```

- [ ] **Step 3.1.4: Run new tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/stores/make-store.test.ts -t "kpis" --project unit
```
Expected: 9 tests pass.

- [ ] **Step 3.1.5: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files 106 passed (106)`, `Tests 1034 passed`. Lint: 0.

- [ ] **Step 3.1.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/ui/stores/make-store.ts" "01 - Projects/Agentonomous/tests/ui/stores/make-store.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): make-store kpis state + loadKpis + event-driven refresh (Chunk 5 #3)

Adds kpis (shallowRef<KpiSnapshot | null>), kpisLoading, and loadKpis action.
Six mutation events trigger safeRefresh('kpis-after-<evt>', loadKpis):
type-created, type-deleted, instance-created, instance-deleted,
instances-deleted-batch, instances-moved. onTypeUpdated is intentionally
skipped — schema updates do not change KPI counts.

No TTL caching: the event-driven model reflects every mutation. The
safeRefresh wrapper ensures loadKpis never produces an unhandled
rejection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: UI — `KpiCard` + `RecentInstancesList` components

Two new presentation components consumed only by MakeHome. Pure props-in, events-out — no store access.

### Task 4.1: `KpiCard.vue` (TDD)

**Files:**
- Create: `src/ui/components/make/KpiCard.vue`
- Create: `tests/ui/components/make/KpiCard.test.ts`

- [ ] **Step 4.1.1: Write the failing test**

Create `tests/ui/components/make/KpiCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import KpiCard from '../../../../src/ui/components/make/KpiCard.vue';

describe('KpiCard', () => {
	it('renders the label and value', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 3, testid: 'kpi-types' } });
		expect(wrapper.find('[data-testid="kpi-types"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="kpi-types-value"]').text()).toBe('3');
		expect(wrapper.find('[data-testid="kpi-types-label"]').text()).toBe('Types');
		wrapper.unmount();
	});

	it('renders a skeleton dash when loading=true', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0, testid: 'kpi-x', loading: true } });
		expect(wrapper.find('[data-testid="kpi-x-value"]').text()).toBe('—');
		wrapper.unmount();
	});

	it('uses the default testid "kpi-card" when no testid prop is provided', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0 } });
		expect(wrapper.find('[data-testid="kpi-card"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it('numeric value 0 renders as "0", not empty', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0, testid: 'z' } });
		expect(wrapper.find('[data-testid="z-value"]').text()).toBe('0');
		wrapper.unmount();
	});
});
```

- [ ] **Step 4.1.2: Run test to verify it fails**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/components/make/KpiCard.test.ts --project unit
```
Expected: FAIL on module-resolution.

- [ ] **Step 4.1.3: Create the component**

Create `src/ui/components/make/KpiCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	label:    string;
	value:    number;
	testid?:  string;
	loading?: boolean;
}>(), { testid: 'kpi-card', loading: false });

const displayValue = computed<string>(() => props.loading ? '—' : String(props.value));
</script>

<template>
	<div :data-testid="testid" class="kpi-card">
		<span :data-testid="`${testid}-value`" class="kpi-card__value">{{ displayValue }}</span>
		<span :data-testid="`${testid}-label`" class="kpi-card__label">{{ label }}</span>
	</div>
</template>

<style scoped>
.kpi-card {
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
	padding: 0.75rem 1rem;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	min-width: 6rem;
	text-align: center;
}
.kpi-card__value { font-size: 1.75rem; font-weight: 600; color: var(--text-normal); line-height: 1.1; }
.kpi-card__label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
```

- [ ] **Step 4.1.4: Run test to verify it passes**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/components/make/KpiCard.test.ts --project unit
```
Expected: 4 tests pass.

### Task 4.2: `RecentInstancesList.vue` (TDD)

**Files:**
- Create: `src/ui/components/make/RecentInstancesList.vue`
- Create: `tests/ui/components/make/RecentInstancesList.test.ts`

- [ ] **Step 4.2.1: Write the failing test**

Create `tests/ui/components/make/RecentInstancesList.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import RecentInstancesList from '../../../../src/ui/components/make/RecentInstancesList.vue';
import type { InstanceRef } from '../../../../src/domain/make/types.js';

const NOW = new Date('2026-04-19T12:00:00.000Z');

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',  title: 'Dune',  createdAt: '2026-04-19T10:00:00.000Z', updatedAt: '2026-04-19T10:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuro.md', title: 'Neuro', createdAt: '2026-04-18T12:00:00.000Z', updatedAt: '2026-04-18T12:00:00.000Z' };

describe('RecentInstancesList', () => {
	it('renders one row per instance with title, type-name chip, and relative date', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE, NEURO], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
		});
		const rows = wrapper.findAll('[data-testid^="recent-instance-row-"]');
		expect(rows).toHaveLength(2);
		expect(rows[0]!.text()).toContain('Dune');
		expect(rows[0]!.text()).toContain('Book');
		expect(rows[0]!.text()).toContain('2h ago');
		expect(rows[1]!.text()).toContain('Neuro');
		expect(rows[1]!.text()).toContain('1d ago');
		wrapper.unmount();
	});

	it('emits "open" with the path when a row is clicked', async () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
		});
		await wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`).trigger('click');
		expect(wrapper.emitted('open')).toEqual([['Books/Dune.md']]);
		wrapper.unmount();
	});

	it('emits "open" when Enter is pressed on a focused row', async () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
			attachTo: document.body,
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		(row.element as HTMLElement).focus();
		row.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(wrapper.emitted('open')).toEqual([['Books/Dune.md']]);
		wrapper.unmount();
	});

	it('shows emptyPlaceholder text when instances is empty (and loading is false)', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [], typeNamesById: {}, emptyPlaceholder: 'Nothing yet', loading: false },
		});
		expect(wrapper.find('[data-testid="recent-instances-empty"]').text()).toBe('Nothing yet');
		expect(wrapper.findAll('[data-testid^="recent-instance-row-"]')).toHaveLength(0);
		wrapper.unmount();
	});

	it('uses the raw typeId as the chip text when typeNamesById has no entry for the typeId', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: {}, emptyPlaceholder: '', loading: false },
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		expect(row.text()).toContain('book'); // raw typeId fallback
		wrapper.unmount();
	});

	it('does NOT render the empty placeholder while loading=true', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [], typeNamesById: {}, emptyPlaceholder: 'X', loading: true },
		});
		expect(wrapper.find('[data-testid="recent-instances-empty"]').exists()).toBe(false);
		wrapper.unmount();
	});

	it('rows are keyboard-focusable (tabindex="0")', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: {}, emptyPlaceholder: '', loading: false },
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		expect(row.attributes('tabindex')).toBe('0');
		wrapper.unmount();
	});
});
```

- [ ] **Step 4.2.2: Run test to verify it fails**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/components/make/RecentInstancesList.test.ts --project unit
```
Expected: FAIL.

- [ ] **Step 4.2.3: Create the component**

Create `src/ui/components/make/RecentInstancesList.vue`:

```vue
<script setup lang="ts">
import type { InstanceRef } from '../../../domain/make/types.js';
import { formatRelativeDate } from '../../pages/make/format-relative-date.js';

const props = defineProps<{
	instances:         readonly InstanceRef[];
	typeNamesById:     Readonly<Record<string, string>>;
	emptyPlaceholder:  string;
	loading:           boolean;
}>();

const emit = defineEmits<{ open: [path: string] }>();

function typeChip(typeId: string): string {
	return props.typeNamesById[typeId] ?? typeId;
}

function onRowClick(path: string): void {
	emit('open', path);
}

function onRowKeydown(e: KeyboardEvent, path: string): void {
	if (e.key === 'Enter') {
		e.preventDefault();
		emit('open', path);
	}
}
</script>

<template>
	<ul v-if="instances.length > 0" role="list" class="recent-instances">
		<li
			v-for="r in instances"
			:key="r.path"
			:data-testid="`recent-instance-row-${r.path}`"
			role="listitem"
			tabindex="0"
			class="recent-instance"
			@click="onRowClick(r.path)"
			@keydown="(e: KeyboardEvent) => onRowKeydown(e, r.path)"
		>
			<span class="recent-instance__title">{{ r.title }}</span>
			<span class="recent-instance__chip">{{ typeChip(r.typeId) }}</span>
			<span class="recent-instance__date">{{ formatRelativeDate(r.createdAt) }}</span>
		</li>
	</ul>
	<p
		v-else-if="!loading && emptyPlaceholder.length > 0"
		data-testid="recent-instances-empty"
		class="recent-instances__empty"
	>
		{{ emptyPlaceholder }}
	</p>
</template>

<style scoped>
.recent-instances { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.recent-instance { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: pointer; outline: none; }
.recent-instance:hover { background: var(--background-modifier-hover); }
.recent-instance:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }
.recent-instance__title { flex: 1; font-weight: 500; }
.recent-instance__chip { font-size: 0.75rem; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; color: var(--text-muted); }
.recent-instance__date { color: var(--text-muted); font-size: 0.875rem; min-width: 4rem; text-align: right; }
.recent-instances__empty { color: var(--text-muted); margin: 0; font-style: italic; }
</style>
```

- [ ] **Step 4.2.4: Run test to verify it passes**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/components/make/RecentInstancesList.test.ts --project unit
```
Expected: 7 tests pass.

- [ ] **Step 4.2.5: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files 108 passed (108)`, `Tests 1045 passed` (4 KpiCard + 7 RecentInstancesList = 11 new). Lint: 0.

- [ ] **Step 4.2.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/ui/components/make/KpiCard.vue" "01 - Projects/Agentonomous/src/ui/components/make/RecentInstancesList.vue" "01 - Projects/Agentonomous/tests/ui/components/make/KpiCard.test.ts" "01 - Projects/Agentonomous/tests/ui/components/make/RecentInstancesList.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): KpiCard + RecentInstancesList components (Chunk 5 #4)

Two pure presentation components consumed by MakeHome:

KpiCard (props: label, value, testid?, loading?) — themed card with a
large numeric value over a muted label. Loading state shows '—' so
page height doesn't jump.

RecentInstancesList (props: instances, typeNamesById, emptyPlaceholder,
loading; emits 'open') — keyboard-focusable rows showing title + type
chip + relative date. Click and Enter both emit open with the path.
typeNamesById lookup falls back to raw typeId when a name is missing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 5: `MakeHome` restructure

Rewrite `MakeHome.vue` into the dashboard layout. Update the PageObject and the test file to match the new structure. Add i18n keys.

### Task 5.1: Locale keys

**Files:**
- Modify: `src/modules/make/locales/en.json`

- [ ] **Step 5.1.1: Add new keys near `make.home.*`**

Find the `make.home.*` block (currently around lines 17–21). Append four new keys and keep existing ones:

```json
"make.home.title": "Make",
"make.home.blurb": "Author structured content in your vault.",
"make.home.browseTypesCta": "Browse types",
"make.home.empty": "You haven't created any types yet. Type authoring comes in a later update.",
"make.home.favoritesHeading": "Favorites",
"make.home.kpi.types":          "Types",
"make.home.kpi.instances":      "Instances",
"make.home.kpi.createdThisWeek": "This week",
"make.home.recent.heading":     "Recently created",
"make.home.recent.empty":       "No instances yet. Open a type to create your first one.",
```

(JSON-format note: ensure comma placement matches the surrounding block; don't trail a comma after the last entry of the file.)

### Task 5.2: Update `MakeHome.po.ts`

**Files:**
- Modify: `src/ui/pages/make/MakeHome.po.ts`

- [ ] **Step 5.2.1: Extend the PageObject with new selectors**

Add below existing getters:

```ts
get kpiTypes():     HTMLElement | null { return this.el('kpi-types'); }
get kpiInstances(): HTMLElement | null { return this.el('kpi-instances'); }
get kpiWeek():      HTMLElement | null { return this.el('kpi-week'); }
get recentHeading():  HTMLElement | null { return this.el('make-home-recent-heading'); }
get recentEmpty():    HTMLElement | null { return this.el('recent-instances-empty'); }
get recentRows(): readonly HTMLElement[] {
	return Array.from(this.root.querySelectorAll<HTMLElement>('[data-testid^="recent-instance-row-"]'));
}
```

### Task 5.3: Rewrite `MakeHome.vue` + page tests (TDD)

**Files:**
- Modify: `src/ui/pages/make/MakeHome.vue`
- Modify: `tests/ui/pages/make/MakeHome.test.ts`

- [ ] **Step 5.3.1: Rewrite the page test file**

Replace the entire body of `tests/ui/pages/make/MakeHome.test.ts` (keep imports, adjust as needed). The new structure has three scenarios:

```ts
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeHome from '../../../../src/ui/pages/make/MakeHome.vue';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeHomePage } from '../../../../src/ui/pages/make/MakeHome.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef, KpiSnapshot } from '../../../../src/domain/make/types.js';
import type { MakeService } from '../../../../src/modules/make/make-service.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',  title: 'Dune',  createdAt: '2026-04-19T10:00:00.000Z', updatedAt: '2026-04-19T10:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuro.md', title: 'Neuro', createdAt: '2026-04-18T12:00:00.000Z', updatedAt: '2026-04-18T12:00:00.000Z' };

const EMPTY_KPIS:  KpiSnapshot = { typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {},           recentlyCreated: [] };
const TYPES_ONLY:  KpiSnapshot = { typesCount: 1, instancesCount: 0, createdThisWeek: 0, perType: { book: 0 }, recentlyCreated: [] };
const POPULATED:   KpiSnapshot = { typesCount: 1, instancesCount: 12, createdThisWeek: 3, perType: { book: 12 }, recentlyCreated: [DUNE, NEURO] };

const NOW = new Date('2026-04-19T12:00:00.000Z');
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

async function mountHome(opts: {
	listTypes?: MakeService['listTypes'];
	getKpis?:   MakeService['getKpis'];
	openInstance?: MakeService['listInstances']; // placeholder; we'll spy on store directly below
} = {}) {
	const listTypes = opts.listTypes ?? vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
	const getKpis   = opts.getKpis   ?? vi.fn().mockResolvedValue(POPULATED);
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ listTypes, getKpis }),
		settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] },
	});
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make', component: MakeHome },
			{ path: '/make/types', component: MakeTypes },
			{ path: '/make/types/new', component: { template: '<div/>' } },
		],
	});
	await router.push('/make');
	await router.isReady();
	const pinia = createPinia();
	setActivePinia(pinia);
	const wrapper = mountWithI18n(MakeHome, {
		router,
		provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		plugins: [pinia],
	});
	const store = useMakeStore();
	return { wrapper, router, page: new MakeHomePage(wrapper.element as HTMLElement), store };
}

describe('MakeHome — existing behaviors preserved', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('renders title and blurb', async () => {
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.title).toContain('Make');
		expect(page.blurb.length).toBeGreaterThan(0);
	});

	it('shows empty-state copy + CTA when 0 types', async () => {
		const { page } = await mountHome({ listTypes: vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } }), getKpis: vi.fn().mockResolvedValue(EMPTY_KPIS) });
		await new Promise((r) => setTimeout(r, 0));
		expect(page.empty).not.toBeNull();
		expect(page.createCtaEmpty).not.toBeNull();
		expect(page.createCtaEmpty?.getAttribute('href')).toBe('/make/types/new');
	});

	it('shows Browse + Create CTAs when types exist', async () => {
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.browseCta).not.toBeNull();
		expect(page.createCtaPopulated).not.toBeNull();
	});

	it('favorites chips render for favorites present in types', async () => {
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.favoriteChips.length).toBe(1);
		expect(page.favoriteChips[0]?.textContent).toContain('Book');
	});
});

describe('MakeHome — KPI row', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('does NOT render KPI row in the 0-types branch', async () => {
		const { page } = await mountHome({ listTypes: vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } }), getKpis: vi.fn().mockResolvedValue(EMPTY_KPIS) });
		await new Promise((r) => setTimeout(r, 0));
		expect(page.kpiTypes).toBeNull();
	});

	it('renders 3 KPI tiles when types exist — Types / Instances / This week — with correct values', async () => {
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.kpiTypes).not.toBeNull();
		expect(page.kpiInstances).not.toBeNull();
		expect(page.kpiWeek).not.toBeNull();
		expect(page.kpiTypes?.textContent).toContain('1');
		expect(page.kpiInstances?.textContent).toContain('12');
		expect(page.kpiWeek?.textContent).toContain('3');
	});

	it('renders zeros in KPI tiles when types exist but 0 instances (TYPES_ONLY snapshot)', async () => {
		const { page } = await mountHome({ getKpis: vi.fn().mockResolvedValue(TYPES_ONLY) });
		await new Promise((r) => setTimeout(r, 0));
		expect(page.kpiTypes?.textContent).toContain('1');
		expect(page.kpiInstances?.textContent).toContain('0');
		expect(page.kpiWeek?.textContent).toContain('0');
	});
});

describe('MakeHome — Recently created section', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('does NOT render section in the 0-types branch', async () => {
		const { page } = await mountHome({ listTypes: vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } }), getKpis: vi.fn().mockResolvedValue(EMPTY_KPIS) });
		await new Promise((r) => setTimeout(r, 0));
		expect(page.recentHeading).toBeNull();
	});

	it('renders heading + placeholder when types exist but 0 instances', async () => {
		const { page } = await mountHome({ getKpis: vi.fn().mockResolvedValue(TYPES_ONLY) });
		await new Promise((r) => setTimeout(r, 0));
		expect(page.recentHeading).not.toBeNull();
		expect(page.recentEmpty).not.toBeNull();
		expect(page.recentEmpty?.textContent?.length).toBeGreaterThan(0);
	});

	it('renders rows for the kpis.recentlyCreated list in order', async () => {
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.recentRows).toHaveLength(2);
		expect(page.recentRows[0]!.textContent).toContain('Dune');
		expect(page.recentRows[1]!.textContent).toContain('Neuro');
	});

	it('row click calls store.openInstance with the correct path and tab mode', async () => {
		const { wrapper, page, store } = await mountHome();
		const openSpy = vi.spyOn(store, 'openInstance').mockResolvedValue({ kind: 'ok', value: undefined });
		await new Promise((r) => setTimeout(r, 0));
		(page.recentRows[0] as HTMLElement).click();
		await new Promise((r) => setTimeout(r, 0));
		expect(openSpy).toHaveBeenCalledWith('Books/Dune.md', 'tab');
		wrapper.unmount();
	});

	it('row keyboard Enter calls store.openInstance with the correct path and tab mode', async () => {
		const { wrapper, page, store } = await mountHome();
		const openSpy = vi.spyOn(store, 'openInstance').mockResolvedValue({ kind: 'ok', value: undefined });
		await new Promise((r) => setTimeout(r, 0));
		(page.recentRows[0] as HTMLElement).focus();
		(page.recentRows[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await new Promise((r) => setTimeout(r, 0));
		expect(openSpy).toHaveBeenCalledWith('Books/Dune.md', 'tab');
		wrapper.unmount();
	});
});

describe('MakeHome — mount calls loadKpis', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('calls service.getKpis at mount (when types exist)', async () => {
		const getKpis = vi.fn().mockResolvedValue(POPULATED);
		await mountHome({ getKpis });
		await new Promise((r) => setTimeout(r, 0));
		expect(getKpis).toHaveBeenCalled();
	});
});
```

Test count: 4 existing behaviors + 3 KPI + 5 Recent + 1 mount = 13. Previous file had 12 tests. Net: 13 new, 12 removed → +1 delta. The Chunk 0 table projected net +4 — update after running to real value.

- [ ] **Step 5.3.2: Run tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/pages/make/MakeHome.test.ts --project unit
```
Expected: multiple FAILs (page selectors + behavior changes).

- [ ] **Step 5.3.3: Rewrite `MakeHome.vue`**

Replace the entire `<script setup>` + `<template>` + `<style>` blocks of `src/ui/pages/make/MakeHome.vue` with:

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';
import KpiCard from '../../components/make/KpiCard.vue';
import RecentInstancesList from '../../components/make/RecentInstancesList.vue';

const { t } = useI18n();
const store = useMakeStore();
const { typesLoading, types, favoriteTypes, kpis, kpisLoading } = storeToRefs(store);

onMounted(() => {
	void store.loadTypes();
	void store.loadKpis();
});

const hasTypes = computed<boolean>(() => types.value.length > 0);

// Build typeNamesById from the cached types list for the chip fallback lookup.
const typeNamesById = computed<Record<string, string>>(() => {
	const out: Record<string, string> = {};
	for (const t2 of types.value) out[t2.id] = t2.name;
	return out;
});

function onOpenInstance(path: string): void {
	void store.openInstance(path, 'tab');
}
</script>

<template>
	<div class="make-home">
		<header class="make-home__header">
			<h1 data-testid="make-home-title">{{ t('make.home.title') }}</h1>
			<div v-if="hasTypes" class="make-home__header-actions">
				<router-link
					data-testid="make-home-browse-cta"
					to="/make/types"
					class="make-home__cta make-home__cta--secondary"
				>
					{{ t('make.home.browseTypesCta') }}
				</router-link>
				<router-link
					data-testid="make-home-create-cta-populated"
					to="/make/types/new"
					class="make-home__cta"
				>
					{{ t('make.type.create.cta') }}
				</router-link>
			</div>
		</header>

		<p data-testid="make-home-blurb" class="make-home__blurb">{{ t('make.home.blurb') }}</p>

		<div v-if="typesLoading" data-testid="make-home-spinner" class="make-home__spinner">Loading…</div>

		<div v-else-if="!hasTypes" class="make-home__empty">
			<p data-testid="make-home-empty">{{ t('make.home.empty') }}</p>
			<router-link
				data-testid="make-home-create-cta-empty"
				to="/make/types/new"
				class="make-home__cta"
			>
				{{ t('make.type.create.cta') }}
			</router-link>
		</div>

		<template v-else>
			<section class="make-home__kpis" role="group" :aria-label="t('make.home.title')">
				<KpiCard :label="t('make.home.kpi.types')"           :value="kpis?.typesCount ?? 0"     testid="kpi-types"     :loading="kpis === null" />
				<KpiCard :label="t('make.home.kpi.instances')"       :value="kpis?.instancesCount ?? 0" testid="kpi-instances" :loading="kpis === null" />
				<KpiCard :label="t('make.home.kpi.createdThisWeek')" :value="kpis?.createdThisWeek ?? 0" testid="kpi-week"      :loading="kpis === null" />
			</section>

			<section class="make-home__recent">
				<h2 data-testid="make-home-recent-heading" class="make-home__section-heading">{{ t('make.home.recent.heading') }}</h2>
				<RecentInstancesList
					:instances="kpis?.recentlyCreated ?? []"
					:type-names-by-id="typeNamesById"
					:empty-placeholder="t('make.home.recent.empty')"
					:loading="kpisLoading"
					@open="onOpenInstance"
				/>
			</section>

			<section v-if="favoriteTypes.length > 0" class="make-home__favorites">
				<h2 data-testid="make-home-favorites-heading" class="make-home__section-heading">{{ t('make.home.favoritesHeading') }}</h2>
				<ul class="make-home__chips">
					<li v-for="t2 in favoriteTypes" :key="t2.id">
						<router-link
							:data-testid="`favorite-chip-${t2.id}`"
							:to="`/make/types/${t2.id}`"
							class="make-home__chip"
						>
							{{ t2.name }}
						</router-link>
					</li>
				</ul>
			</section>
		</template>
	</div>
</template>

<style scoped>
.make-home { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 1rem; }
.make-home__header { display: flex; justify-content: space-between; align-items: center; }
.make-home__header h1 { margin: 0; font-size: 1.25rem; }
.make-home__header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.make-home__blurb { color: var(--text-muted); margin: 0; }
.make-home__spinner { color: var(--text-muted); }
.make-home__cta { display: inline-block; padding: 0.375rem 0.75rem; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; text-decoration: none; font-size: 0.875rem; }
.make-home__cta--secondary { background: var(--interactive-normal); color: var(--text-normal); }
.make-home__empty { color: var(--text-muted); display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.make-home__empty p { margin: 0; }
.make-home__kpis { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.make-home__section-heading { font-size: 0.875rem; color: var(--text-muted); margin: 0 0 0.5rem 0; text-transform: uppercase; letter-spacing: 0.05em; }
.make-home__chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; }
.make-home__chip { display: inline-block; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; font-size: 0.75rem; color: var(--text-normal); text-decoration: none; }
</style>
```

Key layout changes:
1. **Header row** with title left + CTAs right (only when `hasTypes`). CTAs move out of their prior standalone block.
2. **KPIs** section renders only when `hasTypes` — each card reads from `kpis?.field ?? 0` with `loading` flag tied to `kpis === null`.
3. **Recently created** section (renders only when `hasTypes`) — uses the list component with the computed `typeNamesById`.
4. **Favorites** section (existing, unchanged visually) stays below.
5. Empty state (no types) keeps the existing block (blurb + create CTA).

- [ ] **Step 5.3.4: Run page tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/pages/make/MakeHome.test.ts --project unit
```
Expected: all tests pass.

- [ ] **Step 5.3.5: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files 108 passed (108)`, `Tests 1049 passed` (net +4 from rewriting MakeHome.test.ts: 13 new tests − 12 removed = +1 delta from the spec's 12 baseline, actually 16 new − 12 removed = +4 per the table). Lint: 0.

- [ ] **Step 5.3.6: Commit**

```bash
git add "01 - Projects/Agentonomous/src/ui/pages/make/MakeHome.vue" "01 - Projects/Agentonomous/src/ui/pages/make/MakeHome.po.ts" "01 - Projects/Agentonomous/tests/ui/pages/make/MakeHome.test.ts" "01 - Projects/Agentonomous/src/modules/make/locales/en.json"
git commit -m "$(cat <<'EOF'
feat(agentonomous): MakeHome restructured as dashboard (Chunk 5 #5)

Top-to-bottom layout when ≥1 type exists:
  - Header row: title + CTAs (Browse / Create) on the right
  - KPI row: 3× KpiCard (Types / Instances / This week)
  - Recently created: ≤10 rows via RecentInstancesList, click opens tab
  - Favorites strip (existing, unchanged)

Zero-types branch preserves the existing empty-state block with single
Create CTA. Rows are keyboard-focusable (tabindex=0, Enter triggers
open).

PageObject extended with kpi-*, recent-heading, recent-empty, and
recent-rows selectors. i18n adds 5 new make.home.* keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 6: Commands + navigation bridge

Add `Make: create new type` and `Make: browse types` commands. Since `CommandEntry.callback` is declared at module-definition time (no access to `ports`, `router`, or Vue internals), we introduce a **module-scope navigation handler** that the Vue app registers on mount and clears on destroy.

### Task 6.1: Navigation bridge in `make-module.ts` (TDD)

**Files:**
- Modify: `src/modules/make/make-module.ts`
- Modify: `tests/modules/make/make-module.test.ts`

- [ ] **Step 6.1.1: Write the failing test**

Append to `tests/modules/make/make-module.test.ts` (after the existing `getMakeModuleState subscribe` describe block). Extend the existing top-of-file imports with `setMakeNavigateHandler` and `clearMakeNavigateHandler`:

```ts
import { MakeModule, getMakeModuleState, VIEW_TYPE_MAKE, setMakeNavigateHandler, clearMakeNavigateHandler } from '../../../src/modules/make/make-module.js';
```

Then add:

```ts
describe('MakeModule commands', () => {
	it('declares exactly three commands with ids: open-make, make-create-type, make-browse-types', () => {
		const ids = (MakeModule.commands ?? []).map((c) => c.id);
		expect(ids).toEqual(['open-make', 'make-create-type', 'make-browse-types']);
	});

	it('make-create-type command callback invokes the registered navigate handler with "/make/types/new"', async () => {
		const navigate = vi.fn();
		setMakeNavigateHandler(navigate);
		const cmd = (MakeModule.commands ?? []).find((c) => c.id === 'make-create-type');
		expect(cmd).toBeDefined();
		await cmd!.callback?.();
		expect(navigate).toHaveBeenCalledWith('/make/types/new');
		clearMakeNavigateHandler();
	});

	it('make-browse-types command callback invokes the registered navigate handler with "/make/types"', async () => {
		const navigate = vi.fn();
		setMakeNavigateHandler(navigate);
		const cmd = (MakeModule.commands ?? []).find((c) => c.id === 'make-browse-types');
		expect(cmd).toBeDefined();
		await cmd!.callback?.();
		expect(navigate).toHaveBeenCalledWith('/make/types');
		clearMakeNavigateHandler();
	});

	it('command callbacks no-op safely when no navigate handler is registered', async () => {
		clearMakeNavigateHandler();
		const cmd = (MakeModule.commands ?? []).find((c) => c.id === 'make-create-type');
		// Should not throw.
		await expect(cmd!.callback?.()).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 6.1.2: Run tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-module.test.ts -t "MakeModule commands" --project unit
```
Expected: module-resolution FAIL (`setMakeNavigateHandler` not exported yet).

- [ ] **Step 6.1.3: Add the navigate handler + commands**

Edit `src/modules/make/make-module.ts`.

1. Add module-scope handler state + setter/clearer near the existing `let state: ModuleState | null = null;` declaration (around line 19):

```ts
let navigateHandler: ((path: string) => void) | null = null;

export function setMakeNavigateHandler(fn: (path: string) => void): void {
	navigateHandler = fn;
}

export function clearMakeNavigateHandler(): void {
	navigateHandler = null;
}

function navigate(path: string): void {
	if (navigateHandler !== null) navigateHandler(path);
}
```

**Why module-scope (not on `ModuleState`):** the handler must be set by the Vue app at mount time, which is orthogonal to `init()/destroy()`. The handler outlives a single `init` call on purpose (e.g., if the user changes settings and the module re-inits, the Vue app doesn't re-mount — we want the handler to survive).

2. Extend the `commands` array in `defineModule` (currently lines 86–89):

```ts
commands: [
	{ id: 'open-make', name: 'Open Make', opensView: VIEW_TYPE_MAKE,
	  ribbon: { icon: 'hammer', title: 'Make', visibleByDefault: true } },
	{ id: 'make-create-type', name: 'Make: create new type', opensView: VIEW_TYPE_MAKE,
	  callback: () => navigate('/make/types/new') },
	{ id: 'make-browse-types', name: 'Make: browse types', opensView: VIEW_TYPE_MAKE,
	  callback: () => navigate('/make/types') },
],
```

**Why both `opensView` AND `callback`:** looking at `obsidian-command-adapter.ts:19-22`, if `opensView` is set, the adapter **replaces** the callback with `viewRegistry.openView(…)`. To get both view-open AND route-navigation we need to update the adapter.

- [ ] **Step 6.1.4a: Write the failing adapter ordering test**

Create `tests/infrastructure/obsidian/obsidian-command-adapter.test.ts` (new file — check with `ls tests/infrastructure/obsidian/` first; if the directory doesn't exist, create it). The adapter currently has no tests; this is the first.

```ts
import { describe, it, expect, vi } from 'vitest';
import { ObsidianCommandAdapter } from '../../../src/infrastructure/obsidian/obsidian-command-adapter.js';
import type { ViewRegistryPort } from '../../../src/domain/views/view-registry-port.js';

function makeFakePlugin() {
	type AddedCommand = { id: string; name: string; callback: () => void };
	const addedCommands: AddedCommand[] = [];
	return {
		plugin: {
			addCommand: (c: AddedCommand) => { addedCommands.push(c); },
			addRibbonIcon: vi.fn(() => document.createElement('div')),
		} as never,
		addedCommands,
	};
}

function makeFakeViewRegistry(openImpl: () => Promise<void>): ViewRegistryPort {
	return {
		openView: vi.fn(async () => openImpl()),
	} as unknown as ViewRegistryPort;
}

describe('ObsidianCommandAdapter', () => {
	it('register: opensView-only command invokes viewRegistry.openView on execute', async () => {
		const { plugin, addedCommands } = makeFakePlugin();
		const viewRegistry = makeFakeViewRegistry(async () => {});
		const adapter = new ObsidianCommandAdapter(plugin, viewRegistry);
		adapter.register({ id: 'x', name: 'X', opensView: 'MY_VIEW' });
		expect(addedCommands).toHaveLength(1);
		addedCommands[0]!.callback();
		await new Promise((r) => setTimeout(r, 0));
		expect(viewRegistry.openView).toHaveBeenCalledWith(plugin, 'MY_VIEW');
	});

	it('register: opensView + callback runs view open BEFORE user callback (awaited ordering)', async () => {
		const order: string[] = [];
		const { plugin, addedCommands } = makeFakePlugin();
		const viewRegistry = makeFakeViewRegistry(async () => {
			await new Promise((r) => setTimeout(r, 10));
			order.push('view-open');
		});
		const userCallback = vi.fn(async () => { order.push('user-callback'); });
		const adapter = new ObsidianCommandAdapter(plugin, viewRegistry);
		adapter.register({ id: 'x', name: 'X', opensView: 'MY_VIEW', callback: userCallback });
		addedCommands[0]!.callback();
		await new Promise((r) => setTimeout(r, 30));
		expect(order).toEqual(['view-open', 'user-callback']);
		expect(userCallback).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 6.1.4b: Run the adapter tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/infrastructure/obsidian/obsidian-command-adapter.test.ts --project unit
```

Expected: the first test passes (current behavior is compatible), the second FAILs — current adapter REPLACES `callback` when `opensView` is set, so the user callback never runs. That's the bug we're fixing in 6.1.4c.

- [ ] **Step 6.1.4c: Update `obsidian-command-adapter.ts` to combine `opensView` and `callback`**

Edit `src/infrastructure/obsidian/obsidian-command-adapter.ts` (lines 16–28). Replace:

```ts
register(entry: CommandEntry): void {
	let callback = entry.callback ?? (() => {});

	if (entry.opensView !== undefined) {
		const viewType = entry.opensView;
		callback = () => { void this.viewRegistry.openView(this.plugin, viewType); };
	}

	this.plugin.addCommand({
		id: entry.id,
		name: entry.name,
		callback: () => { void callback(); },
	});
```

with:

```ts
register(entry: CommandEntry): void {
	const userCallback = entry.callback;
	const viewType = entry.opensView;
	const combined = async (): Promise<void> => {
		if (viewType !== undefined) {
			await this.viewRegistry.openView(this.plugin, viewType);
		}
		if (userCallback !== undefined) {
			await userCallback();
		}
	};

	this.plugin.addCommand({
		id: entry.id,
		name: entry.name,
		callback: () => { void combined(); },
	});
```

And similarly update the ribbon block just below to use `combined`:

```ts
if (entry.ribbon !== undefined) {
	const el = this.plugin.addRibbonIcon(
		entry.ribbon.icon,
		entry.ribbon.title,
		() => { void combined(); },
	);
	if (!entry.ribbon.visibleByDefault) {
		el.style.display = 'none';
	}
	this.ribbonElements.set(entry.id, el);
}
```

**Ordering guarantee:** view opens first, then callback runs (so the Vue app is mounted and the nav handler is registered before the route push).

- [ ] **Step 6.1.5: Run the new command + adapter tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/modules/make/make-module.test.ts tests/infrastructure/obsidian/obsidian-command-adapter.test.ts --project unit
```
Expected: all command tests (4) + both adapter tests (2) pass.

### Task 6.2: Register the navigate handler in `src/ui/app.ts` (TDD)

**Files:**
- Modify: `src/ui/app.ts`
- Modify: `tests/ui/app.test.ts` (if it exists — check with `ls`; if not, create)

**Why `src/ui/app.ts`:** this is the only file that installs the router (`vue.use(router)` at line 21). `createModuleVueApp` installs no router — it's for sidebar panels that don't route. The Make view mounts through `createVueApp` in `app.ts`. Registration on mount, cleanup on unmount.

- [ ] **Step 6.2.1: Write the failing wiring test**

Check whether `tests/ui/app.test.ts` exists:
```bash
cd "01 - Projects/Agentonomous" && ls tests/ui/app.test.ts 2>&1 | head -1
```

If not, create it. If it exists, append.

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createVueApp } from '../../src/ui/app.js';
import * as makeModule from '../../src/modules/make/make-module.js';
import type { PluginContext } from '../../src/plugin.js';

describe('createVueApp — Make navigate handler wiring', () => {
	let el: HTMLElement;
	let setSpy: ReturnType<typeof vi.spyOn>;
	let clearSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		el = document.createElement('div');
		document.body.appendChild(el);
		setSpy   = vi.spyOn(makeModule, 'setMakeNavigateHandler');
		clearSpy = vi.spyOn(makeModule, 'clearMakeNavigateHandler');
	});

	afterEach(() => {
		el.remove();
		vi.restoreAllMocks();
	});

	function makeFakePluginContext(): PluginContext {
		return {
			plugin:        { manifest: { version: '0.0.0' } },
			settings:      { load: async () => ({}), save: async () => {}, onChange: () => () => {} },
			eventBus:      { on: () => () => {}, onAny: () => () => {}, emit: () => {}, emitAsync: async () => {}, listenerCount: () => 0 },
			moduleStatus:  [],
			commands:      { register: () => {}, unregisterAll: () => {} },
			viewRegistry:  { register: () => {}, openView: async () => {}, deregisterAll: () => {} },
			logger:        { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
			notifications: { success: () => {}, info: () => {}, warn: () => {}, error: () => {} },
			t:             { t: (k: string) => k },
			platform:      { isMobile: () => false, isMac: () => false },
			vault:         { exists: async () => false, read: async () => ({ kind: 'ok', value: { content: '', stat: { ctime: 0, mtime: 0 } } }), create: async () => ({ kind: 'ok', value: undefined }), update: async () => ({ kind: 'ok', value: undefined }), delete: async () => ({ kind: 'ok', value: undefined }), rename: async () => ({ kind: 'ok', value: undefined }), list: async () => ({ kind: 'ok', value: [] }), watch: () => () => {} },
			fileExtensions: { resolveForExtension: () => null },
			workspace:     { openFile: async () => ({ kind: 'ok', value: undefined }) },
		} as unknown as PluginContext;
	}

	it('setMakeNavigateHandler is called with a function on mount', () => {
		const app = createVueApp(makeFakePluginContext(), el);
		expect(setSpy).toHaveBeenCalledTimes(1);
		expect(typeof setSpy.mock.calls[0]![0]).toBe('function');
		app.unmount();
	});

	it('clearMakeNavigateHandler is called on unmount', () => {
		const app = createVueApp(makeFakePluginContext(), el);
		expect(clearSpy).not.toHaveBeenCalled();
		app.unmount();
		expect(clearSpy).toHaveBeenCalledTimes(1);
	});
});
```

**Note:** the `PluginContext` fake shape above is a best-effort skeleton — the real shape lives at `src/plugin.ts`. If extra fields are required to satisfy `createVueApp` at mount, copy the shape from the closest existing test (`tests/ui/router/make-routes.test.ts` or similar). The test's point is the `setSpy`/`clearSpy` assertions, not reproducing the whole plugin.

- [ ] **Step 6.2.2: Run the tests to verify they fail**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/app.test.ts --project unit
```
Expected: both tests FAIL (setSpy / clearSpy never called).

- [ ] **Step 6.2.3: Wire the handler into `createVueApp`**

Edit `src/ui/app.ts`. Add the import near the top (after the existing `createMakeContext` import):

```ts
import { setMakeNavigateHandler, clearMakeNavigateHandler } from '../modules/make/make-module.js';
```

Then, after `vue.use(router)` (currently line 21), add:

```ts
setMakeNavigateHandler((path) => { void router.push(path); });
```

In the returned `unmount` function (currently lines 45–48), add a clear call BEFORE `vue.unmount()`:

```ts
return {
	unmount: () => {
		clearMakeNavigateHandler();
		settingsStore.dispose();
		vue.unmount();
	},
};
```

- [ ] **Step 6.2.4: Run the tests to verify they pass**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run tests/ui/app.test.ts --project unit
```
Expected: both tests pass. If they fail on the `PluginContext` fake, iterate on the fake shape using the existing test precedents as reference.

- [ ] **Step 6.2.5: Manual smoke (optional, post-merge)**

After the chunk is merged: `npm run build:deploy`, open Obsidian, run `Make: create new type` via command palette → view opens → navigates to `/make/types/new`. Then run `Make: browse types` → `/make/types`. Any route-open hiccup lands a follow-up issue.

### Task 6.3: Run the full gate

- [ ] **Step 6.3.1: Full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files 109 passed (109)`, `Tests 1057 passed` (+4 command decls, +2 adapter ordering, +2 app.ts wiring = +8 from end-of-Chunk-5 1049). Lint: 0. Typecheck: clean.

- [ ] **Step 6.3.2: Commit**

```bash
git add "01 - Projects/Agentonomous/src/modules/make/make-module.ts" "01 - Projects/Agentonomous/src/infrastructure/obsidian/obsidian-command-adapter.ts" "01 - Projects/Agentonomous/src/ui/app.ts" "01 - Projects/Agentonomous/tests/modules/make/make-module.test.ts" "01 - Projects/Agentonomous/tests/infrastructure/obsidian/obsidian-command-adapter.test.ts" "01 - Projects/Agentonomous/tests/ui/app.test.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): Make: create-type + browse-types commands (Chunk 5 #6)

Adds two new command-palette entries:
- Make: create new type → opens view, navigates to /make/types/new
- Make: browse types   → opens view, navigates to /make/types

Mechanism: module-scope navigate handler (setMakeNavigateHandler /
clearMakeNavigateHandler). Registered in src/ui/app.ts:createVueApp
on mount (with a closure over the router) and cleared on unmount.
Command callbacks invoke the handler, which no-ops safely if no handler
is registered. Ribbon unchanged (1 icon).

Updates obsidian-command-adapter to chain opensView + callback (previously
opensView replaced the callback) so commands can both open the view and
perform a follow-up action. New adapter test asserts view-open runs
BEFORE user callback (await-ordering load-bearing for the nav push).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 7: Storybook stories for `MakeHome`

Extend the existing `stories/pages/make/MakeHome.stories.ts` (currently has `Default`, `Loading`, `Empty`) to cover the new dashboard layout states. The file already has a working `seedStore` Pinia decorator — reuse it.

### Task 7.1: Extend `MakeHome.stories.ts`

**Files:**
- Modify: `stories/pages/make/MakeHome.stories.ts`

- [ ] **Step 7.1.1: Rewrite the story file**

Replace the full contents of `stories/pages/make/MakeHome.stories.ts` with:

```ts
import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import MakeHome from '../../../src/ui/pages/make/MakeHome.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef, KpiSnapshot } from '../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',         title: 'Dune',        createdAt: '2026-04-19T10:00:00.000Z', updatedAt: '2026-04-19T10:00:00.000Z' };
const FOUND: InstanceRef = { typeId: 'book', path: 'Books/Foundation.md',   title: 'Foundation',  createdAt: '2026-04-18T12:00:00.000Z', updatedAt: '2026-04-18T12:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md',  title: 'Neuromancer', createdAt: '2026-04-17T09:00:00.000Z', updatedAt: '2026-04-17T09:00:00.000Z' };

const EMPTY_KPIS:   KpiSnapshot = { typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {},             recentlyCreated: [] };
const TYPES_ONLY:   KpiSnapshot = { typesCount: 1, instancesCount: 0, createdThisWeek: 0, perType: { book: 0 },   recentlyCreated: [] };
const POPULATED:    KpiSnapshot = { typesCount: 1, instancesCount: 12, createdThisWeek: 3, perType: { book: 12 }, recentlyCreated: [DUNE, FOUND, NEURO] };

function seedStore(seed: (s: ReturnType<typeof useMakeStore>) => void): Decorator {
	return (story) => ({
		setup() {
			const s = useMakeStore();
			seed(s);
			return {};
		},
		components: { Story: story() },
		template: '<Story />',
	});
}

const meta: Meta<typeof MakeHome> = {
	title: 'Pages/Make/MakeHome',
	component: MakeHome,
};
export default meta;
type Story = StoryObj<typeof MakeHome>;

/** 0 types — existing empty-state branch (no KPIs, no recent list). */
export const Empty: Story = {
	decorators: [seedStore((s) => {
		s.types = [];
		s.typesLoaded = true;
		s.kpis = EMPTY_KPIS;
	})],
};

/** Types list still loading (spinner state). */
export const Loading: Story = {
	decorators: [seedStore((s) => { s.typesLoading = true; })],
};

/** ≥1 type, 0 instances — KPIs show zeros; recent-list shows placeholder. */
export const TypesOnly: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK];
		s.typesLoaded = true;
		s.kpis = TYPES_ONLY;
	})],
};

/** Realistic numbers — KPIs populated, recent list showing 3 rows. */
export const Populated: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK];
		s.typesLoaded = true;
		s.kpis = POPULATED;
	})],
};
```

**Notes:**
- The `seedStore` decorator already exists in the file; we extend it by seeding the new `kpis` field as well.
- The `Default` story is renamed `Populated` (clearer) — matches the new layout semantics.
- `TypesOnly` is the new story covering the Q4 scenario 2 empty-placeholder branch.

- [ ] **Step 7.1.2: Optional storybook smoke**

```bash
cd "01 - Projects/Agentonomous" && npx vitest run --project storybook 2>&1 | tail -10
```
Storybook browser runner is known to flake on Windows. Zero failures or "Browser connection was closed" are both acceptable.

- [ ] **Step 7.1.3: Run the full gate**

```bash
cd "01 - Projects/Agentonomous" && npm test
```
Expected: `Test Files 109 passed (109)`, `Tests 1057 passed` (no new unit tests in Chunk 7). Lint: 0. Typecheck: clean.

- [ ] **Step 7.1.4: Commit**

```bash
git add "01 - Projects/Agentonomous/stories/pages/make/MakeHome.stories.ts"
git commit -m "$(cat <<'EOF'
feat(agentonomous): MakeHome storybook stories for dashboard layout (Chunk 5 #7)

Extends the existing seedStore-decorator story file with four states
covering the new dashboard layout:
  - Empty      — 0 types, existing empty-state branch
  - Loading    — typesLoading=true (existing)
  - TypesOnly  — ≥1 type, 0 instances, zero KPIs + recent-list placeholder
  - Populated  — realistic numbers, 3-row recent list

Previously-named 'Default' is renamed 'Populated' for clarity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done

End-state verification — run from git root:

```bash
cd "01 - Projects/Agentonomous" && npm test
git log --oneline | head -12
```

Expected:
- Tests: 1057, 109 files, 0 lint errors.
- 7 new commits since baseline `1c7cefd9`, one per chunk:
  1. `feat: format-relative-date util` (Chunk 5 #1)
  2. `feat: real getKpis implementation` (Chunk 5 #2)
  3. `feat: make-store kpis state + loadKpis + event-driven refresh` (Chunk 5 #3)
  4. `feat: KpiCard + RecentInstancesList components` (Chunk 5 #4)
  5. `feat: MakeHome restructured as dashboard` (Chunk 5 #5)
  6. `feat: Make: create-type + browse-types commands` (Chunk 5 #6)
  7. `feat: MakeHome storybook stories` (Chunk 5 #7)

---

## As shipped (reconciliation — 2026-04-19)

The plan was executed verbatim except for the following deviations, all
noted here for future readers of this document:

**Test counts**
- Predicted end state (this file): 109 files / 1057 tests.
- **Actual end state: 108 files / 1048 tests** (at commit `8793e5a5`, end
  of Chunk 7 / merge into master).
- Root causes:
  - Chunk 5 cumulative row predicted `net +4 tests (16 new − 12 removed)`,
    but the test file ended with 13 describes (net +1). The plan text at
    what was then Chunk 5's body (§5.1) itself admitted "+1 delta",
    contradicting the table at the top of the file. Plan arithmetic bug.
  - Chunk 6 predicted "+1 new file
    (`tests/infrastructure/obsidian/obsidian-command-adapter.test.ts`)"
    — that file already existed from commit `438900dc` with 8 tests.
    Chunk 6 appended 2 tests to it instead of creating a new file.

**Test file claim (§Chunk 6)**
- Plan line ~1604 said "Create `tests/infrastructure/obsidian/obsidian-command-adapter.test.ts` (new file — check with `ls` first; if the directory doesn't exist, create it). The adapter currently has no tests; this is the first." — **factually wrong**: the directory and file pre-existed with 8 tests. The implementer appended the 2 new ordering tests; no new file was created.

**Post-ship polish (separate branch, 8 commits on `feat/agentonomous-makehome-polish`)**
A multi-perspective review after this plan shipped surfaced post-ship
issues that were addressed in a follow-up polish branch (not in this
plan). Summary of changes visible to future readers of this code:
- Command names `Make: create new type` / `Make: browse types` were
  renamed to `Create new type` / `Browse types` (Obsidian auto-prefixes;
  the old names double-prefixed in the palette).
- `setMakeNavigateHandler` call site in `src/ui/app.ts` moved to **after**
  `vue.mount(el)` so a mount failure can't leak an orphan handler.
- `ObsidianCommandAdapter.combined()` now wraps each step (openView,
  callback) in its own try/catch + logger.error, and runs them
  independently (callback fires even if openView rejects).
- `RecentInstancesList` rows use `<li><div role="button" tabindex=0>`
  instead of `<li role="listitem" tabindex=0>` + the keyboard handler
  now activates on Space in addition to Enter.
- `getKpis` walks types in parallel (`Promise.all`) instead of serial.
- `loadKpis` wrapped in a trailing-debounce (`requestKpisRefresh`) —
  burst events coalesce to one call. Debounce window via
  `MakeContext.kpisDebounceMs` (production 150ms, tests 0ms).
- New i18n keys: `make.home.kpi.groupAriaLabel`, `make.home.loading`,
  `make.home.kpi.typesOne/Other`, `make.home.kpi.instancesOne/Other`.
- `ObsidianCommandAdapter` constructor now takes `(plugin, viewRegistry,
  logger)` — the old `(plugin, viewRegistry)` signature is gone.
- End state after polish merges: **1069 tests / 108 files / 0 lint errors**.

Plan stays here as the historical design-time artifact. For current
shape of the code, read the source.
