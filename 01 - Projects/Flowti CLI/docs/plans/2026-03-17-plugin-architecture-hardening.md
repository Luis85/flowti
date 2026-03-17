# Plugin Architecture Hardening — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs, restore event type safety, remove legacy dead code, correct layer violations, decompose the main.ts god file, and add infrastructure test coverage to the Flowti Plugin.

**Architecture:** Work proceeds P0→P3 in seven chunks. Each chunk leaves `npm test` green (7,903+ tests, 0 failures). Chunks 1, 3, 4, 5, 6 are independent after Chunk 0. **Chunk 2 depends on Chunk 1** (removing `as never` before removing legacy code exposes whether handlers actually emit defined events). Chunk 2 also requires careful audit before deletion — legacy view factories carry pending-state orchestration logic that handlers must replicate first.

**Smoke-test requirement:** Chunks 2 and 4 modify Obsidian UI wiring that `npm test` cannot fully validate. After these chunks, manually test in a live Obsidian instance: open each hub, create a session, import a CSV, run an export, open canvas import.

**Tech Stack:** TypeScript, Lit 3.x, Obsidian Plugin API, Vitest, EventBus

**Spec:** Based on the architecture review conducted 2026-03-17.

**All file paths are relative to:** `01 - Projects/Flowti Plugin/`

**Test command:** `npm test` (must pass after every chunk — 7,903+ tests, 0 failures)

**Type check:** `npx tsc --noEmit -skipLibCheck` (0 errors)

---

## Chunk 0: P0 Critical Bugs

### Task 0.1: Fix event listener leak on hot-reload

**Files:**
- Modify: `src/main.ts:388-390` (command.execute.request listener)
- Modify: `src/main.ts:794-808` (settings.changed listener)

**Context:** Two `eventBus.on()` calls discard their unsubscribe return values. All other listeners in the file store theirs in `this.crossCuttingListeners` (declared at line 171, cleaned in `onunload()` at lines 481-484). These two leak: after hot-reload the old handlers keep firing alongside the new ones. The `settings.changed` handler mutates inbox/analytics/session state from a stale closure. The `command.execute.request` handler calls a cleared command registry.

- [ ] **Step 1: Store the command.execute.request unsubscribe**

At `src/main.ts:388`, the current code is:
```typescript
this.eventBus.on("command.execute.request", (event) => {
	void this.commands.execute(event.payload.commandId, ctx);
});
```

Change to:
```typescript
this.crossCuttingListeners.push(
	this.eventBus.on("command.execute.request", (event) => {
		void this.commands.execute(event.payload.commandId, ctx);
	}),
);
```

- [ ] **Step 2: Store the settings.changed unsubscribe**

At `src/main.ts:794`, the current code is:
```typescript
this.eventBus.on("settings.changed", (event) => {
```

Wrap the entire block (lines 794-808) the same way:
```typescript
this.crossCuttingListeners.push(
	this.eventBus.on("settings.changed", (event) => {
		// ... existing body unchanged ...
	}),
);
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All 7,903+ tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "fix(plugin): store leaked eventBus listener unsubscribes in crossCuttingListeners"
```

---

### Task 0.2: Fix analytics data loss on load

**Files:**
- Modify: `src/domain/analytics/AnalyticsService.ts:97`
- Modify: `tests/domain/analytics/AnalyticsEngine.test.ts` (or create `tests/domain/analytics/AnalyticsService.test.ts`)

**Context:** `AnalyticsService.load()` restores saved state only when queries or dashboards exist. If a user has only measurements saved, the condition `saved.savedAnalyticsQueries?.length > 0 || saved.dashboards?.length > 0` is false, and measurements are silently dropped.

- [ ] **Step 1: Write failing test for measurements-only state restoration**

Find the test file for AnalyticsService (check `tests/domain/analytics/`). Add a test:

```typescript
it("restores saved state when only measurements exist", () => {
	const savedState = {
		savedAnalyticsQueries: [],
		dashboards: [],
		measurements: [{ id: "m1", name: "Test", query: "SELECT 1", createdAt: Date.now() }],
		tiles: [],
	};
	// Mock storage.load to return savedState
	// Call service.load()
	// Assert service state includes the measurement
});
```

