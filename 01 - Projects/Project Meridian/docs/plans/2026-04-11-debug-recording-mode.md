# Debug Recording Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ⏺ Record button to the debug panel that auto-captures simulation snapshots on every day-phase change and writes them to a markdown file when recording stops.

**Architecture:** Extend `OverlayDeps` with a `writeFile` function and an `onAny` event subscription. When record is clicked, subscribe to `DayPhaseChanged` events and append snapshots to an in-memory buffer. When stopped, write buffer to vault via `deps.writeFile` at `03 - Resources/Economy/Recordings/recording-YYYY-MM-DD-HHMM.md`.

**Tech Stack:** TypeScript, Obsidian Vault API, existing `buildDiagnosticSnapshot()` function.

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Wire Dependencies

### Task 1: Extend OverlayDeps interface

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts:21-31`

- [ ] **Step 1: Add writeFile and eventBus subscribe to OverlayDeps**

In `debug-overlay.ts`, extend the `OverlayDeps` interface (line 21-31) to add two optional fields:

```typescript
interface OverlayDeps {
	getAgents: () => AgentActor[];
	getWorldEntity: () => Actor;
	getLocations: () => WorldLocation[];
	getLocationActors: () => Map<string, Actor>;
	getTickCount: () => number;
	getTicksPerDay?: () => number;
	getItemRegistry?: () => Map<string, Item>;
	getEventBus?: () => { history: (opts?: { limit?: number }) => { type: string; tick: number; source: string; payload: Record<string, unknown> }[]; onAny?: (handler: (event: { type: string; tick: number; source: string; payload: Record<string, unknown> }) => void) => () => void };
	getConfig?: () => GameConfig;
	writeFile?: (path: string, content: string) => Promise<void>;
}
```

Note: `onAny` is added to the existing `getEventBus` return type as an optional method. The writeFile function is a new optional field.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "chore(meridian): extend OverlayDeps with writeFile and onAny"
```

---

### Task 2: Pass writeFile from game-view

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts:302-312`

- [ ] **Step 1: Pass writeFile when creating debug overlay**

In `game-view.ts`, find the `createDebugOverlay` call (around line 302). Update it to pass `writeFile` from `deps`:

```typescript
const debugOverlay = createDebugOverlay(container, {
	getAgents,
	getWorldEntity,
	getLocations,
	getLocationActors,
	getTickCount: () => deps.tickCount,
	getTicksPerDay: () => deps.config.ticks_per_day,
	getItemRegistry,
	getEventBus: () => deps.eventBus,
	getConfig: () => deps.config,
	writeFile: deps.writeFile ?? undefined,
});
```

Note: `deps.writeFile` is `((path, content) => Promise<void>) | null`, so we coerce null to undefined since OverlayDeps expects `undefined` for optional.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "chore(meridian): pass writeFile to debug overlay"
```

---

## Chunk 2: Recording Button and Logic

### Task 3: Add Record button to debug panel

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts:118` (copyBtn definition)

- [ ] **Step 1: Add record button HTML next to snapshot button**

In `debug-overlay.ts`, find the `copyBtn` const (line 118):

```typescript
const copyBtn = '<span class="meridian-copy-snapshot" style="cursor:pointer;padding:2px 8px;border-radius:4px;margin-left:auto;opacity:0.6;font-size:10px" title="Copy diagnostic snapshot to clipboard">📋 Snapshot</span>';
```

Replace with:

```typescript
const copyBtn = '<span class="meridian-copy-snapshot" style="cursor:pointer;padding:2px 8px;border-radius:4px;margin-left:auto;opacity:0.6;font-size:10px" title="Copy diagnostic snapshot to clipboard">📋 Snapshot</span><span class="meridian-record-toggle" style="cursor:pointer;padding:2px 8px;border-radius:4px;margin-left:4px;opacity:0.6;font-size:10px" title="Auto-record snapshots on every day-phase change">⏺ Record</span>';
```

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "feat(meridian): add ⏺ Record button to debug panel"
```

---

