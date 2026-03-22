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

- Changing the Lit component tree or tab structure (tabs stay as-is, hierarchy unchanged)
- Adding test coverage (follow-up increment — includes new components like `flowti-health-gauge`)
- Modifying VaultProjectService or infrastructure helpers
- Adding new features or tab content — visual polish is cosmetic + consistency only

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

## 7. Visual Polish — Luminous Dashboard

### Aesthetic Direction

**Luminous dark**: Dark base with heightened contrast. Cards with slightly lighter backgrounds, glowing accent borders on active states, health gauges with vivid color fills, status badges that pop. Feels like a premium control panel embedded in Obsidian.

The visual polish respects Obsidian's theme system (all colors via CSS custom properties) while giving the Projects hub a recognizable Flowti identity: consistent glow language, micro-interactions on state changes, and dashboard-grade data visualization.

### 7a: Design Tokens Extension

Dashboard-specific tokens scoped to the project detail host (not in shared `tokens.ts`):

```css
:host {
	/* Elevation layers (luminous dark) */
	--hub-surface-0: var(--background-primary, #141414);
	--hub-surface-1: var(--background-secondary, #1a1a1a);
	--hub-surface-2: color-mix(in srgb, var(--background-secondary, #1a1a1a) 85%, white);

	/* Glow accents */
	--hub-glow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 25%, transparent),
	            0 0 12px color-mix(in srgb, var(--interactive-accent) 8%, transparent);
	--hub-glow-success: 0 0 0 1px color-mix(in srgb, var(--color-green) 25%, transparent),
	                    0 0 12px color-mix(in srgb, var(--color-green) 8%, transparent);

	/* Unified radius */
	--hub-radius: 6px;
	--hub-radius-lg: 10px;

	/* Transitions */
	--hub-transition: 150ms ease;
	--hub-transition-slow: 300ms ease;
}
```

Unifies the 4px/6px/8px/10px spread into two tiers. Every interactive element gets a consistent glow language.

### 7b: Project List Cards

Replace flat button rows with luminous cards:

- Card base: `--hub-surface-1` background, `--hub-radius` corners, 1px border
- Hover: border transitions to accent-tinted, subtle `translateY(-1px)` lift, `--hub-glow` shadow
- Type badge: faint glow matching accent
- Storybook "running" badge: pulsing green dot (reuse `pulse` keyframe, green, 6px)
- `+ brief` badge: ghost button with dashed border, solidifies on hover
- Entrance animation: cards stagger in with `opacity 0→1` and `translateY(4px→0)` over 200ms, each delayed 30ms via `animation-delay: calc(var(--i, 0) * 30ms)`. The `--i` variable is set per card via an inline `style` binding in the `renderProjectItem` map call: `style="--i: ${index}"`. Without this, all cards animate simultaneously.

### 7c: Health Score Gauge

New micro-component `<flowti-health-gauge>` replacing the plain text score:

- SVG-based 270-degree arc with score percentage filled
- Color transitions: red (<40) → yellow (40-70) → green (>70), using `--color-red/yellow/green`
- Score number large and centered inside the arc
- Subtle glow on the filled portion matching score color
- Arc animates from 0 to target on mount (500ms ease-out) via CSS `stroke-dashoffset` transition
- No SVG fallback needed — Obsidian runs in Electron which always supports SVG

Component API:

```html
<flowti-health-gauge
	.score="${this.healthScore}"
	.error="${this.healthError}"
></flowti-health-gauge>
```

Purely presentational, used inside `flowti-tab-overview`. Approximately 80 lines (template + styles).

### 7d: Tab Bar Polish

Upgrade the underline tabs to a dashboard nav:

- Active tab: glowing bottom border (2px solid accent + faint `box-shadow: 0 2px 8px` downward)
- Tab switch: underline position transition via per-tab `border-bottom-color` with `--hub-transition`
- Hover: text color transitions smoothly (150ms), faint background tint `color-mix(accent 5%, transparent)`
- Typography: `text-transform: uppercase`, `letter-spacing: 0.03em`, `font-size: 0.8em`
- Active tab: `font-weight: 600` (up from 500)
- Tab overflow: `overflow-x: auto` with hidden scrollbar for narrow viewports. At Obsidian's default ~300px sidepanel width, 6 uppercase tabs with letter-spacing may overflow — the hidden scrollbar allows horizontal swipe/drag without visual scrollbar clutter. If this proves awkward, `text-transform` can be dropped as a fallback.

### 7e: Activity Bar State Transitions

Smooth animated transitions between busy/success/error/idle:

- Background color crossfade: `transition: background var(--hub-transition-slow), color var(--hub-transition-slow)`
- Spinner entrance: `scale(0.5)→scale(1)` with `opacity 0→1` over 150ms
- Success state: brief green glow flash (200ms brighter, then settle to normal)
- Error state: subtle shake animation (`@keyframes shake { 0%,100% { translateX(0) } 25% { translateX(-2px) } 75% { translateX(2px) } }`, 300ms)
- Dismiss button: `opacity 0→0.6` with 150ms delay after state change
- Appear/disappear: `max-height` transition (0→auto via `grid-template-rows: 0fr→1fr` trick) for smooth reveal

All activity bar transitions are **CSS-only** — they use `transition` properties on the `.activity-bar` element that trigger when the class changes (e.g., `--busy` → `--success`). No JS timing or handler coordination is needed. The green flash uses a CSS `@keyframes` animation applied on state entry via the class, not a programmatic "set class then remove" pattern.