Adapt to the existing test patterns in the file (mock setup, service construction).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/analytics/AnalyticsService.test.ts -t "measurements" -v`
Expected: FAIL — measurement is dropped.

- [ ] **Step 3: Fix the load condition**

At `src/domain/analytics/AnalyticsService.ts:97`, change:
```typescript
if (saved && (saved.savedAnalyticsQueries?.length > 0 || saved.dashboards?.length > 0)) {
```
To:
```typescript
if (saved && (
	(saved.savedAnalyticsQueries?.length ?? 0) > 0 ||
	(saved.dashboards?.length ?? 0) > 0 ||
	(saved.measurements?.length ?? 0) > 0
)) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/analytics/ -v`
Expected: All analytics tests pass including the new one.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/analytics/AnalyticsService.ts tests/domain/analytics/
git commit -m "fix(plugin): restore analytics state when only measurements exist"
```

---

### Task 0.3: Fix SessionService `as any` migration cast

**Files:**
- Modify: `src/domain/session/SessionService.ts:191-192`

**Context:** Line 192 uses `(s as any).type = "documentation"` where a typed assignment works since `Session.type` is defined. The `as any` suppresses type validation on the assigned value.

- [ ] **Step 1: Replace the cast**

At `src/domain/session/SessionService.ts:191-192`, change:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!s.type) (s as any).type = "documentation";
```
To:
```typescript
if (!s.type) (s as { type?: string }).type = "documentation";
```

Remove the eslint-disable comment.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/domain/session/SessionService.ts
git commit -m "fix(plugin): replace as-any cast with typed narrowing in session migration"
```

---

## Chunk 1: Restore Event Type Safety

### Task 1.1: Add missing UI events to UiCommandEventMap

**Files:**
- Modify: `src/infrastructure/ui/events.ts` (where `UiCommandEventMap` is defined)

**Important:** `UiCommandEventMap` is defined in `src/infrastructure/ui/events.ts`, NOT in `src/infrastructure/events/events.ts`. The latter only imports and re-exports it into `FlowtiEventMap`.

**Context:** The handler layer emits events via `as never` bypass. Many emitted events are not defined in any event map. These must be added to restore compile-time verification. The `UiCommandEventMap` in `src/infrastructure/ui/events.ts` is the correct location for UI navigation and interaction events.

**Missing events to add (based on handler analysis):**

From `user-handlers.ts`:
- `ui.navigateTab` — payload: `{ tabId: string }`
- `ui.openSessionWorkspace` — payload: `{ sessionId: string }`
- `ui.sessionSelected` — payload: `{ sessionId: string }`
- `ui.inboxItemSelected` — payload: `{ itemId: string }` (verify actual payload shape in handler)
- `ui.inboxAction` — payload: `{ itemId: string; action: string }` (verify shape)

From `data-exchange-handlers.ts`:
- Any `ui.*` events emitted there that aren't in the map (verify against existing entries)

- [ ] **Step 1: Audit all `as never` emissions and catalog missing events**

Search all handler files for `as never` patterns. For each emission, check whether the event name exists in `FlowtiEventMap`. Build a complete list of missing event names and their payload shapes (derived from the `emit()` call arguments).

Expected output: A table of ~15-20 missing event definitions.

- [ ] **Step 2: Add missing UI events to UiCommandEventMap**

In `src/infrastructure/ui/events.ts`, add each missing `ui.*` event to `UiCommandEventMap` with its correct payload type. Group related events together with section comments.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit -skipLibCheck`
Expected: 0 errors. This verifies the new types are structurally correct.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/ui/events.ts
git commit -m "feat(plugin): add missing UI events to UiCommandEventMap"
```

---

### Task 1.2: Add missing analytics events to AnalyticsEventMap

**Files:**
- Modify: `src/domain/analytics/events.ts`

**Context:** `analytics-handlers.ts` emits 10 `analytics.ui.*` events that don't exist in `AnalyticsEventMap`:
- `analytics.ui.addTile`
- `analytics.ui.removeTile`
- `analytics.ui.renameDashboard`
- `analytics.ui.navigateBreadcrumb`
- `analytics.ui.runQuery`
- `analytics.ui.saveQuery`
- `analytics.ui.deleteQuery`
- `analytics.ui.measurementSelected`
- `analytics.ui.createMeasurement`
- `analytics.ui.deleteMeasurement`

- [ ] **Step 1: Read analytics-handlers.ts to extract exact payload shapes**

For each `analytics.ui.*` emission, note the payload object passed to `emit()`.

- [ ] **Step 2: Add events to AnalyticsEventMap**

