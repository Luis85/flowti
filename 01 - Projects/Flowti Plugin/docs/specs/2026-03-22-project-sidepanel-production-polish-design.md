# Projects Sidepanel v1 — Production Polish

**Date**: 2026-03-22
**Status**: Draft
**Scope**: Bug fixes + Type safety + Handler decomposition

## Context

The Projects Sidepanel is a 6-tab Lit component tree inside an Obsidian ItemView that provides project management capabilities (overview, components/Storybook, event catalog, reporting, team, config). The architecture is sound but the implementation has race conditions, missing error handling, untyped property access, and fragile DOM coupling that produce three user-facing symptoms:

- **Stale data**: panel shows outdated state after actions (note creation relies on 500ms timeout, async loads swallow errors)
- **Stuck spinners**: busy state never clears on certain failure paths (git-import chain, view close during operations)
- **Unreliable Storybook**: dual-resolution race in start flow, polling continues against detached DOM

## Goals

1. Eliminate stale data, stuck spinners, and unreliable Storybook operations
2. Add compile-time type safety to the handler–component bridge
3. Decompose the monolithic event handler into focused, testable units
4. Introduce a cancellation mechanism for long-running operations

## Non-Goals

- Changing the Lit component tree or tab structure
- Adding test coverage (follow-up increment)
- Modifying VaultProjectService or infrastructure helpers
- Changing styles or visual design

---

## 1. Typed Bridge Interface

### Problem

The handler casts the Lit element as `HTMLElement & Record<string, unknown>`. All 30+ property assignments (`el.storybookBusy = true`, `el.projectHubOutput = []`, etc.) are invisible to TypeScript. A typo produces no compile error and no runtime exception — the state silently fails to update.

### Design

Define a `ProjectDetailElement` interface in `domain/projects/types.ts` that mirrors the public reactive properties of `FlowtiProjectDetail`:

```ts
export interface ProjectDetailElement extends HTMLElement {
	// Identity
	projectName: string;
	projectType: string;
	hasNote: boolean;
	notePath: string;

	// Project list
	projects: ProjectSummary[];
	searchQuery: string;
	cliConnected: boolean;

	// Storybook / Components
	storybook: StorybookStatus;
	storybookBusy: boolean;
	storybookBusyLabel: string;
	storybookOutput: string[];
	storybookError: string;
	components: ComponentEntry[];

	// Project hub work
	projectHubBusy: boolean;
	projectHubBusyLabel: string;
	projectHubOutput: string[];
	projectHubError: string;
	actionSuccess: string;
	statusMessage: string;

	// Config & sitemap
	config: ProjectConfig | undefined;
	hasSitemap: boolean;
	hasMarkdownSource: boolean;
	hasCanvas: boolean;
	canvasChanged: boolean;
	canvasPreset: string;
	brief: Record<string, string | undefined> | undefined;

	// Modals
	showScaffoldModal: boolean;
	showGitModal: boolean;
	gitModalMode: "submodule" | "template";
	showNamePrompt: boolean;

	// Git import modal state (replaces shadow DOM piercing)
	gitImportStep: "form" | "progress" | "detect" | "configure" | "done";
	gitImportError: string;
	gitImportOutputLines: string[];
	gitImportDetected: GitDetectResult | null;

	// Config tab state (replaces shadow DOM piercing)
	configSaveStatus: string;
	configSourcePath: string;

	// Health
	healthScore: HealthScore | null;
	healthError: string;

	// TODOs
	todos: TodoItem[];
	todosExist: boolean;

	// Catalog
	catalogEntities: CatalogEntity[];

	// Reporting
	reportGenerators: ReportGeneratorInfo[];
	reportNodeStates: Record<string, string>;
	reportOutput: string[];
	reportBusy: boolean;

	// Team
	roleSlots: TeamRoleSlot[];
	vaultAgents: VaultAgentSummary[];
	agentCreationContext: { roleId: string; agentName: string } | null;
}
```

The handler creates the element as:

