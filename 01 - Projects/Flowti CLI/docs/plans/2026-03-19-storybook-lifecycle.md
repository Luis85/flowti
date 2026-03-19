# Storybook Lifecycle Flow — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guided storybook lifecycle — install → prompt scaffold → scaffold → start — with a single-button regenerate flow.

**Architecture:** Plugin UI drives the lifecycle via events. CLI handles all domain operations (install, clean, scaffold). A new Lit modal component prompts the user after install. The regenerate flow chains clean → install → scaffold → start in sequence.

**Tech Stack:** Lit (web components), Vitest, CLI command engine (adaptDescriptor)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-storybook-lifecycle-design.md`

---

## Chunk 1: Domain Types + CLI storybook:clean

### Task 1: Add `hasSitemap` to ProjectDetail and `cleanStorybook` to IProjectService

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts:21-25` (ProjectDetail)
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts:55-65` (IProjectService)
- Modify: `01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts`

- [ ] **Step 1: Write failing type tests**

Add to `01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts` after the last `it()` block:

```typescript
it("ProjectDetail has hasSitemap field", () => {
	expectTypeOf<ProjectDetail>().toHaveProperty("hasSitemap");
});

it("IProjectService has cleanStorybook method", () => {
	expectTypeOf<IProjectService>().toHaveProperty("cleanStorybook");
});
```

Update the import at the top to include `ProjectDetail`:
```typescript
import type {
	StorybookStatus, ProjectSummary, ProjectDetail,
	StorybookFramework, IProjectService, MarkdownSourceConfig, ProjectConfig,
} from "../../../src/domain/projects/types";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/types.test.ts`
Expected: FAIL — `hasSitemap` not found on ProjectDetail, `cleanStorybook` not found on IProjectService

- [ ] **Step 3: Add hasSitemap to ProjectDetail**

In `01 - Projects/Flowti Plugin/src/domain/projects/types.ts`, modify `ProjectDetail` (line 21):

```typescript
export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
	readonly hasSitemap: boolean;
	readonly config?: ProjectConfig;
}
```

- [ ] **Step 4: Add cleanStorybook to IProjectService**

In `01 - Projects/Flowti Plugin/src/domain/projects/types.ts`, add after `saveMarkdownSourceConfig` (line 64):

```typescript
	cleanStorybook(project: string): Promise<{ ok: boolean; error?: string }>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/types.test.ts`
Expected: PASS — all type tests green

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts"
git commit -m "feat(plugin): add hasSitemap to ProjectDetail and cleanStorybook to IProjectService"
```

---