In `src/domain/analytics/events.ts`, add the 10 missing events with typed payloads.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit -skipLibCheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/domain/analytics/events.ts
git commit -m "feat(plugin): add missing analytics UI events to AnalyticsEventMap"
```

---

### Task 1.3: Add remaining missing events to domain maps

**Files:**
- Modify: various `src/domain/*/events.ts` files as needed

**Context:** Any remaining `as never` emissions that target domain-specific events (not `ui.*` or `analytics.ui.*`) need their event names added to the appropriate domain event map.

Check:
- `journey-builder-handler.ts:422` — `journey-builder.import-from-system`
- `data-exchange-handlers.ts` — any `dataExchange.*` events not in map
- `train-handlers.ts` — verify all `train.*` events exist
- `catalog-handlers.ts` — verify `catalog.*` events exist

- [ ] **Step 1: Audit remaining `as never` emissions against domain maps**

For each handler file, verify every emitted event name exists in its domain's event map.

- [ ] **Step 2: Add any missing events to the correct domain map**

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit -skipLibCheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/domain/*/events.ts
git commit -m "feat(plugin): add remaining missing events to domain event maps"
```

---

### Task 1.4: Remove `as never` casts from handler emissions

**Files:**
- Modify: `src/infrastructure/handlers/action-handlers.ts`
- Modify: `src/infrastructure/handlers/analytics-handlers.ts`
- Modify: `src/infrastructure/handlers/data-exchange-handlers.ts`
- Modify: `src/infrastructure/handlers/train-handlers.ts`
- Modify: `src/infrastructure/handlers/test-management-handlers.ts`
- Modify: `src/infrastructure/handlers/user-handlers.ts`
- Modify: `src/infrastructure/handlers/catalog-handlers.ts`
- Modify: `src/infrastructure/handlers/leaf-handlers/train-timeline-handler.ts`
- Modify: `src/infrastructure/handlers/leaf-handlers/journey-builder-handler.ts`
- Modify: `src/infrastructure/handlers/leaf-handlers/export-handler.ts`
- Modify: `src/bootstrap/dataExchangeSetup.ts`

**Context:** With all events now defined in their maps, the `as never` casts can be removed. The compiler will verify event names and payload shapes.

- [ ] **Step 1: Remove `as never` from action-handlers.ts**

Replace all `eventBus.emit("event.name" as never, payload as never)` with `eventBus.emit("event.name", payload)`. Let TypeScript verify the types.

- [ ] **Step 2: Remove `as never` from all remaining handler files**

Repeat for each file listed above. For each file:
1. Remove `as never` casts
2. Run `npx tsc --noEmit -skipLibCheck` to verify types
3. Fix any type mismatches revealed

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: All tests pass, 0 lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/handlers/ src/bootstrap/dataExchangeSetup.ts
git commit -m "refactor(plugin): remove as-never casts — all handler events now type-checked"
```

---

## Chunk 2: Legacy Dead Code Cleanup

**Dependency:** Chunk 2 depends on Chunk 1 completing first. Removing `as never` casts (Chunk 1) will reveal at compile time whether handler emissions target events that actually exist — confirming the handlers are functional replacements before we remove legacy code.

**Cross-dependency warning:** The `settings.changed` listener in `main.ts` (fixed in Task 0.1) references `SessionWorkspaceView` and `VIEW_TYPE_SESSION_WORKSPACE` imports. Do NOT remove those imports from `main.ts` during this chunk. They will be cleaned up in Chunk 4 when `main.ts` is decomposed.

**Audit-first principle:** Legacy view factories in `SessionSetup` and `DataExchangeSetup` carry active orchestration logic (pending-state handoff, service injection, analytics wiring). Before removing any view registration, verify that the sitemap-driven handler replicates the same functionality. If the handler is missing capabilities, add them first.

### Task 2.1: Remove legacy view registrations from SessionSetup

**Files:**
- Modify: `src/bootstrap/sessionSetup.ts`

**Context:** `SessionSetup.registerViews()` (line 53) registers `SessionWorkspaceView` for `VIEW_TYPE_SESSION_WORKSPACE` with injected `sessionService` and `trainService`. `SitemapBootstrap` already registers `SitemapLeafView` for the same view type (runs first at main.ts:381), so the legacy registration silently fails. The `session-workspace-handler.ts` handler must receive equivalent deps.

- [ ] **Step 1: Verify handler has equivalent service injection**

Read `src/infrastructure/handlers/leaf-handlers/session-workspace-handler.ts` and confirm it receives `sessionService` and `trainService` through its deps. Compare against the legacy `SessionWorkspaceView` constructor in `sessionSetup.ts:56-60`. If the handler is missing any service, add it before proceeding.

- [ ] **Step 2: Remove `registerViews()` method body from SessionSetup**

Only after Step 1 confirms parity. Remove the view registration call. If the method becomes empty, remove the method and its call site.

- [ ] **Step 3: Remove duplicate command registrations from SessionSetup**