```ts
const el = document.createElement("flowti-project-detail") as ProjectDetailElement;
```

`FlowtiProjectDetail` does not explicitly implement the interface — TypeScript's structural typing ensures compatibility. The interface describes the contract the handler expects.

### New Properties on FlowtiProjectDetail

The following properties are added to the Lit component to support the shadow DOM piercing elimination:

- `gitImportStep`, `gitImportError`, `gitImportOutputLines`, `gitImportDetected` — passed to `<flowti-git-import-modal>` via template bindings
- `configSaveStatus`, `configSourcePath` — passed to `<flowti-tab-config>` via template bindings

---

## 2. AbortController Cancellation

### Problem

When the sidepanel closes, `dispose()` only calls `el.remove()`. The Storybook 90s polling loop, pending CLI invocations, and fire-and-forget promises continue against a detached DOM element. This causes stale updates if the panel is reopened and state corruption if properties are set on a removed element.

### Design

`mountProjectDetail` creates an `AbortController`. The dispose function calls `controller.abort()` alongside `el.remove()`.

```ts
export function mountProjectDetail(container: HTMLElement, deps: ProjectHandlerDeps): () => void {
	const controller = new AbortController();
	const { signal } = controller;
	// ... create element, handlers ...
	return () => {
		controller.abort();
		el.remove();
	};
}
```

The signal is available to all handler classes via their deps.

**Rules for signal usage:**

- Every `await` inside a polling loop checks `signal.aborted` before continuing
- The Storybook start handler's 3-second polling loop exits immediately on abort
- `loadProject` and `loadProjectList` bail out early if aborted before writing to the element
- `endStorybookWork` / `endProjectHubWork` become no-ops when aborted
- The `setTimeout` callbacks check `signal.aborted` before executing

---

## 3. Bug Fixes

### Fix 1 — Replace 500ms magic timeout (stale data)

**Location**: `project-handlers.ts` line 119

**Current**: `setTimeout(() => loadProject/loadProjectList(), 500)` after `createNote()`.

**Fix**: `createNote` returns `Promise<void>` (see Section 6). The handler awaits it, then calls `loadProject`. No guessing.

### Fix 2 — Git import busy-state leak (stuck spinner)

**Location**: `project-handler-events.ts` lines 273–297

**Current**: When `importFromGit` returns `{ok: false}`, the first `.then()` early-returns `undefined`. The chained `.then(detectResult => ...)` receives `undefined`, checks `if (!detectResult) return`, but never resets `projectHubBusy`.

**Fix**: Restructure as try/catch with `finally` that always resets busy state on the non-happy paths. Every exit path either calls `endProjectHubWork` or manually resets `el.projectHubBusy = false`.

### Fix 3 — Storybook dual-resolution race (unreliable Storybook)

**Location**: `project-handler-events.ts` lines 46–93

**Current**: Two independent code paths (URL-detection in `watchingAppend` and the 3s polling loop) both set `resolved = true` and manipulate `el.storybookBusy` independently.

**Fix**: Extract a single `resolveStorybook(reason: string)` function inside the `StorybookHandler` that:
1. Guards with `if (resolved) return`
2. Sets `resolved = true`
3. Sets `el.storybookBusy = false` and `el.storybookBusyLabel = ""`
4. Calls `loadProject` once
5. Both the URL-detection path and the polling path call this function

### Fix 4 — loadProjectList swallowed errors (stale data)

**Location**: `project-handlers.ts` line 112

**Current**: `void loadProjectList()` — rejection silently discarded.

**Fix**: Add `.catch()` that sets `el.projectHubError` with a user-visible message like "Failed to load project list".

### Fix 5 — createNote EventBus listener leak

**Location**: `project-setup.ts` lines 36–52

**Current**: Two temporary EventBus listeners (`doc.created`, `doc.exists`) are registered but never cleaned up if DocService doesn't respond.

**Fix**: The promise-based approach (Section 6) always cleans up via the 5-second timeout or abort signal. Listeners are removed in every path: success, exists, timeout, and abort.