### 7f: CLI Log Terminal Feel

Make log containers feel like embedded terminals:

- Inset appearance: `box-shadow: inset 0 2px 4px rgba(0,0,0,0.2)` on the pre area
- Monospace font with faint accent tint on background: `color-mix(in srgb, var(--interactive-accent) 3%, var(--hub-surface-0))`
- Active log: 3px solid accent left-border bar (replace full border glow for cleaner look)
- Auto-scroll behavior: JS-based via Lit's `updated()` lifecycle — `scrollTop = scrollHeight` on append, with a `userScrolledUp` flag (set on manual scroll-up, cleared when user scrolls back to bottom) to avoid fighting the user
- Log head title: `text-transform: uppercase`, `letter-spacing: 0.04em`, `font-size: 0.75em` for a terminal-chrome feel

### 7g: Consistency Pass

Unify all tabs to the same patterns:

| What | Before | After |
|------|--------|-------|
| Border radius | 4px/6px/8px/10px mixed | `--hub-radius` (6px) for controls, `--hub-radius-lg` (10px) for cards |
| Button padding | Mixed (6px 12px, 4px 16px, 2px 8px) | `6px 14px` standard, `4px 10px` compact |
| Focus style | Mixed (outline vs border-color) | Unified: `2px solid accent, 2px offset` everywhere |
| Spacing | Mixed hardcoded px + tokens | All spacing via `--flowti-space-*` tokens |
| Button hover | Background swap | Background + `translateY(-0.5px)` micro-lift, `--hub-transition` |
| Section gaps | Mixed margin-bottom vs gap | All flex containers use `gap` |
| Empty states | Inline text + local `.empty-state` | Import shared `emptyState` from `shared-styles.ts`, remove local `.empty-state` from `flowti-project-detail-styles.ts` |
| Status badges | Per-component reimplementation | Use shared `statusBadge` pattern from `shared-styles.ts` |
| Reporting tab | Margin-based spacing | Gap-based flexbox, consistent with all other tabs |

### 7h: New Shared Styles

Add to `shared-styles.ts` (used by multiple tab components):

```ts
export const hubCard = css`
	.hub-card {
		background: var(--hub-surface-1, var(--background-secondary));
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius-lg, 10px);
		padding: var(--flowti-space-md);
		transition: border-color var(--hub-transition, 150ms ease),
		            box-shadow var(--hub-transition, 150ms ease),
		            transform var(--hub-transition, 150ms ease);
	}
	.hub-card:hover {
		border-color: color-mix(in srgb, var(--interactive-accent) 30%, var(--background-modifier-border));
		box-shadow: var(--hub-glow, none);
		transform: translateY(-1px);
	}
`;

export const hubButton = css`
	.hub-btn {
		padding: 6px 14px;
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
		transition: background var(--hub-transition, 150ms ease),
		            transform var(--hub-transition, 150ms ease);
	}
	.hub-btn:hover {
		background: var(--background-modifier-hover, #333);
		transform: translateY(-0.5px);
	}
	.hub-btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.hub-btn--primary {
		background: var(--interactive-accent, #7c3aed);
		border-color: var(--interactive-accent, #7c3aed);
		color: #fff;
	}
	.hub-btn--compact {
		padding: 4px 10px;
	}
`;
```

Tab components import these shared styles instead of reimplementing button/card patterns.

---

## File Change Summary

### Structural (Sections 1–6)

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

### Visual (Section 7)

| File | Action | Description |
|------|--------|-------------|
| `components/projects/flowti-project-detail-styles.ts` | Modify | Hub tokens, card styles, tab bar, activity bar transitions, log terminal |
| `components/projects/flowti-project-detail.ts` | Modify | Staggered card entrance, activity bar transition markup, tab bar uppercase |
| `components/projects/flowti-health-gauge.ts` | Create | SVG arc gauge micro-component (~80 lines) |
| `components/projects/flowti-tab-overview.ts` | Modify | Health gauge integration, spacing consistency, shared patterns |
| `components/projects/flowti-tab-components.ts` | Modify | Radius/spacing/button consistency, shared styles |
| `components/projects/flowti-tab-event-catalog.ts` | Modify | Radius/spacing/button consistency, shared empty state |
| `components/projects/flowti-tab-reporting.ts` | Modify | Margin→gap, radius/spacing consistency, log terminal style |
| `components/projects/flowti-tab-config.ts` | Modify | Form field consistency, radius/spacing, save status bindings |
| `components/projects/flowti-tab-team.ts` | Modify | Align card radius to `--hub-radius-lg`, unify button styles |
| `components/projects/flowti-scaffold-modal.ts` | Modify | Radius consistency, shared button styles |
| `components/projects/flowti-add-project-dropdown.ts` | Modify | Radius consistency, glow on open |
| `components/projects/flowti-git-import-modal-styles.ts` | Modify | Radius/button consistency to match hub tokens |
| `components/projects/flowti-storybook-section.ts` | Modify | Button/badge consistency (used inside components tab) |
| `components/shared-styles.ts` | Modify | Add `hubCard` and `hubButton` shared style exports (note: `--hub-*` tokens come from project detail host; fallback values ensure standalone use) |

**Files untouched**: VaultProjectService, vault-project-helpers, vault-project-cli, flowti-cli-run, flowti-cli-runtime.