Remove the command registrations for:
- `flowti:open-session-workspace` (line 69)
- `flowti:open-session-workspace-sidebar` (line 85)
- `flowti:create-session` (line 97)
- `flowti:resume-session` (line 120)

These are already registered by `SitemapBootstrap` via `plugin-sitemap.json`.

- [ ] **Step 4: Remove unused imports from SessionSetup only**

Remove imports of `SessionWorkspaceView`, `VIEW_TYPE_SESSION_WORKSPACE`, and any command-related imports that are no longer needed **in this file**. Do NOT touch `main.ts` imports.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/bootstrap/sessionSetup.ts
git commit -m "refactor(plugin): remove legacy view/command registrations from SessionSetup"
```

---

### Task 2.2: Remove legacy view registrations from DataExchangeSetup

**Files:**
- Modify: `src/bootstrap/dataExchangeSetup.ts`

**Context:** `DataExchangeSetup.registerViews()` (line 103) registers `CsvActionView`, `CanvasActionView`, `ExportView`. These registrations carry **active orchestration logic** — pending-state handoff (`pendingImportAutoStart`, `pendingSavedImportConfig`), analytics service wiring, and conditional service guards (`if (canvasService)`). They are NOT simple view type registrations.

**Critical: Do NOT delete view registrations blindly.** Each one must be audited against the corresponding leaf handler to verify the handler replicates the pending-state and service-injection logic. If it doesn't, the handler must be extended first.

- [ ] **Step 1: Audit each view factory against its handler replacement**

For each of `CsvActionView`, `CanvasActionView`, `ExportView`:
1. Read the factory in `dataExchangeSetup.ts` — note all pending-state logic, service injections, and analytics wiring
2. Read the corresponding leaf handler (`csv-action-handler.ts`, `canvas-import-handler.ts`, `export-handler.ts`)
3. Verify the handler has equivalent functionality
4. Document gaps (if any) — these must be filled before the factory can be removed

`CsvActionView` is a `fileView: true` entry — `SitemapBootstrap` skips it, so the legacy factory is still the only registration. This one CANNOT be removed until file-view routing is migrated to the handler pattern.

- [ ] **Step 2: Remove only superseded registrations where audit confirms parity**

Remove view factory calls only where the audit in Step 1 confirmed the handler replicates all logic. Keep any where gaps were found, and add TODOs for follow-up.

- [ ] **Step 3: Remove duplicate command registrations**

Remove commands already in `plugin-sitemap.json`:
- `flowti:import-csv` (line 342)
- `flowti:export-csv` (line 351)
- `flowti:export-tab` (line 360)
- `flowti:open-data-exchange` (line 369)
- `flowti:signal-sync` (line 379)
- `flowti:import-canvas` (line 390)

- [ ] **Step 4: Remove unused imports**

Remove imports only for classes whose registrations were actually removed in Step 2.

- [ ] **Step 5: Run tests + smoke-test in Obsidian**

Run: `npm test`
Expected: All tests pass.

Then manually test in a live Obsidian instance:
- Open a CSV file (should route to the CSV action view)
- Open canvas import (should render via handler)
- Open export (should render via handler)

- [ ] **Step 6: Commit**

```bash
git add src/bootstrap/dataExchangeSetup.ts
git commit -m "refactor(plugin): remove legacy view/command registrations from DataExchangeSetup"
```

---

### Task 2.3: Remove legacy CommandRegistry overlap

**Files:**
- Modify: `src/infrastructure/commands/registry.ts`

**Context:** `createCommandDefinitions()` registers commands like `flowti:open-event-catalog`, `flowti:open-user-hub`, etc. These overlap with SitemapBootstrap commands. The old CommandRegistry runs first (main.ts:232) and wins, making the SitemapBootstrap registrations inert. We should remove the overlapping entries from the old registry so the sitemap-driven commands are the authority.

- [ ] **Step 1: List commands registered in both CommandRegistry and plugin-sitemap.json**

Compare `src/infrastructure/commands/registry.ts` against `plugin-sitemap.json` commands section. Identify duplicates.

- [ ] **Step 2: Remove duplicates from CommandRegistry**

For each command that exists in `plugin-sitemap.json`, remove it from `createCommandDefinitions()`. Keep any commands that are NOT in the sitemap (if any).

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/commands/registry.ts
git commit -m "refactor(plugin): remove duplicate command registrations — sitemap is now the authority"
```

---

### Task 2.4: Remove dead legacy view classes