### Fix 6 — Fire-and-forget async loads

**Location**: `project-handlers.ts` lines 84–88

**Current**: Five `void` promises (health, todos, components, reports, catalog). If any reject, errors are swallowed.

**Fix**: Each gets a `.catch()` that sets a sensible fallback value and logs `console.warn`. For example, health catch sets `el.healthError = "Health check unavailable"`. The UI shows graceful degradation rather than an inconsistent state.

---

## 4. Eliminate Shadow DOM Piercing

### Problem

The handler reaches into child shadow DOMs 7+ times via `el.shadowRoot?.querySelector(...)` to set properties on `flowti-git-import-modal` and `flowti-tab-config`. This creates invisible coupling — if a child changes structure, these queries silently return `null`.

### Design

Move child-specific state up to the root `ProjectDetailElement` as reactive properties. The handler sets properties on the root element (typed, compile-checked). Lit template bindings propagate them to children.

**Git import modal** — 4 new properties on root:

| Property | Type | Replaces |
|----------|------|----------|
| `gitImportStep` | `"form" \| "progress" \| "detect" \| "configure" \| "done"` | `modal.step = "progress"` |
| `gitImportError` | `string` | `modal.errorNote = "Clone failed"` |
| `gitImportOutputLines` | `string[]` | `modal.outputLines = [...]` |
| `gitImportDetected` | `GitDetectResult \| null` | `modal.detectedType`, `.detectedFramework`, etc. |

Template in `FlowtiProjectDetail.renderProjectList()`:

```html
<flowti-git-import-modal
	.mode="${this.gitModalMode}"
	.step="${this.gitImportStep}"
	.errorNote="${this.gitImportError}"
	.outputLines="${this.gitImportOutputLines}"
	.detected="${this.gitImportDetected}"
></flowti-git-import-modal>
```

**Config tab** — 2 new properties on root:

| Property | Type | Replaces |
|----------|------|----------|
| `configSaveStatus` | `string` | `configTab.saveStatus = "Saved"` |
| `configSourcePath` | `string` | `configTab.sourcePath = folder` |

Template in `renderActiveTab()` config case:

```html
<flowti-tab-config
	.projectName="${this.projectName}"
	.config="${this.config}"
	.hasCanvas="${this.hasCanvas}"
	.hubLocked="${this.projectHubBusy}"
	.saveStatus="${this.configSaveStatus}"
	.sourcePath="${this.configSourcePath}"
></flowti-tab-config>
```

**GitDetectResult type** — new type in domain types:

```ts
export interface GitDetectResult {
	ok: boolean;
	type?: string;
	framework?: string;
	packageManager?: string;
	testFramework?: string;
	hasConfig?: boolean;
	buildCommand?: string;
	testCommand?: string;
	lintCommand?: string;
}
```

All `shadowRoot?.querySelector(...)` calls in the handler layer are removed.

**Modal-side changes for GitDetectResult**: `FlowtiGitImportModal` currently declares 6 loose `detected*` properties (`detectedType`, `detectedFramework`, etc.). These are replaced by a single `detected: GitDetectResult | null` property. The modal's template references change from `this.detectedType` to `this.detected?.type` etc. The 6 old property declarations and their `static properties` entries are removed, replaced by one `detected: { type: Object }` entry.

---

## 5. Handler Decomposition

### Problem

`project-handler-events.ts` is a 460-line file with four functions managing distinct domains but sharing a flat `ProjectEventContext` with 12+ callbacks. Each handler has access to every callback regardless of relevance.

### Design

Split into four handler classes. Each receives scoped deps and an `AbortSignal`.

**File structure:**

```
infrastructure/handlers/
	project-handlers.ts              ← orchestrator (unchanged role, simplified)
	project-storybook-handler.ts     ← NEW
	project-git-handler.ts           ← NEW
	project-config-handler.ts        ← NEW
	project-team-handler.ts          ← NEW
	project-handler-events.ts        ← DELETED
```

### StorybookHandler