### Task 4: Implement recording state and click handler

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts` — click handler area (line 987-1012)

- [ ] **Step 1: Add recording state variables after `lastSnapshotTick`**

In `debug-overlay.ts`, find the state block (around line 982-985):

```typescript
let activePanel: Panel = 'agents';
const history: Snapshot[] = [];
const MAX_HISTORY = 60;
let lastSnapshotTick = -1;
```

Add after it:

```typescript
// Recording state
let isRecording = false;
let recordingBuffer: string[] = [];
let recordingUnsubscribe: (() => void) | null = null;
let recordingStartedAt: Date | null = null;
```

- [ ] **Step 2: Add recording click handler inside the `el.addEventListener('click', ...)` block**

Find the snapshot button handler (line 992-1002), and after it (before the tab switching logic), insert:

```typescript
// Record toggle button
if (clickTarget.closest('.meridian-record-toggle') !== null) {
	const btn = el.querySelector('.meridian-record-toggle');
	if (isRecording) {
		// Stop recording — write buffer to vault
		isRecording = false;
		if (recordingUnsubscribe !== null) {
			recordingUnsubscribe();
			recordingUnsubscribe = null;
		}
		if (deps.writeFile !== undefined && recordingStartedAt !== null && recordingBuffer.length > 0) {
			const d = recordingStartedAt;
			const pad = (n: number): string => n.toString().padStart(2, '0');
			const filename = `recording-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`;
			const path = `03 - Resources/Economy/Recordings/${filename}`;
			const content = recordingBuffer.join('\n\n---\n\n');
			void deps.writeFile(path, content).then(() => {
				if (btn !== null) {
					btn.textContent = '✅ Saved';
					setTimeout(() => { if (btn !== null) btn.textContent = '⏺ Record'; }, 2000);
				}
			}).catch(() => {
				if (btn !== null) {
					btn.textContent = '❌ Failed';
					setTimeout(() => { if (btn !== null) btn.textContent = '⏺ Record'; }, 2000);
				}
			});
		} else if (btn !== null) {
			btn.textContent = '⏺ Record';
		}
		recordingBuffer = [];
		recordingStartedAt = null;
	} else {
		// Start recording — subscribe to DayPhaseChanged
		const eventBus = deps.getEventBus?.();
		if (eventBus === undefined || eventBus.onAny === undefined || deps.writeFile === undefined) {
			if (btn !== null) {
				btn.textContent = '❌ Unavailable';
				setTimeout(() => { if (btn !== null) btn.textContent = '⏺ Record'; }, 2000);
			}
			return;
		}
		isRecording = true;
		recordingBuffer = [];
		recordingStartedAt = new Date();
		// Capture an initial snapshot so the recording starts with current state
		recordingBuffer.push(buildDiagnosticSnapshot(deps));
		recordingUnsubscribe = eventBus.onAny((event) => {
			if (event.type === 'DayPhaseChanged') {
				recordingBuffer.push(buildDiagnosticSnapshot(deps));
			}
		});
		if (btn !== null) {
			btn.textContent = '⏹ Stop';
			(btn as HTMLElement).style.color = '#ff6b6b';
		}
	}
	return;
}
```

- [ ] **Step 3: Restore button color on stop**

In the stop branch (where `btn.textContent = '✅ Saved'` and `'⏺ Record'` happen), also clear the red color:

Find these lines:

```typescript
btn.textContent = '✅ Saved';
setTimeout(() => { if (btn !== null) btn.textContent = '⏺ Record'; }, 2000);
```

Change the setTimeout line to also reset color:

```typescript
btn.textContent = '✅ Saved';
(btn as HTMLElement).style.color = '';
setTimeout(() => { if (btn !== null) btn.textContent = '⏺ Record'; }, 2000);
```

Apply the same `(btn as HTMLElement).style.color = '';` to the `❌ Failed` branch and the `else if (btn !== null)` fallback branch. This ensures the red color is cleared whenever recording stops.

- [ ] **Step 4: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all 1366 tests pass (debug overlay has no unit tests).

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "feat(meridian): implement recording mode — auto-snapshot on phase changes"
```

---

### Task 5: Clean up recording on overlay dispose

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts` — dispose function

- [ ] **Step 1: Find the dispose function**

In `debug-overlay.ts`, find where `createDebugOverlay` returns. The function currently returns a dispose handler (around end of function). Find the return statement.

Use Grep or Read to locate the `return` statement in `createDebugOverlay` that returns the dispose function.

- [ ] **Step 2: Call recordingUnsubscribe in dispose**

Update the dispose function to clean up the recording subscription if active. Add this line at the start of the dispose body (before whatever cleanup currently runs):

```typescript
if (recordingUnsubscribe !== null) {
	recordingUnsubscribe();
	recordingUnsubscribe = null;
}
```

This prevents the recording subscription from leaking if the overlay is disposed while recording is active. Note: the buffer is intentionally discarded — if the user is still recording when the game view closes, the in-progress recording is lost. This is acceptable — record-and-stop is the documented workflow.

- [ ] **Step 3: Run typecheck and tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/debug-overlay.ts"
git commit -m "feat(meridian): clean up recording subscription on overlay dispose"
```