**Files:**
- Delete (or mark deprecated): `src/ui/canvas/CanvasActionView.ts` (if no longer registered)
- Delete (or mark deprecated): `src/ui/export/ExportView.ts` (if no longer registered)
- Evaluate: `src/ui/session/SessionWorkspaceView.ts`
- Evaluate: `src/ui/train/TrainMainView.ts` (keep VIEW_TYPE_TRAIN_MAIN export)
- Evaluate: `src/ui/train/TrainTimelineSidebar.ts` (keep VIEW_TYPE_TRAIN_TIMELINE export)

**Context:** After Tasks 2.1-2.3, some legacy view classes are no longer instantiated anywhere. They can be deleted. However, some export VIEW_TYPE constants that are still used — extract those constants to `types.ts` files first.

- [ ] **Step 1: Verify no remaining references to legacy view classes**

For each class (`CanvasActionView`, `ExportView`, `SessionWorkspaceView`), grep for imports and instantiations. If only the VIEW_TYPE constant is used, the class itself is dead.

- [ ] **Step 2: Extract VIEW_TYPE constants if needed**

If a legacy file exports a VIEW_TYPE constant that's still imported elsewhere, move the constant to an existing `types.ts` in the same directory (or create one).

- [ ] **Step 3: Delete unused legacy view files**

Delete files that are no longer imported anywhere.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A src/ui/
git commit -m "refactor(plugin): delete dead legacy view classes after sitemap migration"
```

---

## Chunk 3: Layer Violation Fixes

### Task 3.1: Move InstallerWizardModal to UI layer

**Files:**
- Move: `src/domain/installer/InstallerWizardModal.ts` → `src/ui/modals/InstallerWizardModal.ts`
- Modify: all importers of `InstallerWizardModal` (update import paths)

**Context:** `InstallerWizardModal` extends Obsidian's `Modal` class and imports `App, Modal, Setting, setIcon` from `obsidian`. This is a UI concern that belongs in `src/ui/`, not `src/domain/installer/`.

- [ ] **Step 1: Find all files importing InstallerWizardModal**

Grep for `InstallerWizardModal` across the codebase.

- [ ] **Step 2: Move the file**

Move `src/domain/installer/InstallerWizardModal.ts` to `src/ui/modals/InstallerWizardModal.ts`.

- [ ] **Step 3: Update all import paths**

In every file that imports `InstallerWizardModal`, update the import path to the new location.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/installer/ src/ui/modals/
git commit -m "refactor(plugin): move InstallerWizardModal to UI layer"
```

---

### Task 3.2: Move FlowtiSettingTab to UI layer

**Files:**
- Move: `src/domain/settings/FlowtiSettingTab.ts` → `src/ui/settings/FlowtiSettingTab.ts`
- Modify: all importers (update import paths)

**Context:** `FlowtiSettingTab` extends Obsidian's `PluginSettingTab` and imports UI classes. It belongs in the UI layer.

- [ ] **Step 1: Find all files importing FlowtiSettingTab**

Grep for `FlowtiSettingTab` across the codebase.

- [ ] **Step 2: Move the file**

Move `src/domain/settings/FlowtiSettingTab.ts` to `src/ui/settings/FlowtiSettingTab.ts`.

- [ ] **Step 3: Update all import paths**

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings/ src/ui/settings/
git commit -m "refactor(plugin): move FlowtiSettingTab to UI layer"
```

---

### Task 3.3: Extract workspace navigation from HubRegistry

**Files:**
- Modify: `src/domain/hub/HubRegistry.ts`

**Context:** `HubRegistry.openHub()` at lines 59-64 directly calls `this.app.workspace.getLeavesOfType()`, `this.app.workspace.getLeaf("tab")`, and `this.app.workspace.revealLeaf()`. These are Obsidian workspace API calls that should not live in the domain layer.

**Approach:** Inject a navigation callback instead of `App`. `HubRegistry.openHub()` accepts `(hubId, tabId?, detail?)` — three parameters, not just a view type. The interface must model the full signature including tab-targeted navigation (used by `DataExchangeSetup` callers like `openHub("analytics", "queries", file.path)`).

- [ ] **Step 1: Define a navigation interface**

Add to `src/domain/hub/types.ts`:
```typescript
export interface IViewNavigator {
	openView(viewType: string, tabId?: string, detail?: string): Promise<void>;
}
```

- [ ] **Step 2: Refactor HubRegistry constructor to accept IViewNavigator**

Replace the `app: App` parameter with `navigator: IViewNavigator`. Update `openHub()` to call `this.navigator.openView(viewType, tabId, detail)` instead of directly manipulating `app.workspace`.

- [ ] **Step 3: Create the concrete navigator in infrastructure/bootstrap**

In `src/bootstrap/pluginBootstrap.ts` or a new file, implement the navigator using the Obsidian workspace API:
```typescript
function createViewNavigator(app: App): IViewNavigator {
	return {
		async openView(viewType: string, _tabId?: string, _detail?: string): Promise<void> {
			let leaf = app.workspace.getLeavesOfType(viewType)[0];
			if (!leaf) {
				leaf = app.workspace.getLeaf("tab");
				await leaf.setViewState({ type: viewType, active: true });
			}
			app.workspace.revealLeaf(leaf);
			// Tab and detail routing handled by the view itself via state
		},
	};
}
```

- [ ] **Step 4: Update HubRegistry instantiation in main.ts**

Where `HubRegistry` is constructed, pass the navigator instead of `app`.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/hub/ src/bootstrap/ src/main.ts
git commit -m "refactor(plugin): extract workspace navigation from HubRegistry domain class"
```