**Events**: `storybook-install`, `storybook-start`, `storybook-stop`, `storybook-build`, `storybook-import`, `storybook-view`, `storybook-open-folder`, `storybook-preview`, `storybook-dismiss-output`, `storybook-dismiss-error`, `storybook-canvas-import`, `components-refresh`, `scaffold-confirm`, `scaffold-dismiss`, `storybook-regenerate-confirmed`

**Owns**: `storybookLines[]` buffer, `resolved` flag, Storybook polling state

**Deps**:
```ts
interface StorybookHandlerDeps {
	el: ProjectDetailElement;
	signal: AbortSignal;
	projectService: IProjectService;
	getCurrentProject: () => string;
	loadProject: (name: string) => Promise<void>;
	revealFolder?: (path: string) => void;
	pickFolder?: () => Promise<string | null>;
}
```

### GitImportHandler

**Events**: `add-project`, `import-setup`, `wizard-configure`, `wizard-open-project`, `import-cancel`, `create-empty-project`

**Owns**: `gitOutputLines[]` buffer

**Deps**:
```ts
interface GitImportHandlerDeps {
	el: ProjectDetailElement;
	signal: AbortSignal;
	projectService: IProjectService;
	getCurrentProject: () => string;
	loadProject: (name: string) => Promise<void>;
	loadProjectList: () => Promise<void>;
	createNote?: (name: string) => Promise<void>;
}
```

### ConfigCatalogHandler

**Events**: `config-save`, `config-browse-folder`, `canvas-generate`, `canvas-merge`, `canvas-open`, `health-refresh`, `todo-add`, `todo-toggle`, `todo-delete`, `catalog-list-refresh`, `catalog-entity-create`, `report-run`, `report-run-all`

**Deps**:
```ts
interface ConfigCatalogHandlerDeps {
	el: ProjectDetailElement;
	signal: AbortSignal;
	projectService: IProjectService;
	getCurrentProject: () => string;
	openNote?: (path: string) => void;
	pickFolder?: () => Promise<string | null>;
}
```

### TeamHandler

**Events**: `team-roster-save`, `team-create-agent`, `team-refresh-agents`, `team-roster-error`

**Deps**:
```ts
interface TeamHandlerDeps {
	el: ProjectDetailElement;
	signal: AbortSignal;
	projectService: IProjectService;
	getCurrentProject: () => string;
}
```

### Orchestrator Changes

`project-handlers.ts` becomes:

```ts
export function mountProjectDetail(container: HTMLElement, deps: ProjectHandlerDeps): () => void {
	const controller = new AbortController();
	const el = document.createElement("flowti-project-detail") as ProjectDetailElement;
	// ... loadProject, loadProjectList, work queue helpers ...

	const storybook = new StorybookHandler({ el, signal: controller.signal, ... });
	const git = new GitImportHandler({ el, signal: controller.signal, ... });
	const config = new ConfigCatalogHandler({ el, signal: controller.signal, ... });
	const team = new TeamHandler({ el, signal: controller.signal, ... });

	container.appendChild(el);
	// ... initial load ...

	return () => {
		controller.abort();
		storybook.dispose();
		git.dispose();
		config.dispose();
		team.dispose();
		el.remove();
	};
}
```

**Buffer and work-queue ownership**: Each handler owns its internal line buffer and exposes its own `start`, `append`, and `end` work-queue methods. For example, `StorybookHandler` owns `storybookLines[]` and provides `startWork(label)`, `appendLog(line)`, `endWork(result)`, and `clearLogBuffer()`. These methods write directly to the typed `el` properties and check `signal.aborted` before writing. The orchestrator does **not** own these buffers — each handler is self-contained.

The orchestrator provides `loadProject` and `loadProjectList` via deps (shared across handlers), but per-domain busy state (`storybookBusy`, `projectHubBusy`) is managed by the handler that owns that domain. `StorybookHandler` manages `el.storybookBusy`; the other three handlers share `el.projectHubBusy` — the orchestrator provides a shared `startProjectHubWork` / `endProjectHubWork` pair that those three handlers receive via deps.