### Task 2: Add CLI `storybook:clean` command

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/controller/storybook.controller.ts:271` (before closing `};`)
- Modify: `01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts`

- [ ] **Step 1: Write failing test**

Add to `01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts` at the end:

```typescript
describe("storybook:clean", () => {
	it("deletes the components directory when it exists", () => {
		const handler = getHandler("storybook:clean");
		const ctx = createProjectContext({ command: "storybook:clean", flags: {} });
		ctx.deps.disk.existsSync = vi.fn(() => true);
		ctx.deps.disk.rmSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("cleaned", true);
		expect(ctx.deps.disk.rmSync).toHaveBeenCalledWith(
			expect.stringContaining("components"),
			{ recursive: true, force: true },
		);
	});

	it("returns cleaned true even when directory does not exist", () => {
		const handler = getHandler("storybook:clean");
		const ctx = createProjectContext({ command: "storybook:clean", flags: {} });
		ctx.deps.disk.existsSync = vi.fn(() => false);
		ctx.deps.disk.rmSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("cleaned", true);
		expect(ctx.deps.disk.rmSync).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `storybook:clean` not registered

- [ ] **Step 3: Implement storybook:clean command**

In `01 - Projects/Flowti CLI/src/controller/storybook.controller.ts`, add before the closing `};` (after the `storybook:import` block):

```typescript
	"storybook:clean": adaptDescriptor<Record<string, never>, { cleaned: boolean; dir: string }>({
		requires: "project",
		handler: (ctx) => {
			const config = ctx.project!.config.components ?? {};
			const sbDir = resolveStorybookDir(ctx.project!.path, config, { paths: ctx.deps.paths });
			if (ctx.deps.disk.existsSync(sbDir)) {
				ctx.deps.disk.rmSync(sbDir, { recursive: true, force: true });
			}
			return { cleaned: true, dir: sbDir };
		},
		renderer: (data, log) => { log(`Cleaned ${data.dir}`); },
	}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS — all 15 tests green

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts" "01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts"
git commit -m "feat(cli): add storybook:clean command for regenerate flow"
```

---

### Task 3: Implement cleanStorybook in service layer + hasSitemap detection

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts:230-238` (getProject return), and add `cleanStorybook` method
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts` (stub)
- Modify: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts:7-26` (mockService)

- [ ] **Step 1: Add cleanStorybook to VaultProjectService**

In `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts`, add after `saveMarkdownSourceConfig` method:

```typescript
	async cleanStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		return runAsync("node", [cliBin, "storybook:clean", `--project="${project}"`], vaultBase);
	}
```

- [ ] **Step 2: Add hasSitemap to getProject return**

In `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts`, modify the return block (line ~230). Add `hasSitemap` field:

```typescript
		const hasSitemap = existsSync(join(absProjectPath, "configs", "sitemap.json"))
			|| existsSync(join(absProjectPath, "imported-sitemap.json"));

		return {
			name,
			type,
			hasNote,
			notePath: hasNote ? notePath : null,
			projectPath,
			storybook,
			config: projectConfig,
			hasSitemap,
		};
```

- [ ] **Step 3: Add cleanStorybook stub to HttpProjectService**

In `01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts`, add after `saveMarkdownSourceConfig`:

```typescript
	async cleanStorybook(project: string): Promise<ApiResult> {
		return this.post("/api/storybook/clean", { project });
	}
```

- [ ] **Step 4: Update mockService in project-handlers test**

In `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`, add to the `mockService()` return object:

```typescript
		cleanStorybook: vi.fn(async () => ({ ok: true })),
```

And add `hasSitemap: false` to the `getProject` mock return.

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts tests/domain/projects/types.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts"
git commit -m "feat(plugin): implement cleanStorybook and hasSitemap detection"
```

---

## Chunk 2: Scaffold Modal Component

### Task 4: Create flowti-scaffold-modal component

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/components/projects/flowti-scaffold-modal.ts`

- [ ] **Step 1: Create the scaffold modal component**

Create `01 - Projects/Flowti Plugin/src/components/projects/flowti-scaffold-modal.ts`:

```typescript
/**
 * Scaffold modal — prompts user to generate components from sitemap after install.
 *
 * Three states:
 * 1. hasSitemap → "Generate from project sitemap" + Generate/Cancel
 * 2. hasMarkdownSource → "Import markdown then generate" + Import & Generate/Cancel
 * 3. Neither → "No sitemap found" + Dismiss
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";

export class FlowtiScaffoldModal extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		hasSitemap: { type: Boolean },
		hasMarkdownSource: { type: Boolean },
	};

	static styles = [
		tokens,
		css`
			:host {
				display: block;
			}

			.overlay {
				position: fixed;
				inset: 0;
				background: rgba(0, 0, 0, 0.6);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1000;
			}

			.modal {
				background: var(--background-primary, #1e1e1e);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 8px;
				padding: var(--flowti-space-lg, 24px);
				max-width: 420px;
				width: 90%;
			}

			.modal-title {
				font-weight: 600;
				font-size: 1.1em;
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.modal-body {
				color: var(--text-muted, #999);
				font-size: var(--flowti-font-sm, 0.85em);
				margin-bottom: var(--flowti-space-md, 16px);
				line-height: 1.5;
			}

			.modal-actions {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				justify-content: flex-end;
			}

			.btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border: 1px solid var(--background-modifier-border, #333);
				border-radius: 4px;
				background: var(--background-secondary, #262626);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.btn:hover {
				background: var(--background-modifier-hover, #333);
			}

			.btn--primary {
				background: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
				color: #fff;
			}

			.btn--primary:hover {
				filter: brightness(1.1);
			}
		`,
	];

	hasSitemap = false;
	hasMarkdownSource = false;

	protected renderContent() {
		if (this.hasSitemap) {
			return this.renderSitemapPrompt();
		}
		if (this.hasMarkdownSource) {
			return this.renderImportPrompt();
		}
		return this.renderNoSitemap();
	}

	private renderSitemapPrompt() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Generate components</div>
					<div class="modal-body">
						Generate story files from your project sitemap? This will create component stubs
						and stories in the components directory.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Cancel</button>
						<button class="btn btn--primary" @click="${this.dispatchConfirm}">Generate</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderImportPrompt() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">Generate components</div>
					<div class="modal-body">
						No project sitemap found, but a markdown source is configured. Import markdown
						files to build a sitemap, then generate component stubs and stories.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Cancel</button>
						<button class="btn btn--primary" @click="${this.dispatchConfirmWithImport}">Import &amp; Generate</button>
					</div>
				</div>
			</div>
		`;
	}

	private renderNoSitemap() {
		return html`
			<div class="overlay" @click="${this.dispatchDismiss}">
				<div class="modal" @click="${(e: Event) => e.stopPropagation()}">
					<div class="modal-title">No sitemap found</div>
					<div class="modal-body">
						Add a <code>configs/sitemap.json</code> or configure a markdown source
						in the Config tab to generate components.
					</div>
					<div class="modal-actions">
						<button class="btn" @click="${this.dispatchDismiss}">Dismiss</button>
					</div>
				</div>
			</div>
		`;
	}

	private dispatchConfirm(): void {
		this.dispatchEvent(new CustomEvent("scaffold-confirm", { bubbles: true, composed: true }));
	}

	private dispatchConfirmWithImport(): void {
		this.dispatchEvent(new CustomEvent("scaffold-confirm", {
			detail: { importFirst: true },
			bubbles: true, composed: true,
		}));
	}

	private dispatchDismiss(): void {
		this.dispatchEvent(new CustomEvent("scaffold-dismiss", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-scaffold-modal")) customElements.define("flowti-scaffold-modal", FlowtiScaffoldModal);
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/" | head -5`
Expected: No new errors from our file

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-scaffold-modal.ts"
git commit -m "feat(plugin): add scaffold modal component for post-install prompt"
```

---

## Chunk 3: Wire UI — storybook section + project detail + handlers

### Task 5: Update storybook section — replace Scaffold with Regenerate

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts:326-338` (renderInstalled)

- [ ] **Step 1: Replace Scaffold button with Regenerate in installed-idle state**

In `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts`, replace the `renderInstalled()` method (lines 326-338):

```typescript
private renderInstalled() {
	return html`
		<div class="status-row">
			<span class="framework-badge">${this.framework}</span>
			<span class="status-label">Installed</span>
		</div>
		<div class="actions">
			<button class="action-btn action-btn--primary" @click="${() => this.dispatchStart()}" title="Launch dev server on localhost:6006">Start</button>
			<button class="action-btn" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
			<button class="action-btn" @click="${() => this.dispatchOpenFolder()}" title="Open .storybook config directory">Open folder</button>
			<button class="action-btn action-btn--danger" @click="${() => this.dispatchRegenerate()}" title="Delete and recreate component library from sitemap">Regenerate</button>
		</div>
	`;
}
```

- [ ] **Step 2: Add dispatchRegenerate method**

Add after the existing `dispatchScaffold` method:

```typescript
private dispatchRegenerate(): void {
	this.dispatchEvent(new CustomEvent("storybook-regenerate", { bubbles: true, composed: true }));
}
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts"
git commit -m "feat(plugin): replace scaffold button with regenerate in storybook section"
```

---

### Task 6: Wire scaffold modal into project detail

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts`

- [ ] **Step 1: Add import and properties**

Add side-effect import (after the existing `import "./flowti-config-tab.js";`):

```typescript
import "./flowti-scaffold-modal.js";
```

Add to `static properties` block:

```typescript
		showScaffoldModal: { type: Boolean },
		hasSitemap: { type: Boolean },
		hasMarkdownSource: { type: Boolean },
```

Add instance properties (after `activeTab = "overview";`):

```typescript
	showScaffoldModal = false;
	hasSitemap = false;
	hasMarkdownSource = false;
```

- [ ] **Step 2: Render modal in renderContent**

Modify `renderContent()` — add the modal render at the end, before the closing backtick:

```typescript
	protected renderContent() {
		if (!this.projectName) {
			return this.renderProjectList();
		}
		return html`
			${this.renderHeader()}
			${this.statusMessage ? html`<div class="status-banner">${this.statusMessage}</div>` : ""}
			${this.renderTabBar()}
			${this.activeTab === "overview" ? html`
				${this.renderConfigSection()}
				${this.renderNoteSection()}
				${this.renderStorybookSection()}
			` : ""}
			${this.activeTab === "config" ? html`
				<flowti-config-tab
					.projectName="${this.projectName}"
					.config="${this.config}"
				></flowti-config-tab>
			` : ""}
			${this.showScaffoldModal ? html`
				<flowti-scaffold-modal
					.hasSitemap="${this.hasSitemap}"
					.hasMarkdownSource="${this.hasMarkdownSource}"
				></flowti-scaffold-modal>
			` : ""}
		`;
	}
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin): wire scaffold modal into project detail view"
```

---

### Task 7: Rework event handlers — install, scaffold-confirm, scaffold-dismiss, regenerate

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`
- Modify: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`

- [ ] **Step 1: Write tests for new handler behavior**

Add to `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts` before the `dispose` test:

```typescript
	it("install success shows scaffold modal instead of starting", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" }, bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(el.showScaffoldModal).toBe(true);
		expect(service.startStorybook).not.toHaveBeenCalled();
	});

	it("scaffold-confirm triggers scaffold then start", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("scaffold-confirm", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.scaffoldStorybook).toHaveBeenCalled();
	});

	it("scaffold-dismiss hides modal without starting", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.showScaffoldModal = true;
		el.dispatchEvent(new CustomEvent("scaffold-dismiss", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(el.showScaffoldModal).toBe(false);
		expect(service.startStorybook).not.toHaveBeenCalled();
	});

	it("storybook-regenerate chains clean → install → scaffold → start", async () => {
		const service = mockService();
		(service.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({
			name: "Alpha", type: "typescript", hasNote: true, notePath: "/p",
			projectPath: "/p", hasSitemap: true,
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null },
		});
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		// Simulate user confirming regenerate
		el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 50));
		expect(service.cleanStorybook).toHaveBeenCalledWith("Alpha");
		expect(service.installStorybook).toHaveBeenCalled();
		expect(service.scaffoldStorybook).toHaveBeenCalled();
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: FAIL — new tests fail because handlers don't exist yet

- [ ] **Step 3: Rework install handler (no auto-start, show modal)**

In `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`, replace the `storybook-install` listener (lines 108-112):

```typescript
	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		startBusy("Installing Storybook...");
		void projectService.installStorybook(currentProject, String(e.detail.framework) as StorybookFramework, appendOutput)
			.then((r) => {
				endBusy(r);
				if (r.ok) {
					// Show scaffold modal instead of auto-starting
					el.showScaffoldModal = true;
				}
			});
	}) as EventListener);
```

- [ ] **Step 4: Add scaffold-confirm handler**

Add after the `storybook-view` listener:

```typescript
	// ── Scaffold modal actions ──
	el.addEventListener("scaffold-confirm", ((e: CustomEvent) => {
		el.showScaffoldModal = false;
		const importFirst = e.detail?.importFirst === true;

		if (importFirst) {
			// Import markdown first, then scaffold, then start
			const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
			if (!savedPath) { return; }
			startBusy("Importing markdown...");
			void projectService.importMarkdownSitemap(currentProject, savedPath, appendOutput)
				.then((importResult) => {
					if (!importResult.ok) { endBusy(importResult); return; }
					appendOutput("Scaffolding components...");
					void projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true })
						.then((scaffoldResult) => {
							if (!scaffoldResult.ok) { endBusy(scaffoldResult); return; }
							appendOutput("Starting Storybook...");
							el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
							endBusy(scaffoldResult);
						});
				});
		} else {
			// Scaffold directly, then start
			startBusy("Scaffolding components...");
			void projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true })
				.then((r) => {
					if (!r.ok) { endBusy(r); return; }
					endBusy(r);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
		}
	}) as EventListener);

	el.addEventListener("scaffold-dismiss", (() => {
		el.showScaffoldModal = false;
	}) as EventListener);
```

- [ ] **Step 5: Add regenerate handler**

Add after the scaffold-dismiss listener:

```typescript
	// ── Regenerate flow ──
	el.addEventListener("storybook-regenerate", (() => {
		// Show confirmation by setting a flag the storybook section can read
		el.showRegenerateConfirm = true;
	}) as EventListener);

	el.addEventListener("storybook-regenerate-confirmed", (() => {
		el.showRegenerateConfirm = false;
		const framework = (el.storybook as { framework?: string })?.framework ?? "html";

		startBusy("Regenerating component library...");
		void projectService.cleanStorybook(currentProject)
			.then((cleanResult) => {
				if (!cleanResult.ok) { endBusy(cleanResult); return; }
				appendOutput("Re-installing Storybook...");
				return projectService.installStorybook(currentProject, framework as StorybookFramework, appendOutput);
			})
			.then((installResult) => {
				if (!installResult || !installResult.ok) { endBusy(installResult ?? { ok: false }); return; }
				appendOutput("Scaffolding components...");
				return projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true });
			})
			.then((scaffoldResult) => {
				if (!scaffoldResult || !scaffoldResult.ok) { endBusy(scaffoldResult ?? { ok: false }); return; }
				endBusy(scaffoldResult);
				el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
			});
	}) as EventListener);
```

- [ ] **Step 6: Remove the old storybook-scaffold listener**

Delete the old `storybook-scaffold` listener (lines 182-198) — scaffold is now triggered by `scaffold-confirm`, not a standalone event.

- [ ] **Step 7: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS — all tests including new ones

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts"
git commit -m "feat(plugin): rework storybook lifecycle — install→modal→scaffold→start + regenerate"
```

---

## Chunk 4: Build + Verify

### Task 8: Build both projects and full verification

**Files:** None (verification only)

- [ ] **Step 1: Run CLI full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All tests pass, no lint errors, no type errors

- [ ] **Step 2: Build CLI**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: `Built: .flowti/bin/main.mjs`

- [ ] **Step 3: Run Plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/ tests/infrastructure/handlers/`
Expected: All tests pass

- [ ] **Step 4: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `Build done... .obsidian/plugins/flowti-ibde`

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: address verification issues from storybook lifecycle implementation"
```