---

## Chunk 4: main.ts Decomposition

### Task 4.1: Extract train wiring into TrainSetup

**Files:**
- Create: `src/bootstrap/trainSetup.ts`
- Modify: `src/main.ts`

**Context:** `loadDomainServices()` is 730 lines. The train-related wiring (TrainService, TrainCanvasSyncService, train event subscriptions at lines ~876-900, ~1242-1402) accounts for ~200 lines. Extract into a `TrainSetup` class following the existing `SessionSetup` and `DataExchangeSetup` patterns.

- [ ] **Step 1: Read existing setup classes for the pattern**

Read `src/bootstrap/sessionSetup.ts` and `src/bootstrap/dataExchangeSetup.ts` to understand the factory pattern: what they receive, what they return, how cleanup is wired.

- [ ] **Step 2: Create trainSetup.ts**

Extract all train-related code from `loadDomainServices()` into `TrainSetup`:
- TrainService instantiation and settings binding
- TrainCanvasSyncService creation and cleanup
- All `train.*` event subscriptions (lines ~1242-1402)
- CaptureService train-related wiring

The setup class should:
- Accept deps (eventBus, settingsService, captureService, etc.)
- Return unsubscribe functions for `crossCuttingListeners`
- Follow the same pattern as SessionSetup

- [ ] **Step 3: Replace inline train code in main.ts with TrainSetup call**

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap/trainSetup.ts src/main.ts
git commit -m "refactor(plugin): extract train wiring from main.ts into TrainSetup"
```

---

### Task 4.2: Extract journey wiring into JourneySetup

**Files:**
- Create: `src/bootstrap/journeySetup.ts`
- Modify: `src/main.ts`

**Context:** Journey-related code in `loadDomainServices()` includes JourneyBuilderService, JourneyExecutorService, and the `ui.runJourney` subscription (~lines 1166-1205). Extract similarly to Task 4.1.

- [ ] **Step 1: Create journeySetup.ts**

Extract JourneyBuilder and JourneyExecutor wiring.

- [ ] **Step 2: Replace inline code in main.ts**

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/bootstrap/journeySetup.ts src/main.ts
git commit -m "refactor(plugin): extract journey wiring from main.ts into JourneySetup"
```

---

### Task 4.3: Extract remaining service wiring

**Files:**
- Create: `src/bootstrap/analyticsSetup.ts`
- Create: `src/bootstrap/miscSetup.ts` (nudge, inbox, capture, installer)
- Modify: `src/main.ts`

**Context:** After extracting train and journey, ~300 lines remain in `loadDomainServices()` for analytics, nudge, inbox, capture, installer, and misc wiring. Extract into focused setup modules.

- [ ] **Step 1: Extract analytics wiring**

Create `analyticsSetup.ts` for AnalyticsService instantiation and event wiring.

- [ ] **Step 2: Extract remaining miscellaneous wiring**

Group nudge, inbox, capture, and installer wiring into `miscSetup.ts` or individual setup files depending on size.

- [ ] **Step 3: Verify loadDomainServices() is now a thin orchestrator**