**Dismiss clears internal buffer**: The `storybook-dismiss-output` handler in `StorybookHandler` clears both `el.storybookOutput` and the internal `storybookLines[]` buffer. This fixes a pre-existing bug where dismissing the log surface and then triggering a new append would repopulate old lines.

---

## 6. Promise-Based createNote

### Problem

The `createNote` callback in `project-setup.ts` uses the EventBus for a `doc.create` → `doc.created`/`doc.exists` round-trip, but returns `void`. The handler guesses completion with `setTimeout(500)`.

### Design

Change the signature from `(name: string) => void` to `(name: string) => Promise<void>`.

**Implementation in project-setup.ts:**

```ts
createNote: (name: string): Promise<void> => {
	return new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			eventBus.off("doc.created", onCreated);
			eventBus.off("doc.exists", onExists);
			reject(new Error("Note creation timed out"));
		}, 5000);

		const onCreated = (e: DocCreatedEvent) => {
			if (e.docType !== "ProjectBrief") return;
			clearTimeout(timeout);
			eventBus.off("doc.created", onCreated);
			eventBus.off("doc.exists", onExists);
			openNote(e.path);
			resolve();
		};

		const onExists = (e: DocExistsEvent) => {
			if (e.docType !== "ProjectBrief") return;
			clearTimeout(timeout);
			eventBus.off("doc.created", onCreated);
			eventBus.off("doc.exists", onExists);
			openNote(e.path);
			resolve();
		};

		eventBus.on("doc.created", onCreated);
		eventBus.on("doc.exists", onExists);
		eventBus.emit("doc.create", { docType: "ProjectBrief", name });
	});
}
```

**Handler usage:**

```ts
await deps.createNote(name).catch(() => { /* timeout — proceed anyway */ });
await loadProject(name);
```

**Interface update in ProjectHandlerDeps:**

```ts
createNote?: (name: string) => Promise<void>;
```

Listeners are cleaned up in every path: success, already-exists, and 5s timeout. On panel-close abort, the handler wraps the `createNote` call with the abort signal — if `signal.aborted` is true before the call, it skips; if the signal fires during the EventBus wait, the handler's `.catch()` handles the rejection and the 5s timeout eventually cleans up the listeners. The abort signal does not need to be threaded into `project-setup.ts` itself — the orchestrator-level guard is sufficient.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `domain/projects/types.ts` | Modify | Add `ProjectDetailElement`, `GitDetectResult` interfaces |
| `infrastructure/handlers/project-handlers.ts` | Modify | Orchestrator: AbortController, typed element, handler instantiation, error handling |
| `infrastructure/handlers/project-storybook-handler.ts` | Create | StorybookHandler class |
| `infrastructure/handlers/project-git-handler.ts` | Create | GitImportHandler class |
| `infrastructure/handlers/project-config-handler.ts` | Create | ConfigCatalogHandler class |
| `infrastructure/handlers/project-team-handler.ts` | Create | TeamHandler class |
| `infrastructure/handlers/project-handler-events.ts` | Delete | Replaced by 4 handler files |
| `components/projects/flowti-project-detail.ts` | Modify | Add git modal + config tab properties, update template bindings |
| `components/projects/flowti-git-import-modal.ts` | Modify | Accept `detected` as single typed prop instead of 6 loose props |
| `bootstrap/project-setup.ts` | Modify | Promise-based `createNote` |
| `ui/projects/project-detail-view.ts` | Modify | Update `ProjectDetailDeps.createNote` signature to `Promise<void>` |
| `tests/infrastructure/handlers/project-handlers.test.ts` | Modify | Update for new handler structure |
| `tests/components/projects/flowti-project-detail.test.ts` | Modify | Update for new properties |

**Files untouched**: VaultProjectService, vault-project-helpers, vault-project-cli, flowti-cli-run, flowti-cli-runtime, all 6 tab components (except template binding additions to config tab), styles.
