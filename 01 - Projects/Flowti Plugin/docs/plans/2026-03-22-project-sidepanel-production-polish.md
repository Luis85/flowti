# Projects Sidepanel Production Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix race conditions, stuck spinners, and unreliable Storybook; add type safety; decompose monolithic handler; apply luminous dashboard visual polish.

**Architecture:** Six structural changes (typed bridge interface, AbortController cancellation, 6 bug fixes, shadow DOM elimination, handler decomposition into 4 classes, promise-based createNote) plus a visual polish pass (hub tokens, project cards, SVG health gauge, tab bar, activity bar animations, terminal-feel logs, consistency across all tabs).

**Tech Stack:** Lit web components, TypeScript (strict), Obsidian API, CSS custom properties, SVG

**Spec:** `01 - Projects/Flowti Plugin/docs/specs/2026-03-22-project-sidepanel-production-polish-design.md`

**Test command:** `cd "01 - Projects/Flowti Plugin" && npx vitest run`

**Type check:** `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

**Lint:** `cd "01 - Projects/Flowti Plugin" && npx eslint src/`

---

## Chunk 1: Foundation — Types, createNote, Component Properties

### Task 1: Add GitDetectResult and ProjectDetailElement interfaces

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts`

- [ ] **Step 1: Add GitDetectResult interface**

Add after the `VaultAgentSummary` interface (line 269):

```ts
/** Detection result from project-from-git wizard. */
export interface GitDetectResult {
	readonly ok: boolean;
	readonly type?: string;
	readonly framework?: string;
	readonly packageManager?: string;
	readonly testFramework?: string;
	readonly hasConfig?: boolean;
	readonly buildCommand?: string;
	readonly testCommand?: string;
	readonly lintCommand?: string;
}
```

- [ ] **Step 2: Add ProjectDetailElement interface**

Add after `GitDetectResult`:

```ts
/**
 * Typed bridge interface for the handler → Lit component contract.
 * Mirrors the public reactive properties of FlowtiProjectDetail.
 * The handler casts `document.createElement("flowti-project-detail")` to this type.
 */
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

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS (new interfaces, no consumers yet)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts"
git commit -m "feat(plugin): add ProjectDetailElement and GitDetectResult interfaces"
```

---

### Task 2: Promise-based createNote

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/ui/projects/project-detail-view.ts:15`
- Modify: `01 - Projects/Flowti Plugin/src/bootstrap/project-setup.ts:32-53`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts:23`

- [ ] **Step 1: Update ProjectDetailDeps interface**

In `project-detail-view.ts` line 15, change:

```ts
readonly createNote: (name: string) => void;
```

to:

```ts
readonly createNote: (name: string) => Promise<void>;
```

- [ ] **Step 2: Update ProjectHandlerDeps interface**

In `project-handlers.ts` line 23, change:

```ts
readonly createNote?: (name: string) => void;
```

to:

```ts
readonly createNote?: (name: string) => Promise<void>;
```

- [ ] **Step 3: Implement promise-based createNote in project-setup.ts**

> **Note:** The spec's pseudocode uses simplified event access (`e.docType`), but the actual plugin EventBus wraps payloads as `event.payload.docType`. The code below uses the correct runtime shape.

Replace lines 32–53 (`createNote: (name: string) => { ... }`) with:

```ts
createNote: (name: string): Promise<void> => {
	const projectPath = `01 - Projects/${name}/${name}.md`;
	return new Promise<void>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			unsub();
			unsubExists();
			reject(new Error("Note creation timed out"));
		}, 5000);

		const unsub = deps.eventBus.on("doc.created", (event) => {
			if (event.payload.docType !== "ProjectBrief") return;
			clearTimeout(timeoutId);
			unsub();
			unsubExists();
			void deps.app.workspace.openLinkText(event.payload.path, "", false);
			resolve();
		});
		const unsubExists = deps.eventBus.on("doc.exists", (event) => {
			if (event.payload.docType !== "ProjectBrief") return;
			clearTimeout(timeoutId);
			unsub();
			unsubExists();
			void deps.app.workspace.openLinkText(event.payload.path, "", false);
			resolve();
		});

		void deps.eventBus.emit("doc.create", {
			docType: "ProjectBrief",
			name,
			path: projectPath,
			source: "ProjectSetup",
		});
	});
},
```

- [ ] **Step 4: Update create-project-note handler**

In `project-handlers.ts` line 117–120, replace the `create-project-note` listener:

```ts
el.addEventListener("create-project-note", ((e: CustomEvent) => {
	deps.createNote?.(String(e.detail.name));
	setTimeout(() => { if (currentProject) void loadProject(currentProject); else void loadProjectList(); }, 500);
}) as EventListener);
```

with:

```ts
el.addEventListener("create-project-note", ((e: CustomEvent) => {
	const name = String(e.detail.name);
	void (async () => {
		await deps.createNote?.(name).catch(() => { /* timeout — proceed anyway */ });
		if (currentProject) await loadProject(currentProject);
		else await loadProjectList();
	})();
}) as EventListener);
```

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS (tests don't provide `createNote` so the optional chain skips it)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/ui/projects/project-detail-view.ts" \
        "01 - Projects/Flowti Plugin/src/bootstrap/project-setup.ts" \
        "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "fix(plugin): replace 500ms createNote timeout with promise-based EventBus round-trip"
```

---

### Task 3: Add new properties to FlowtiProjectDetail

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts:25-72` (static properties)
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts:80-122` (class properties)

- [ ] **Step 1: Add git import modal properties to static properties block**

Inside `static properties = { ... }` (after `gitModalMode` at ~line 55), add:

```ts
gitImportStep: { type: String },
gitImportError: { type: String },
gitImportOutputLines: { type: Array },
gitImportDetected: { type: Object },
```

- [ ] **Step 2: Add config tab properties to static properties block**

After `agentCreationContext` (~line 71), add:

```ts
configSaveStatus: { type: String },
configSourcePath: { type: String },
```

- [ ] **Step 3: Add class property initializers**

After `gitModalMode` initializer (~line 107), add:

```ts
gitImportStep: "form" | "progress" | "detect" | "configure" | "done" = "form";
gitImportError = "";
gitImportOutputLines: string[] = [];
gitImportDetected: GitDetectResult | null = null;
```

After `agentCreationContext` initializer (~line 122), add:

```ts
configSaveStatus = "";
configSourcePath = "";
```

- [ ] **Step 4: Add GitDetectResult import**

At the top of the file, add `GitDetectResult` to the import from `../../domain/projects/types.js`:

```ts
import type { StorybookStatus, ProjectSummary, ProjectConfig, HealthScore, TodoItem, CatalogEntity, ComponentEntry, ReportGeneratorInfo, TeamRoleSlot, VaultAgentSummary, GitDetectResult } from "../../domain/projects/types.js";
```

- [ ] **Step 5: Update git modal template binding**

In `renderProjectList()` (~line 232), change the git modal template from:

```html
<flowti-git-import-modal
	.mode="${this.gitModalMode}"
></flowti-git-import-modal>
```

to:

```html
<flowti-git-import-modal
	.mode="${this.gitModalMode}"
	.step="${this.gitImportStep}"
	.errorNote="${this.gitImportError}"
	.outputLines="${this.gitImportOutputLines}"
	.detected="${this.gitImportDetected}"
></flowti-git-import-modal>
```

- [ ] **Step 6: Update config tab template binding**

In `renderActiveTab()` config case (~line 172), change:

```html
<flowti-tab-config
	.projectName="${this.projectName}"
	.config="${this.config}"
	.hasCanvas="${this.hasCanvas}"
	.hubLocked="${this.projectHubBusy}"
></flowti-tab-config>
```

to:

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

- [ ] **Step 7: Reset new properties in back-to-list handler**

In `renderProjectList` or the `back-to-list` handler (handled by orchestrator, but component should reset on `projectName = ""`). No action needed — properties reset via orchestrator in Task 10.

- [ ] **Step 8: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin): add git modal and config tab properties to ProjectDetail for shadow DOM elimination"
```

---

### Task 4: Refactor FlowtiGitImportModal to accept typed `detected` prop

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-git-import-modal.ts`

- [ ] **Step 1: Add GitDetectResult import**

```ts
import type { GitDetectResult } from "../../domain/projects/types.js";
```

- [ ] **Step 2: Replace 5 loose detected* properties with single `detected` property**

In `static properties`, remove **only** these 5 entries (lines 29-33):
- `detectedType`, `detectedFramework`, `detectedPackageManager`, `detectedTestFramework`, `detectedHasConfig`

Add in their place:

```ts
detected: { type: Object },
```

Remove the corresponding 5 class field initializers (lines 51-55: `detectedType` through `detectedHasConfig`). Add:

```ts
detected: GitDetectResult | null = null;
```

**Keep** `configBuildCommand`, `configTestCommand`, `configLintCommand`, `configFramework` in both `static properties` and as class fields — they are user-editable form state in the configure step, not parent-driven data. Do NOT remove them.

> **Note:** The `GitDetectResult` interface deliberately omits the `error?: string` field from the `detectProject()` return type. Errors are routed through `el.gitImportError` (a separate property), not through the detect result object.

- [ ] **Step 3: Update renderDetect template**

Change references from `this.detectedType` to `this.detected?.type ?? ""` etc.:

```ts
private renderDetect() {
	const steps = this.renderStepIndicator(0);
	return html`
		<div class="overlay">
			<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
				<div class="modal-title">Project detected</div>
				${steps}
				<dl class="detect-grid">
					<dt>Type</dt><dd>${this.detected?.type ?? "unknown"}</dd>
					<dt>Framework</dt><dd>${this.detected?.framework ?? "none"}</dd>
					<dt>Package manager</dt><dd>${this.detected?.packageManager ?? "none"}</dd>
					<dt>Test framework</dt><dd>${this.detected?.testFramework ?? "none"}</dd>
					<dt>Existing config</dt><dd>${this.detected?.hasConfig ? "yes" : "no"}</dd>
				</dl>
				${this.errorNote ? html`<div class="error-note">${this.errorNote}</div>` : ""}
				<div class="modal-actions">
					<button class="btn" @click="${this.goToConfigure}">Configure</button>
					<button class="btn btn--primary" @click="${this.dispatchFinish}">Finish</button>
				</div>
			</div>
		</div>
	`;
}
```

- [ ] **Step 4: Update goToConfigure to seed config fields from detected**

```ts
private goToConfigure(): void {
	this.configBuildCommand = this.configBuildCommand || this.detected?.buildCommand || "";
	this.configTestCommand = this.configTestCommand || this.detected?.testCommand || "";
	this.configLintCommand = this.configLintCommand || this.detected?.lintCommand || "";
	this.configFramework = this.configFramework || this.detected?.framework || "";
	this.step = "configure";
}
```

- [ ] **Step 5: Update dispatchFinish to use detected**

Change `this.detectedFramework` to `this.detected?.framework ?? ""`:

```ts
private dispatchFinish(): void {
	this.dispatchEvent(new CustomEvent("wizard-configure", {
		detail: {
			name: this.projectName,
			framework: this.detected?.framework ?? "",
			buildCommand: this.configBuildCommand,
			testCommand: this.configTestCommand,
			lintCommand: this.configLintCommand,
		},
		bubbles: true, composed: true,
	}));
}
```

- [ ] **Step 6: Update renderDone to use detected**

Change `this.detectedFramework` to `this.detected?.framework`:

```ts
<div class="detail">${this.detected?.framework || this.configFramework || this.detected?.type || "Project"} &middot; ${this.mode === "template" ? "template" : "submodule"}</div>
```

- [ ] **Step 7: Update dispatchConfigure**

Change `this.detectedFramework` to `this.detected?.framework || ""`:

```ts
framework: this.configFramework || this.detected?.framework || "",
```

- [ ] **Step 8: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-git-import-modal.ts"
git commit -m "refactor(plugin): replace loose detected* properties with typed GitDetectResult in git import modal"
```

---

### Task 5: Update existing tests for new structure

**Files:**
- Modify: `01 - Projects/Flowti Plugin/tests/components/projects/flowti-project-detail.test.ts`
- Modify: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`

- [ ] **Step 1: Update project-detail test for new properties**

If the test creates `FlowtiProjectDetail` instances or checks properties, ensure the new properties (`gitImportStep`, `gitImportError`, `gitImportOutputLines`, `gitImportDetected`, `configSaveStatus`, `configSourcePath`) have correct defaults. Read the test file first to determine what needs changing.

- [ ] **Step 2: Update project-handlers test for async createNote**

The `mockService()` in `project-handlers.test.ts` does not set `createNote`, so the optional chain `deps.createNote?.(name)` safely returns `undefined`. No changes needed unless tests explicitly test note creation flow.

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit (if changes needed)**

```bash
git add "01 - Projects/Flowti Plugin/tests/"
git commit -m "test(plugin): update project detail tests for new properties and async createNote"
```

---

## Chunk 2: Handler Decomposition — 4 Handlers + Orchestrator + Abort + Bug Fixes

### Task 6: Create StorybookHandler class

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-storybook-handler.ts`

- [ ] **Step 1: Create the file with deps interface and class skeleton**

```ts
/**
 * Storybook / Components-tab handler.
 * Owns: storybookLines buffer, resolved flag, Storybook polling state.
 * All storybook-* and scaffold-* events are wired here.
 */

import type { IProjectService, StorybookFramework, ProjectDetailElement } from "../../domain/projects/types.js";

export interface StorybookHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly loadProject: (name: string) => Promise<void>;
	readonly revealFolder?: (path: string) => void;
	readonly pickFolder?: () => Promise<string | null>;
}

export class StorybookHandler {
	private readonly deps: StorybookHandlerDeps;
	private storybookLines: string[] = [];

	constructor(deps: StorybookHandlerDeps) {
		this.deps = deps;
		this.wireEvents();
	}

	// Access via this.deps.el, this.deps.signal, this.deps.projectService, etc.
	// All four handlers use the same `this.deps` pattern for consistency.

	dispose(): void {
		// AbortController handles cancellation; no per-listener cleanup needed
		// because the element is removed from DOM (listeners are GC'd)
	}

	// ── Work queue ──
	private startWork(label: string): void {
		if (this.deps.signal.aborted) return;
		this.storybookLines.length = 0;
		this.deps.el.storybookBusy = true;
		this.deps.el.storybookBusyLabel = label;
		this.deps.el.storybookOutput = [];
		this.deps.el.storybookError = "";
	}

	private appendLog(line: string): void {
		if (this.deps.signal.aborted) return;
		console.debug("[Flowti:Components/Storybook]", line);
		this.storybookLines.push(line);
		if (this.storybookLines.length > 200) this.storybookLines.shift();
		this.deps.el.storybookOutput = [...this.storybookLines];
	}

	private endWork(result: { ok: boolean; error?: string }): void {
		if (this.deps.signal.aborted) return;
		this.deps.el.storybookBusy = false;
		this.deps.el.storybookBusyLabel = "";
		if (!result.ok && result.error) this.deps.el.storybookError = result.error;
		void this.deps.loadProject(this.deps.getCurrentProject());
	}

	private clearLogBuffer(): void {
		this.storybookLines.length = 0;
		this.deps.el.storybookOutput = [];
	}

	// ... wireEvents() — copy all storybook/scaffold event listeners from
	// project-handler-events.ts wireStorybookEvents + wireScaffoldAndRegenerateEvents
	// replacing ctx.* calls with this.* methods
	// Key changes:
	// 1. storybook-start: single resolveStorybook() guard function, abort signal check in polling loop
	// 2. storybook-dismiss-output: clear both el.storybookOutput AND internal storybookLines buffer
	// 3. All polling loops: check this.signal.aborted before continuing

	private wireEvents(): void {
		const { el } = this;

		// ... (full event wiring code — migrate from wireStorybookEvents + wireScaffoldAndRegenerateEvents)
		// This is the largest handler. Port all 15 events, applying:
		// - this.startWork/appendLog/endWork instead of ctx.*
		// - this.signal.aborted checks in polling loops
		// - Single resolveStorybook() for the dual-resolution race fix
	}
}
```

- [ ] **Step 2: Implement wireEvents with all 15 storybook/scaffold events**

Port all event listeners from `wireStorybookEvents` (lines 32-185 of project-handler-events.ts) and `wireScaffoldAndRegenerateEvents` (lines 187-248).

Key fix — `storybook-start` dual-resolution race (spec Section 3, Fix 3):

```ts
el.addEventListener("storybook-start", (() => {
	this.startWork("Starting Storybook…");
	let resolved = false;
	let detectedUrl = "http://localhost:6006";

	const resolveStorybook = (reason: string): void => {
		if (resolved || this.deps.signal.aborted) return;
		resolved = true;
		this.deps.el.storybookBusy = false;
		this.deps.el.storybookBusyLabel = "";
		void this.deps.loadProject(this.deps.getCurrentProject());
	};

	const watchingAppend = (line: string): void => {
		this.appendLog(line);
		if (resolved) return;
		const urlMatch = line.match(/Local:\s*(https?:\/\/localhost:\d+)/i);
		if (urlMatch) detectedUrl = urlMatch[1];
		const lower = line.toLowerCase();
		if (lower.includes("storybook") && (lower.includes("ready") || lower.includes("started"))) {
			this.appendLog(`\nStorybook ready at ${detectedUrl}`);
			void this.deps.projectService.openStorybookUrl(this.deps.getCurrentProject(), detectedUrl, (l) => this.appendLog(l));
			resolveStorybook("ready-detected");
		}
	};

	void this.deps.projectService.startStorybook(this.deps.getCurrentProject(), watchingAppend)
		.then(async (result) => {
			if (!result.ok) { this.endWork(result); return; }
			const deadline = Date.now() + 90_000;
			while (!resolved && !this.deps.signal.aborted && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 3000));
				if (resolved || this.deps.signal.aborted) return;
				const detail = await this.deps.projectService.getProject(this.deps.getCurrentProject());
				if (detail && !detail.storybook.running) {
					// Note: loadProject() in resolveStorybook resets storybookError synchronously.
					// Set the error AFTER loadProject completes by deferring to next microtask.
					resolveStorybook("process-exited");
					// Re-set error after loadProject's sync reset:
					queueMicrotask(() => {
						if (!this.deps.signal.aborted) this.deps.el.storybookError = "Storybook process exited. See output log for details.";
					});
					return;
				}
			}
			if (!resolved && !this.deps.signal.aborted) {
				this.appendLog("Timeout (90s) — Storybook may still be starting.");
				resolveStorybook("timeout");
			}
		})
		.catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			this.appendLog(`Error: ${msg}`);
			this.endWork({ ok: false, error: msg });
		});
}) as EventListener);
```

Key fix — `storybook-dismiss-output` clears internal buffer:

```ts
el.addEventListener("storybook-dismiss-output", (() => {
	this.clearLogBuffer();
}) as EventListener);
```

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-storybook-handler.ts"
git commit -m "feat(plugin): create StorybookHandler with dual-resolution fix and abort signal"
```

---

### Task 7: Create GitImportHandler class

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-git-handler.ts`

- [ ] **Step 1: Create the file**

Port events from `wireGitImportEvents` (lines 251-333 of project-handler-events.ts).

Key fixes:
- **Busy-state leak** (spec Fix 2): `import-setup` uses try/catch/finally to always reset busy state
- **Shadow DOM elimination**: Set `el.gitImportStep`, `el.gitImportError`, `el.gitImportOutputLines`, `el.gitImportDetected` instead of `shadowRoot.querySelector`
- **Abort signal**: Check before async continuations

```ts
import type { IProjectService, ProjectDetailElement, GitDetectResult } from "../../domain/projects/types.js";

export interface GitImportHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly loadProject: (name: string) => Promise<void>;
	readonly loadProjectList: () => Promise<void>;
	readonly startProjectHubWork: (label: string) => void;
	readonly appendProjectHubLog: (line: string) => void;
	readonly endProjectHubWork: (result: { ok: boolean; error?: string }) => void;
	readonly createNote?: (name: string) => Promise<void>;
}

export class GitImportHandler {
	// ... constructor, dispose, wireEvents

	private wireEvents(): void {
		const { el } = this;

		// import-setup — fixed busy-state leak
		el.addEventListener("import-setup", ((e: CustomEvent) => {
			const { url, name, mode } = e.detail as { url: string; name: string; mode: string };
			this.deps.startProjectHubWork("Cloning repository…");
			el.gitImportStep = "progress";
			el.gitImportError = "";
			const gitOutputLines: string[] = [];
			const gitAppend = (line: string) => {
				gitOutputLines.push(line);
				if (gitOutputLines.length > 200) gitOutputLines.shift();
				if (!this.deps.signal.aborted) el.gitImportOutputLines = [...gitOutputLines];
			};
			void (async () => {
				try {
					const r = await this.deps.projectService.importFromGit(url, name, mode as "submodule" | "template", gitAppend);
					if (this.deps.signal.aborted) return;
					if (!r.ok) {
						el.projectHubBusy = false;
						el.projectHubBusyLabel = "";
						el.gitImportError = r.error ?? "Clone failed";
						return;
					}
					gitAppend("Detecting project...");
					const detectResult = await this.deps.projectService.detectProject(name);
					if (this.deps.signal.aborted) return;
					el.projectHubBusy = false;
					el.projectHubBusyLabel = "";
					if (detectResult.ok !== false) {
						el.gitImportStep = "detect";
						el.gitImportDetected = detectResult as GitDetectResult;
					}
				} catch (err) {
					if (this.deps.signal.aborted) return;
					el.projectHubBusy = false;
					el.projectHubBusyLabel = "";
					el.gitImportError = err instanceof Error ? err.message : String(err);
				}
			})();
		}) as EventListener);

		// add-project, wizard-configure, wizard-open-project, import-cancel — port directly, replacing ctx.* with this.deps.*

		// create-empty-project — must await createNote (was fire-and-forget with 500ms timeout)
		el.addEventListener("create-empty-project", ((e: CustomEvent) => {
			const name = String(e.detail?.name);
			this.deps.startProjectHubWork("Creating project…");
			this.deps.appendProjectHubLog("Creating project folder…");
			void (async () => {
				const r = await this.deps.projectService.createEmptyProject(name, (l) => this.deps.appendProjectHubLog(l));
				if (this.deps.signal.aborted) return;
				if (!r.ok) { this.deps.endProjectHubWork(r); return; }
				this.deps.appendProjectHubLog("Creating project brief…");
				await this.deps.createNote?.(name).catch(() => { /* timeout — proceed anyway */ });
				if (this.deps.signal.aborted) return;
				this.deps.appendProjectHubLog("Done.");
				this.deps.endProjectHubWork(r);
				void this.deps.loadProject(name);
			})();
		}) as EventListener);
	}
}
```

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-git-handler.ts"
git commit -m "feat(plugin): create GitImportHandler with busy-state leak fix and shadow DOM elimination"
```

---

### Task 8: Create ConfigCatalogHandler class

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-config-handler.ts`

- [ ] **Step 1: Create the file**

Port events from `wireConfigAndCatalogEvents` (lines 335-458 of project-handler-events.ts): `config-save`, `config-browse-folder`, `canvas-generate`, `canvas-merge`, `canvas-open`, `health-refresh`, `todo-*`, `catalog-*`, `report-*`.

Key fix — **Shadow DOM elimination** for config-save and config-browse-folder: set `el.configSaveStatus` and `el.configSourcePath` instead of `shadowRoot.querySelector("flowti-tab-config")`.

```ts
// config-save — replaces shadow DOM piercing
el.addEventListener("config-save", ((e: CustomEvent) => {
	if (el.projectHubBusy) return;
	const detail = e.detail as { path: string; strategy: string; requiredFields: string[] };
	const config: MarkdownSourceConfig = { ... };
	this.deps.startProjectHubWork("Saving markdown source config…");
	void this.deps.projectService.saveMarkdownSourceConfig(this.deps.getCurrentProject(), config, (l) => this.deps.appendProjectHubLog(l)).then((r) => {
		this.deps.endProjectHubWork(r);
		if (!this.deps.signal.aborted) {
			el.configSaveStatus = r.ok ? "Saved" : (r.error ?? "Save failed");
			setTimeout(() => { if (!this.deps.signal.aborted && el.configSaveStatus) el.configSaveStatus = ""; }, 3000);
		}
	});
}) as EventListener);

// config-browse-folder — replaces shadow DOM piercing
el.addEventListener("config-browse-folder", (() => {
	if (!this.deps.pickFolder) return;
	void this.deps.pickFolder().then((folder) => {
		if (folder !== null && !this.deps.signal.aborted) {
			el.configSourcePath = folder;
		}
	});
}) as EventListener);
```

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-config-handler.ts"
git commit -m "feat(plugin): create ConfigCatalogHandler with shadow DOM elimination for config tab"
```

---

### Task 9: Create TeamHandler class

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-team-handler.ts`

- [ ] **Step 1: Create the file**

Port team events from `wireConfigAndCatalogEvents` (lines 427-457): `team-roster-save`, `team-create-agent`, `team-refresh-agents`, `team-roster-error`.

```ts
import type { IProjectService, ProjectDetailElement, TeamRoleSlot } from "../../domain/projects/types.js";

export interface TeamHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly startProjectHubWork: (label: string) => void;
	readonly appendProjectHubLog: (line: string) => void;
	readonly endProjectHubWork: (result: { ok: boolean; error?: string }) => void;
}

export class TeamHandler {
	private readonly deps: TeamHandlerDeps;

	constructor(deps: TeamHandlerDeps) {
		this.deps = deps;
		this.wireEvents();
	}

	dispose(): void {}

	private wireEvents(): void {
		const { el } = this.deps;

		el.addEventListener("team-roster-save", ((e: CustomEvent) => {
			if (el.projectHubBusy) return;
			const slots = (e.detail?.slots ?? []) as TeamRoleSlot[];
			this.deps.startProjectHubWork("Saving team roster");
			void this.deps.projectService.saveTeamRoster(this.deps.getCurrentProject(), slots, (l) => this.deps.appendProjectHubLog(l))
				.then((r) => this.deps.endProjectHubWork(r));
		}) as EventListener);

		el.addEventListener("team-create-agent", ((e: CustomEvent) => {
			if (el.projectHubBusy) return;
			const d = e.detail as { roleId?: string; agentName?: string; slots?: TeamRoleSlot[] };
			const roleId = String(d?.roleId ?? "");
			const agentName = String(d?.agentName ?? "");
			const slots = Array.isArray(d?.slots) ? d.slots : undefined;
			el.agentCreationContext = { roleId, agentName };
			this.deps.startProjectHubWork(`Saving agent "${agentName}"…`);
			this.deps.appendProjectHubLog(`Starting — create or update vault note for "${agentName}", then refresh the roster.`);
			void this.deps.projectService
				.createAgentFromRole(this.deps.getCurrentProject(), roleId, agentName, (l) => this.deps.appendProjectHubLog(l), slots)
				.then((r) => this.deps.endProjectHubWork(r))
				.finally(() => { if (!this.deps.signal.aborted) el.agentCreationContext = null; });
		}) as EventListener);

		el.addEventListener("team-refresh-agents", (() => {
			void this.deps.projectService.listVaultAgents().then((a) => {
				if (!this.deps.signal.aborted) el.vaultAgents = [...a];
			});
		}) as EventListener);

		el.addEventListener("team-roster-error", ((e: CustomEvent) => {
			if (this.deps.signal.aborted) return;
			const msg = String((e.detail as { message?: string })?.message ?? "Team roster error");
			el.statusMessage = msg;
			setTimeout(() => { if (!this.deps.signal.aborted && el.statusMessage === msg) el.statusMessage = ""; }, 5000);
		}) as EventListener);
	}
}
```

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-team-handler.ts"
git commit -m "feat(plugin): create TeamHandler class"
```

---

### Task 10: Refactor orchestrator with AbortController, typed element, and bug fixes

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`

- [ ] **Step 1: Update imports**

Replace the import of `wireStorybookEvents`, `wireScaffoldAndRegenerateEvents`, `wireGitImportEvents`, `wireConfigAndCatalogEvents` and `ProjectEventContext` with imports of the four handler classes:

```ts
import type { IProjectService, ProjectDetailElement } from "../../domain/projects/types.js";
import type { VaultFileAdapter } from "../vault-adapter.js";
import { StorybookHandler } from "./project-storybook-handler.js";
import { GitImportHandler } from "./project-git-handler.js";
import { ConfigCatalogHandler } from "./project-config-handler.js";
import { TeamHandler } from "./project-team-handler.js";
```

- [ ] **Step 2: Add AbortController and typed element**

At the start of `mountProjectDetail`:

```ts
const controller = new AbortController();
const { signal } = controller;
const el = document.createElement("flowti-project-detail") as ProjectDetailElement;
```

- [ ] **Step 3: Add signal checks to loadProject and loadProjectList**

Fix 6 — add `.catch()` to fire-and-forget loads. Fix 4 — handle `loadProjectList` errors:

```ts
async function loadProjectList(): Promise<void> {
	const projects = await projectService.listProjects();
	if (signal.aborted) return;
	el.projects = [...projects];
	el.cliConnected = true;
}

async function loadProject(name: string): Promise<void> {
	if (signal.aborted) return;
	currentProject = name;
	// ... reset all properties (same as current) ...

	const detail = await projectService.getProject(name);
	if (signal.aborted) return;
	if (!detail) { /* same fallback as current */ return; }
	// ... set properties from detail (same as current) ...

	// Fire-and-forget with error handling (Fix 6)
	void projectService.getHealth(name)
		.then((r) => { if (!signal.aborted && r.ok && r.score) el.healthScore = r.score; })
		.catch(() => { if (!signal.aborted) el.healthError = "Health check unavailable"; });
	void projectService.getTodos(name)
		.then((r) => { if (!signal.aborted) { el.todos = r.items; el.todosExist = r.exists; } })
		.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load TODOs"); });
	void projectService.listComponents(name)
		.then((c) => { if (!signal.aborted) el.components = c; })
		.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load components"); });
	void projectService.getReportGenerators(name)
		.then((g) => { if (!signal.aborted) el.reportGenerators = g; })
		.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load report generators"); });
	void projectService.listEntities(name, "domains")
		.then((entities) => { if (!signal.aborted) el.catalogEntities = entities; })
		.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load catalog entities"); });
	try {
		el.vaultAgents = [...await projectService.listVaultAgents()];
	} catch {
		if (!signal.aborted) el.vaultAgents = [];
	}
}
```

- [ ] **Step 4: Keep shared projectHub work-queue helpers**

These stay in the orchestrator (shared by Git, Config, Team handlers):

```ts
const projectHubLines: string[] = [];
let lastProjectHubLabel = "";

function startProjectHubWork(label: string): void { /* same as current, add signal check */ }
function appendProjectHubLog(line: string): void { /* same, add signal check */ }
function endProjectHubWork(result: { ok: boolean; error?: string }): void { /* same, add signal check */ }
```

- [ ] **Step 5: Instantiate four handlers**

```ts
const storybook = new StorybookHandler({
	el, signal, projectService,
	getCurrentProject: () => currentProject,
	loadProject,
	revealFolder: deps.revealFolder,
	pickFolder: deps.pickFolder,
});

const git = new GitImportHandler({
	el, signal, projectService,
	getCurrentProject: () => currentProject,
	loadProject, loadProjectList,
	startProjectHubWork, appendProjectHubLog, endProjectHubWork,
	createNote: deps.createNote,
});

const config = new ConfigCatalogHandler({
	el, signal, projectService,
	getCurrentProject: () => currentProject,
	startProjectHubWork, appendProjectHubLog, endProjectHubWork,
	openNote: deps.openNote,
	pickFolder: deps.pickFolder,
});

const team = new TeamHandler({
	el, signal, projectService,
	getCurrentProject: () => currentProject,
	startProjectHubWork, appendProjectHubLog, endProjectHubWork,
});
```

- [ ] **Step 6: Remove old wireEvents calls and ProjectEventContext**

Delete lines calling `wireStorybookEvents(ctx)`, `wireScaffoldAndRegenerateEvents(ctx)`, `wireGitImportEvents(ctx)`, `wireConfigAndCatalogEvents(ctx)` and the `ctx` object construction.

Remove the `startStorybookWork`, `appendStorybookLog`, `endStorybookWork`, `clearStorybookLogBuffer` functions — they now live in `StorybookHandler`.

- [ ] **Step 7: Update back-to-list handler**

Add git modal property resets:

```ts
el.addEventListener("back-to-list", (() => {
	currentProject = "";
	el.projectName = "";
	el.agentCreationContext = null;
	el.storybookBusy = false;
	el.storybookBusyLabel = "";
	el.storybookOutput = [];
	el.storybookError = "";
	el.projectHubBusy = false;
	el.projectHubBusyLabel = "";
	el.projectHubOutput = [];
	el.projectHubError = "";
	el.actionSuccess = "";
	el.gitImportStep = "form";
	el.gitImportError = "";
	el.gitImportOutputLines = [];
	el.gitImportDetected = null;
	el.configSaveStatus = "";
	el.configSourcePath = "";
	void loadProjectList().catch(() => {
		if (!signal.aborted) el.projectHubError = "Failed to load project list";
	});
}) as EventListener);
```

- [ ] **Step 8: Update dispose to abort + dispose handlers**

```ts
return () => {
	controller.abort();
	storybook.dispose();
	git.dispose();
	config.dispose();
	team.dispose();
	el.remove();
};
```

- [ ] **Step 9: Update initial load error handling (Fix 4)**

```ts
if (currentProject) {
	void loadProject(currentProject);
} else {
	void loadProjectList().catch(() => {
		if (!signal.aborted) el.projectHubError = "Failed to load project list";
	});
}
```

- [ ] **Step 10: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "refactor(plugin): orchestrator with AbortController, typed element, 4 handler classes, bug fixes"
```

---

### Task 11: Delete project-handler-events.ts

**Files:**
- Delete: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handler-events.ts`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "project-handler-events" "01 - Projects/Flowti Plugin/src/"`
Expected: No results (all imports replaced in Task 10)

- [ ] **Step 2: Delete the file**

```bash
git rm "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handler-events.ts"
```

- [ ] **Step 3: Type check and tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit && npx vitest run`
Expected: Both PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(plugin): delete monolithic project-handler-events.ts (replaced by 4 handler classes)"
```

---

### Task 12: Update tests for handler decomposition

**Files:**
- Modify: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`

- [ ] **Step 1: Update test assertions**

The existing tests dispatch events on the `flowti-project-detail` element and check that the service was called. This still works — the events bubble up to the element and are caught by the handlers wired in the constructor. The main changes:

1. Update the `Record<string, unknown>` cast to use `ProjectDetailElement` import
2. Add a test for dispose calling `controller.abort()` (verify storybook polling stops)
3. Add a test for `loadProjectList` error handling (Fix 4)
4. If any tests access `storybookLines` or internal state, update for new handler structure

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS

- [ ] **Step 3: Run full suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/"
git commit -m "test(plugin): update handler tests for decomposed architecture"
```

---

## Chunk 3: Visual Polish — Luminous Dashboard

### Task 13: Hub design tokens + shared styles

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail-styles.ts:3-9` (`:host` block)
- Modify: `01 - Projects/Flowti Plugin/src/components/shared-styles.ts`

- [ ] **Step 1: Extend `:host` with hub tokens**

In `flowti-project-detail-styles.ts`, inside the existing `:host { ... }` block (lines 4-9), add after the existing properties:

```css
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
```

- [ ] **Step 2: Add hubCard and hubButton to shared-styles.ts**

Append at the end of `shared-styles.ts`:

```ts
/** Card pattern for project hub — uses --hub-* tokens (fallbacks for standalone use). */
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

/** Button pattern for project hub — uses --hub-* tokens (fallbacks for standalone use). */
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

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail-styles.ts" \
        "01 - Projects/Flowti Plugin/src/components/shared-styles.ts"
git commit -m "feat(plugin): add hub design tokens and shared hubCard/hubButton styles"
```

---

### Task 14: Project list card redesign + tab bar + activity bar

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail-styles.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts`

- [ ] **Step 1: Update project-item styles to luminous cards**

In `flowti-project-detail-styles.ts`, replace the `.project-item` block (lines 135-152) with:

```css
.project-item {
	display: flex;
	align-items: center;
	gap: var(--flowti-space-sm, 8px);
	padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
	border-radius: var(--hub-radius, 6px);
	cursor: pointer;
	border: 1px solid var(--background-modifier-border, #333);
	background: var(--hub-surface-1, var(--background-secondary, #1a1a1a));
	color: var(--text-normal, #ddd);
	text-align: left;
	width: 100%;
	font-size: var(--flowti-font-sm, 0.85em);
	box-sizing: border-box;
	transition: border-color var(--hub-transition, 150ms ease),
	            box-shadow var(--hub-transition, 150ms ease),
	            transform var(--hub-transition, 150ms ease);
	animation: card-enter 200ms ease both;
	animation-delay: calc(var(--i, 0) * 30ms);
}

.project-item:hover {
	border-color: color-mix(in srgb, var(--interactive-accent, #7c3aed) 30%, var(--background-modifier-border, #333));
	box-shadow: var(--hub-glow);
	transform: translateY(-1px);
}

@keyframes card-enter {
	from { opacity: 0; transform: translateY(4px); }
	to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Add stagger index to renderProjectItem**

In `flowti-project-detail.ts`, update the `renderProjectList` map call to pass the index. Change:

```ts
: html`<div class="project-list">${filtered.map((p) => this.renderProjectItem(p))}</div>`
```

to:

```ts
: html`<div class="project-list">${filtered.map((p, i) => this.renderProjectItem(p, i))}</div>`
```

Update `renderProjectItem` signature:

```ts
private renderProjectItem(p: ProjectSummary, index = 0) {
	return html`
		<button class="project-item" style="--i: ${index}" @click="${() => this.selectProject(p.name)}">
```

- [ ] **Step 3: Update tab bar styles**

Replace `.tab-btn` styles (lines 299-323) with:

```css
.tab-bar {
	display: flex;
	gap: 0;
	border-bottom: 1px solid var(--background-modifier-border, #333);
	margin-bottom: var(--flowti-space-sm, 8px);
	overflow-x: auto;
	scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-btn {
	padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
	border: none;
	border-bottom: 2px solid transparent;
	background: none;
	color: var(--text-muted, #999);
	font-size: 0.8em;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	cursor: pointer;
	white-space: nowrap;
	transition: color var(--hub-transition, 150ms ease),
	            background var(--hub-transition, 150ms ease),
	            border-color var(--hub-transition, 150ms ease);
}

.tab-btn:hover {
	color: var(--text-normal, #ddd);
	background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 5%, transparent);
}

.tab-btn:focus-visible {
	outline: 2px solid var(--interactive-accent, #7c3aed);
	outline-offset: 2px;
	border-radius: 2px;
}

.tab-btn--active {
	color: var(--interactive-accent, #7c3aed);
	border-bottom-color: var(--interactive-accent, #7c3aed);
	font-weight: 600;
	box-shadow: 0 2px 8px color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
}
```

- [ ] **Step 4: Update activity bar with transitions**

Replace `.activity-bar` styles (lines 325-383) with animated versions:

```css
.activity-bar {
	display: flex;
	align-items: center;
	gap: var(--flowti-space-sm, 8px);
	padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
	border-radius: var(--hub-radius, 6px);
	font-size: var(--flowti-font-sm, 0.85em);
	transition: background var(--hub-transition-slow, 300ms ease),
	            color var(--hub-transition-slow, 300ms ease);
}

.activity-bar--busy {
	background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 10%, transparent);
	color: var(--interactive-accent, #7c3aed);
}

.activity-bar--success {
	background: color-mix(in srgb, var(--color-green, #4caf50) 12%, transparent);
	color: var(--color-green, #4caf50);
	animation: success-flash 600ms ease;
}

@keyframes success-flash {
	0% { background: color-mix(in srgb, var(--color-green, #4caf50) 25%, transparent); }
	100% { background: color-mix(in srgb, var(--color-green, #4caf50) 12%, transparent); }
}

.activity-bar--error {
	background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
	color: var(--color-red, #e53935);
	animation: shake 300ms ease;
}

@keyframes shake {
	0%, 100% { transform: translateX(0); }
	25% { transform: translateX(-2px); }
	75% { transform: translateX(2px); }
}

.activity-spinner {
	display: inline-block;
	width: 14px;
	height: 14px;
	border: 2px solid currentColor;
	border-top-color: transparent;
	border-radius: 50%;
	animation: spin 0.8s linear infinite, spinner-enter 150ms ease;
	flex-shrink: 0;
}

@keyframes spinner-enter {
	from { opacity: 0; transform: scale(0.5) rotate(0deg); }
	to { opacity: 1; transform: scale(1) rotate(0deg); }
}

.activity-dismiss {
	margin-left: auto;
	background: none;
	border: none;
	color: inherit;
	cursor: pointer;
	font-size: 1.1em;
	padding: 0 4px;
	opacity: 0;
	animation: fade-in 150ms ease 150ms forwards;
}

@keyframes fade-in {
	to { opacity: 0.6; }
}

.activity-dismiss:hover { opacity: 1; }

.activity-dismiss:focus-visible {
	outline: 2px solid var(--interactive-accent, #7c3aed);
	outline-offset: 2px;
	border-radius: 2px;
}
```

- [ ] **Step 5: Update CLI log terminal feel**

Replace `.hub-cli-log` styles (lines 228-290) with terminal-feel versions:

```css
.hub-cli-log {
	margin-bottom: var(--flowti-space-sm, 8px);
	border: 1px solid var(--background-modifier-border, #333);
	border-radius: var(--hub-radius, 6px);
	background: var(--hub-surface-1, var(--background-secondary, #1a1a1a));
	overflow: hidden;
}

.hub-cli-log--active {
	border-left: 3px solid var(--interactive-accent, #7c3aed);
}

.hub-cli-log__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 6px 10px;
	border-bottom: 1px solid var(--background-modifier-border, #333);
}

.hub-cli-log__title {
	font-size: 0.75em;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--text-muted, #999);
}

.hub-cli-log__clear {
	padding: 2px 8px;
	font-size: 0.85em;
	border-radius: var(--hub-radius, 6px);
	border: 1px solid var(--background-modifier-border, #444);
	background: var(--background-primary, #1e1e1e);
	color: var(--text-muted, #aaa);
	cursor: pointer;
}

.hub-cli-log__clear:hover:not(:disabled) { color: var(--text-normal, #ddd); }
.hub-cli-log__clear:disabled { opacity: 0.35; cursor: not-allowed; }
.hub-cli-log__clear:focus-visible {
	outline: 2px solid var(--interactive-accent, #7c3aed);
	outline-offset: 2px;
}

.hub-cli-log__pre {
	margin: 0;
	padding: 8px 10px;
	max-height: 200px;
	overflow: auto;
	font-family: var(--flowti-font-mono, var(--font-monospace));
	font-size: 11px;
	line-height: 1.4;
	color: var(--text-muted, #bbb);
	background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 3%, var(--hub-surface-0, var(--background-primary, #141414)));
	box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 6: Remove old .empty-state (replaced by shared pattern)**

Remove the local `.empty-state` and `.empty-pulse` definitions (lines 199-218) from `flowti-project-detail-styles.ts`. Import `emptyState` from `shared-styles.ts` into `FlowtiProjectDetail`'s `static styles` array.

In `flowti-project-detail.ts`, add import:
```ts
import { emptyState } from "../shared-styles.js";
```

Add to static styles:
```ts
static styles = [
	...FlowtiElement.styles,
	tokens,
	emptyState,
	projectDetailStyles,
];
```

- [ ] **Step 7: Update border-radius on remaining elements**

In `flowti-project-detail-styles.ts`, update:
- `.back-btn` border-radius: `var(--hub-radius, 6px)`
- `.modal` border-radius: `var(--hub-radius-lg, 10px)`
- `.search-input` border-radius: `var(--hub-radius, 6px)`
- `.status-banner` border-radius: `var(--hub-radius, 6px)`
- `.btn` border-radius: `var(--hub-radius, 6px)`

- [ ] **Step 8: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit && npx vitest run`
Expected: Both PASS

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail-styles.ts" \
        "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin): luminous project cards, polished tab bar, animated activity bar, terminal CLI logs"
```

---

### Task 15: Health score gauge component

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/components/projects/flowti-health-gauge.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-overview.ts`

- [ ] **Step 1: Create the health gauge component**

~80 lines. SVG arc gauge with animated `stroke-dashoffset`:

```ts
import { html, css, svg } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { HealthScore } from "../../domain/projects/types.js";

const gaugeStyles = css`
	:host { display: block; width: 120px; height: 114px; }
	.gauge { width: 100%; height: 100%; }
	.arc-bg { fill: none; stroke: var(--background-modifier-border, #333); stroke-width: 8; }
	.arc-fill {
		fill: none;
		stroke-width: 8;
		stroke-linecap: round;
		transition: stroke-dashoffset 500ms ease-out, stroke 300ms ease;
	}
	.score-text {
		font-size: 20px;
		font-weight: 700;
		fill: var(--text-normal, #ddd);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.grade-text {
		font-size: 10px;
		font-weight: 500;
		fill: var(--text-muted, #999);
		text-anchor: middle;
	}
	.error { font-size: var(--flowti-font-sm, 0.85em); color: var(--color-red, #e53935); }
`;

export class FlowtiHealthGauge extends FlowtiElement {
	static properties = { ...FlowtiElement.properties, score: { type: Object }, error: { type: String } };
	static styles = [tokens, gaugeStyles];

	score: HealthScore | null = null;
	error = "";

	protected renderContent() {
		if (this.error) return html`<span class="error">${this.error}</span>`;
		if (!this.score) return html`<span class="muted">—</span>`;

		const pct = Math.max(0, Math.min(100, this.score.overall));
		// 270-degree arc: gap at bottom. Center at (50,50), r=40.
		// Endpoints at 135° and 45° (symmetric about vertical axis).
		// 135° → (50 + 40*cos(135°), 50 + 40*sin(135°)) ≈ (21.72, 78.28)
		//  45° → (50 + 40*cos(45°),  50 + 40*sin(45°))  ≈ (78.28, 78.28)
		const r = 40;
		const arcLength = Math.PI * r * 1.5; // 270° arc length
		const offset = arcLength * (1 - pct / 100);
		const color = pct < 40 ? "var(--color-red, #e53935)"
			: pct < 70 ? "var(--color-yellow, #e5a00d)"
			: "var(--color-green, #4caf50)";

		return html`
			<svg class="gauge" viewBox="0 0 100 95">
				${svg`
					<path class="arc-bg" d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28" />
					<path class="arc-fill"
						d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28"
						style="stroke: ${color}; stroke-dasharray: ${arcLength}; stroke-dashoffset: ${offset};
						       filter: drop-shadow(0 0 4px ${color});" />
					<text class="score-text" x="50" y="50">${pct}</text>
					<text class="grade-text" x="50" y="65">${this.score.grade}</text>
				`}
			</svg>
		`;
	}
}

if (!customElements.get("flowti-health-gauge")) customElements.define("flowti-health-gauge", FlowtiHealthGauge);
```

- [ ] **Step 2: Integrate into flowti-tab-overview**

Add side-effect import at top of `flowti-tab-overview.ts`:

```ts
import "./flowti-health-gauge.js";
```

In the health section of `renderContent()`, replace the entire conditional score/error block:
- Remove the `.score` span (e.g., `<span class="score">${this.healthScore?.overall}</span>`)
- Remove the conditional `healthError` span (e.g., `${this.healthError ? html`...` : ""}`)
- **Keep** the "Refresh" button — it stays as-is

Replace the removed score/error elements with a single gauge component that handles both states internally:

```html
<flowti-health-gauge .score="${this.healthScore}" .error="${this.healthError}"></flowti-health-gauge>
```

The gauge shows the SVG arc when `score` is set, shows the error when `error` is set, and shows "—" when neither is set. No duplicate error display.

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-health-gauge.ts" \
        "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-overview.ts"
git commit -m "feat(plugin): add SVG health gauge component with animated arc and color transitions"
```

---

### Task 16: Consistency pass across all tab components

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-overview.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-components.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-event-catalog.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-reporting.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-config.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-team.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-scaffold-modal.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-add-project-dropdown.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-git-import-modal-styles.ts`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts`

- [ ] **Step 1: Read each file to identify specific changes**

For each file, check:
- Border radius values → replace with `var(--hub-radius, 6px)` or `var(--hub-radius-lg, 10px)`
- Button padding → standardize to `6px 14px` or `4px 10px` for compact
- Focus styles → unify to `outline: 2px solid accent; outline-offset: 2px`
- Hardcoded spacing → replace with `--flowti-space-*` tokens
- `margin-bottom` for section gaps → replace with `gap` on flex containers
- Local button reimplementation → import `hubButton` from shared-styles
- Local empty state → import `emptyState` from shared-styles

- [ ] **Step 2: Apply changes to each file**

For each tab component:
1. Import `hubButton` from `../shared-styles.js` and add to `static styles`
2. Replace local `.btn` class with `.hub-btn` class in both styles and templates
3. Unify border-radius to use `var(--hub-radius)` / `var(--hub-radius-lg)`
4. Add `transition: background var(--hub-transition, 150ms ease), transform var(--hub-transition, 150ms ease)` to interactive elements
5. Replace `margin-right/margin-bottom` spacing with flex `gap` (especially Reporting tab)

For `flowti-tab-config.ts`: accept `saveStatus` and `sourcePath` as properties (add to `static properties` and class fields if not already present).

For `flowti-tab-team.ts`: align `.card` border-radius from local `--flowti-team-radius: 10px` to shared `--hub-radius-lg`.

- [ ] **Step 3: Type check and test**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit && npx vitest run`
Expected: Both PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/"
git commit -m "feat(plugin): consistency pass — unified radius, button styles, spacing, and focus patterns across all tabs"
```

---

### Task 17: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/`
Expected: Clean (or only pre-existing warnings)

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Successful build

- [ ] **Step 5: Verify no remaining shadow DOM piercing**

Run: `grep -rn "shadowRoot?.querySelector" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/"`
Expected: No results

- [ ] **Step 6: Verify no remaining Record<string, unknown> on el**

Run: `grep -rn "Record<string, unknown>" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/"`
Expected: No results

- [ ] **Step 7: Verify project-handler-events.ts is gone**

Run: `ls "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handler-events.ts" 2>/dev/null; echo $?`
Expected: Exit code 2 (file not found)

- [ ] **Step 8: Verify 500ms magic timeout is gone**

Run: `grep -rn "setTimeout.*500" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/"`
Expected: No results

- [ ] **Step 9: Verify AbortController is wired**

Run: `grep -rn "AbortController" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"`
Expected: At least 1 result