After extraction, `loadDomainServices()` should be ~50-100 lines: instantiate deps, call setup functions, collect unsubscribes. No inline event subscriptions or service configuration.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap/ src/main.ts
git commit -m "refactor(plugin): decompose loadDomainServices into focused setup modules"
```

---

### Task 4.4: Standardize cleanup mechanism

**Files:**
- Modify: `src/main.ts` (onunload and setup calls)

**Context:** Some services use `this.register(() => service.destroy())` (Obsidian lifecycle hook) while others use `safeDispose("name", service.dispose)` in `onunload()`. Standardize on one pattern for predictable shutdown order.

**Approach:** Use `crossCuttingListeners` for event subscriptions and `safeDispose()` in `onunload()` for service disposal. Remove `this.register()` calls for service cleanup and move them to the explicit `onunload()` sequence.

- [ ] **Step 1: Move all `this.register(() => ...)` cleanup calls to onunload()**

Replace:
```typescript
this.register(() => trainCanvasSync.destroy());     // line 899
this.register(() => canvasSessionService?.dispose()); // line 913
this.register(() => journeyExecutorService?.dispose()); // line 1166
this.register(() => perfAggregator?.destroy());     // line 688
```

With named `safeDispose()` entries in `onunload()`. Place them in the correct shutdown order:
1. Services that may emit events during teardown (`trainCanvasSync`, `canvasSessionService`, `journeyExecutorService`) must be disposed **before** the `crossCuttingListeners` are unsubscribed (line 481)
2. `perfAggregator` can be disposed at any point before `eventBus` cleanup
3. All four must be placed before the `eventBus.clear()` call at line 493

Verify by reading the existing `onunload()` sequence and inserting at the correct positions.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "refactor(plugin): standardize service cleanup to safeDispose in onunload"
```

---

## Chunk 5: Infrastructure Test Coverage

### Task 5.1: Add EventBus tests

**Files:**
- Create: `tests/infrastructure/events/EventBus.test.ts`

**Context:** `EventBus` is the pub/sub backbone — every domain service depends on it. It supports typed events, wildcard listeners, sequential handler execution, and error routing. Zero direct test coverage exists.

- [ ] **Step 1: Write EventBus test suite**

Cover:
1. Basic emit/on/off lifecycle
2. Handler receives correct payload
3. Multiple handlers for same event (execution order)
4. Wildcard listener receives all events
5. `off()` / unsubscribe prevents further calls
6. Error in handler doesn't block subsequent handlers
7. `emitCustom()` for untyped events
8. `clear()` removes all listeners

Use the existing test infrastructure (vitest, `vi.fn()`). EventBus should be testable in isolation without mocking — it's a standalone class.

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/infrastructure/events/EventBus.test.ts -v`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/infrastructure/events/EventBus.test.ts
git commit -m "test(plugin): add EventBus unit tests"
```

---

### Task 5.2: Add ServiceContainer tests

**Files:**
- Create: `tests/infrastructure/services/ServiceContainer.test.ts`

**Context:** `ServiceContainer` manages topological initialization order and disposable lifecycle. Untested.

- [ ] **Step 1: Write ServiceContainer test suite**

Cover:
1. Register and resolve a service
2. Topological sort respects dependencies
3. Circular dependency detection
4. `dispose()` calls dispose on all registered services
5. Dispose order is reverse of initialization

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/infrastructure/services/ServiceContainer.test.ts -v`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/infrastructure/services/ServiceContainer.test.ts
git commit -m "test(plugin): add ServiceContainer unit tests"
```

---

### Task 5.3: Add SitemapBootstrap tests

**Files:**
- Create: `tests/infrastructure/sitemap/sitemap-bootstrap.test.ts`

**Context:** `SitemapBootstrap` is the sitemap engine that drives view/command/ribbon registration. Untested.

- [ ] **Step 1: Write SitemapBootstrap test suite**

Cover:
1. `registerViews()` registers hub views with tabs
2. `registerViews()` registers leaf views with handler/component
3. `registerViews()` skips fileView entries
4. `registerCommands()` uses checkCallback for conditional commands
5. `registerRibbon()` handles `view:` prefix shortcut
6. `validate()` warns about unregistered handlers

Use mocks for the Obsidian Plugin API (`addCommand`, `addRibbonIcon`, `registerView`).

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/infrastructure/sitemap/sitemap-bootstrap.test.ts -v`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/infrastructure/sitemap/sitemap-bootstrap.test.ts
git commit -m "test(plugin): add SitemapBootstrap unit tests"
```

---

## Chunk 6: Design Improvements

### Task 6.1: Add getState/setState to SitemapLeafView

**Files:**
- Modify: `src/ui/views/sitemap-leaf-view.ts`
- Create: `tests/ui/views/sitemap-leaf-view.test.ts`

**Context:** `SitemapLeafView` has no `getState()`/`setState()`, so Obsidian cannot serialize leaf state for workspace persistence. After restart, any open leaf (e.g., train-main with a loaded train) opens to empty state. The handler needs a way to declare its serializable state.

**Approach:** Add an optional `getState` property to `TabHandler` that returns serializable state. `SitemapLeafView` implements `getState()` by calling the handler's `getState` if it exists, and `setState()` passes the state to the handler on next render.

- [ ] **Step 1: Write failing test**

Test that `SitemapLeafView.getState()` returns state from the handler.

- [ ] **Step 2: Add `getState` to TabHandler type**

In `src/infrastructure/handlers/plugin-handler-registry.ts`, extend the `TabHandler` type:
```typescript
export type TabHandler = {
	(container: HTMLElement, ctx: TabContext): void | (() => void);
	getState?: () => Record<string, unknown>;
};
```

- [ ] **Step 3: Implement getState/setState in SitemapLeafView**

```typescript
getState(): Record<string, unknown> {
	const handler = this.deps.handlerRegistry.getTabHandler(this.viewDef.handler);
	return handler?.getState?.() ?? {};
}

async setState(state: Record<string, unknown>): Promise<void> {
	this.savedState = state;
	await super.setState(state);
}
```

Pass `savedState` to the handler via `TabContext` on next render.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/sitemap-leaf-view.ts src/infrastructure/handlers/plugin-handler-registry.ts tests/
git commit -m "feat(plugin): add getState/setState to SitemapLeafView for workspace persistence"
```

---

### Task 6.2: Fix handler timing gap

**Files:**
- Modify: `src/ui/views/sitemap-leaf-view.ts`

**Context:** `SitemapBootstrap` registers views in `onload()`, but leaf handlers are registered in `onLayoutReady()`. If a view opens before layout is ready, `getTabHandler()` returns `undefined` and the view renders empty.

**Approach:** Use an event-based approach, NOT a setTimeout retry (which creates race conditions and test flakiness). Emit a `plugin.handlers.ready` event from `onLayoutReady()` in `main.ts` after all handlers are registered. `SitemapLeafView` listens for this event and re-renders when it fires.

- [ ] **Step 1: Add `plugin.handlers.ready` event**

In `src/infrastructure/events/events.ts` (or the appropriate infra event map), add:
```typescript
"plugin.handlers.ready": { payload: Record<string, never> };
```

In `main.ts`, emit this event at the end of `onLayoutReady()` after all handler registrations complete.

- [ ] **Step 2: Add loading state and event listener to SitemapLeafView render**

When `getTabHandler()` returns `undefined`:
1. Render a loading indicator (e.g., `container.createEl("p", { text: "Loading...", cls: "ft-loading" })`)
2. Subscribe to `plugin.handlers.ready` and call `this.render()` when it fires (store unsubscribe for cleanup)

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/views/sitemap-leaf-view.ts
git commit -m "fix(plugin): show loading state when leaf handler not yet registered"
```

---

### Task 6.3: Fix SitemapBootstrap registeredViewTypes push for skipped fileViews

**Files:**
- Modify: `src/infrastructure/sitemap/sitemap-bootstrap.ts`

**Context:** `registerViews()` pushes `viewDef.type` into `registeredViewTypes` (line 56) even for `fileView: true` entries that were skipped via `continue`. The push is after the if/else chain, so it runs for all views including skipped ones.

- [ ] **Step 1: Move the push inside the registration branches**

Move `this.registeredViewTypes.push(viewDef.type)` inside the `else if (viewDef.tabs)` and `else if (viewDef.component || viewDef.handler)` branches, after the `safeRegister()` call.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/sitemap/sitemap-bootstrap.ts
git commit -m "fix(plugin): only track registeredViewTypes for views actually registered by SitemapBootstrap"
```

---

## Summary

| Chunk | Tasks | Priority | Est. Scope |
|-------|-------|----------|------------|
| 0 | 0.1–0.3 | P0 | 3 tasks — critical bug fixes |
| 1 | 1.1–1.4 | P1 | 4 tasks — event type safety |
| 2 | 2.1–2.4 | P1 | 4 tasks — legacy dead code removal |
| 3 | 3.1–3.3 | P2 | 3 tasks — layer violation fixes |
| 4 | 4.1–4.4 | P2 | 4 tasks — main.ts decomposition |
| 5 | 5.1–5.3 | P2 | 3 tasks — infrastructure test coverage |
| 6 | 6.1–6.3 | P3 | 3 tasks — design improvements |

**Total: 24 tasks across 7 chunks.**

**Dependency graph:**
```
Chunk 0 (P0 bugs) ──┬──→ Chunk 1 (event types) ──→ Chunk 2 (legacy cleanup)
                     ├──→ Chunk 3 (layer fixes)
                     ├──→ Chunk 4 (main.ts decomposition)
                     ├──→ Chunk 5 (infra tests)
                     └──→ Chunk 6 (design improvements)
```

Chunks 1, 3, 4, 5, 6 can run in parallel after Chunk 0. Chunk 2 must wait for Chunk 1.
