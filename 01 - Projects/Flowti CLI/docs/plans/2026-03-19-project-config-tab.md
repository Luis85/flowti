# Project Config Tab Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Config tab to the project detail sidepanel with markdown sitemap importer settings (source folder, strategy, required fields) that persists to `flowti.config.json`.

**Architecture:** The project detail Lit component gets a two-tab bar (Overview | Config). The Config tab is a new standalone Lit component (`flowti-config-tab`) that dispatches a `config-save` event. The handler wires this to a new `saveMarkdownSourceConfig` method on `IProjectService`, which shells out to the CLI's `storybook:import --save-config` flag. The CLI uses the existing `writeComponentsConfig()` pattern.

**Tech Stack:** Lit (web components), TypeScript, Vitest, Obsidian API

---

## File Structure

### Plugin (`01 - Projects/Flowti Plugin/`)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/domain/projects/types.ts` | Modify | Add `MarkdownSourceConfig` type, extend `ProjectConfig`, extend `IProjectService` |
| `src/components/projects/flowti-config-tab.ts` | Create | Config tab Lit component: folder picker, strategy selector, required field chips, save button |
| `src/components/projects/flowti-project-detail.ts` | Modify | Add tab bar (Overview \| Config), conditional rendering per tab |
| `src/infrastructure/handlers/project-handlers.ts` | Modify | Wire `config-save` event, update `storybook-import` to skip picker when config exists |
| `src/infrastructure/projects/vault-project-service.ts` | Modify | Add `saveMarkdownSourceConfig()`, read `markdownSource` into `ProjectConfig` |
| `src/infrastructure/projects/http-project-service.ts` | Modify | Add `saveMarkdownSourceConfig()` stub |
| `tests/domain/projects/types.test.ts` | Modify | Add type assertion tests for new fields |
| `tests/infrastructure/handlers/project-handlers.test.ts` | Modify | Add config-save event test |
| `tests/infrastructure/projects/http-project-service.test.ts` | Modify | Add test for new method |

### CLI (`01 - Projects/Flowti CLI/`)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/controller/storybook.controller.ts` | Modify | Add `saveConfig` flag to `storybook:import`, write config when set |
| `tests/controller/storybook.controller.test.ts` | Modify | Add test for `--save-config` flag |

---

## Chunk 1: Domain Types + Service Layer

### Task 1: Extend plugin domain types

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts`
- Test: `01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts`

- [ ] **Step 1: Write the failing test for MarkdownSourceConfig type**

In `tests/domain/projects/types.test.ts`, add a test that asserts the type exists and can be used:

```typescript
it("MarkdownSourceConfig has required shape", () => {
	expectTypeOf<MarkdownSourceConfig>().toHaveProperty("path");
	expectTypeOf<MarkdownSourceConfig>().toHaveProperty("strategy");
	expectTypeOf<MarkdownSourceConfig>().toHaveProperty("requiredFields");
});

it("ProjectConfig accepts optional markdownSource", () => {
	expectTypeOf<ProjectConfig>().toHaveProperty("markdownSource");
	expectTypeOf<ProjectConfig["markdownSource"]>().toMatchTypeOf<MarkdownSourceConfig | undefined>();
});
```

Import `MarkdownSourceConfig` alongside the existing imports. Use `expectTypeOf` from vitest (already imported in the file) to match the file's type-assertion-only style.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/types.test.ts
```

Expected: FAIL — `MarkdownSourceConfig` does not exist, `markdownSource` not on `ProjectConfig`.

- [ ] **Step 3: Add types to domain**

In `src/domain/projects/types.ts`, add the strategy type and config interface before `ProjectConfig`:

```typescript
export type ImportStrategy = "category" | "flat" | "hierarchical";

export interface MarkdownSourceConfig {
	readonly path: string;
	readonly strategy: ImportStrategy;
	readonly requiredFields: readonly string[];
}
```

Then add to `ProjectConfig`:

```typescript
export interface ProjectConfig {
	readonly buildModes: readonly string[];
	readonly testPresets: readonly string[];
	readonly framework?: string;
	readonly healthTargets?: {
		readonly coverageMin?: number;
		readonly coverageTarget?: number;
		readonly maxLintErrors?: number;
		readonly maxLintWarnings?: number;
		readonly minTests?: number;
	};
	readonly agents?: readonly string[];
	readonly publishTargets?: readonly string[];
	readonly markdownSource?: MarkdownSourceConfig;
}
```

Then add `saveMarkdownSourceConfig` to `IProjectService`:

```typescript
export interface IProjectService {
	// ... existing methods ...
	saveMarkdownSourceConfig(project: string, config: MarkdownSourceConfig, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts"
git commit -m "feat(plugin/types): add MarkdownSourceConfig and saveMarkdownSourceConfig to IProjectService"
```

---

### Task 2: Add saveMarkdownSourceConfig to HttpProjectService

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/projects/http-project-service.test.ts`

- [ ] **Step 1: Write the failing test**

Note: `HttpProjectService` uses the global `fetch` API directly (not an `IHttpClient`). The existing test file uses an `IHttpClient` mock which is a pre-existing mismatch. For the new test, mock `globalThis.fetch` to match the actual implementation.

In `tests/infrastructure/projects/http-project-service.test.ts`, add a new describe block after the `scaffoldStorybook` block:

```typescript
describe("saveMarkdownSourceConfig", () => {
	it("posts to /api/storybook/config with project and config", async () => {
		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({ ok: true }),
		});
		vi.stubGlobal("fetch", mockFetch);

		const fetchService = new HttpProjectService("http://localhost:3000");
		const result = await fetchService.saveMarkdownSourceConfig("Flowti CLI", {
			path: "components",
			strategy: "category",
			requiredFields: ["name", "category", "description"],
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"http://localhost:3000/api/storybook/config",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					project: "Flowti CLI",
					config: { path: "components", strategy: "category", requiredFields: ["name", "category", "description"] },
				}),
			},
		);
		expect(result).toEqual({ ok: true });

		vi.unstubAllGlobals();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/projects/http-project-service.test.ts
```

Expected: FAIL — `saveMarkdownSourceConfig` does not exist on `HttpProjectService`.

- [ ] **Step 3: Add the method to HttpProjectService**

In `src/infrastructure/projects/http-project-service.ts`, add the import for `MarkdownSourceConfig` to the existing import block:

```typescript
import type {
	IProjectService, ProjectSummary, ProjectDetail,
	StorybookFramework, MarkdownSourceConfig,
} from "../../domain/projects/types.js";
```

Then add the method before the `private async post` method:

```typescript
async saveMarkdownSourceConfig(project: string, config: MarkdownSourceConfig): Promise<ApiResult> {
	return this.post("/api/storybook/config", { project, config });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/projects/http-project-service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/projects/http-project-service.test.ts"
git commit -m "feat(plugin/http): add saveMarkdownSourceConfig stub to HttpProjectService"
```

---

### Task 3: Add saveMarkdownSourceConfig to VaultProjectService + read markdownSource into ProjectConfig

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts`

- [ ] **Step 1: Add markdownSource reading to getProject()**

In `vault-project-service.ts`, inside the `getProject()` method, after line 220 (where `publishTargets` is set), add reading of `markdownSource` from the raw config. Find this block in the `projectConfig = {` object:

```typescript
				agents: roster,
				publishTargets: endpoints?.map((e) => String(e.name)),
```

Replace with:

```typescript
				agents: roster,
				publishTargets: endpoints?.map((e) => String(e.name)),
				markdownSource: components.markdownSource ? {
					path: String((components.markdownSource as Record<string, unknown>).path ?? ""),
					strategy: String((components.markdownSource as Record<string, unknown>).strategy ?? "category") as import("../../domain/projects/types.js").ImportStrategy,
					requiredFields: ((components.markdownSource as Record<string, unknown>).requiredFields as string[] | undefined) ?? [],
				} : undefined,
```

- [ ] **Step 2: Add saveMarkdownSourceConfig method**

Add the import for `MarkdownSourceConfig` to the existing import at the top of the file:

```typescript
import type { IProjectService, ProjectSummary, ProjectDetail, ProjectConfig, StorybookFramework, StorybookStatus, OutputCallback, MarkdownSourceConfig } from "../../domain/projects/types.js";
```

Then add the new method after `importMarkdownSitemap()`:

```typescript
async saveMarkdownSourceConfig(project: string, config: MarkdownSourceConfig, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const cliBin = join(vaultBase, ".flowti", "bin");
	const fields = config.requiredFields.join(",");
	return runAsync("node", [
		cliBin, "storybook:import", "--save-config",
		`--project="${project}"`,
		`--source="${config.path}"`,
		`--strategy=${config.strategy}`,
		`--fields=${fields}`,
	], vaultBase, onOutput);
}
```

- [ ] **Step 3: Run type check**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: No new errors (only pre-existing node_modules errors).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts"
git commit -m "feat(plugin/vault): add saveMarkdownSourceConfig and read markdownSource from config"
```

---

### Task 4: Add --save-config flag to CLI storybook:import

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/controller/storybook.controller.ts`
- Test: `01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/controller/storybook.controller.test.ts`, add a test for the save-config branch. First find how `storybook:import` tests are structured (there may not be existing tests for it — add a new describe block):

```typescript
describe("storybook:import --save-config", () => {
	it("writes markdownSource to config instead of running import", () => {
		const handler = getHandler("storybook:import");
		const ctx = createProjectContext({
			command: "storybook:import",
			flags: { output: "", source: "components", saveConfig: true, strategy: "flat", fields: "name,category,description" },
		});
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("configSaved", true);
	});
});
```

You'll also need to add `writeComponentsConfig` and `readComponentsConfig` to the existing `vi.mock` for storybook-settings at the top of the test file. Find the existing mock:

```typescript
vi.mock("../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
	setFramework: vi.fn(),
}));
```

Replace with:

```typescript
vi.mock("../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
	setFramework: vi.fn(),
	writeComponentsConfig: vi.fn(),
	readComponentsConfig: vi.fn(() => ({})),
}));
```

Then add the import alongside the existing `setFramework` import (matching the file's established pattern):

```typescript
import { writeComponentsConfig } from "../../src/domain/make/component/storybook-settings.js";
const mockWriteConfig = vi.mocked(writeComponentsConfig);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts -t "save-config"
```

Expected: FAIL — `saveConfig` flag not recognized, `configSaved` not in result.

- [ ] **Step 3: Implement --save-config flag**

In `src/controller/storybook.controller.ts`, modify the `storybook:import` descriptor. First add the import for `writeComponentsConfig`:

```typescript
import { writeComponentsConfig } from "../domain/make/component/storybook-settings.js";
```

Then update the command definition — add three new flags and a config-save branch:

```typescript
"storybook:import": adaptDescriptor<{ output: string; source: string; saveConfig: boolean; strategy: string; fields: string }, StorybookImportResultModel | { configSaved: boolean; path: string; strategy: string; requiredFields: string[] }>({
	requires: "project",
	flags: {
		output: {
			type: "string",
			required: false,
			hint: "--output=<path>",
		},
		source: {
			type: "string",
			required: false,
			hint: "--source=<folder>",
		},
		saveConfig: {
			type: "boolean",
			required: false,
			hint: "--save-config",
		},
		strategy: {
			type: "string",
			required: false,
			hint: "--strategy=category|flat|hierarchical",
			choices: ["category", "flat", "hierarchical"],
		},
		fields: {
			type: "string",
			required: false,
			hint: "--fields=name,category,...",
		},
	},
	handler: (ctx) => {
		// Save config mode: write markdownSource to flowti.config.json
		if (ctx.flags.saveConfig) {
			const path = ctx.flags.source || "";
			const strategy = (ctx.flags.strategy || "category") as import("../domain/make/markdown-sitemap-types.js").Strategy;
			const requiredFields = ctx.flags.fields ? ctx.flags.fields.split(",").map((f) => f.trim()) : ["name", "category"];
			writeComponentsConfig(ctx.project!.path, { markdownSource: { path, strategy, requiredFields } }, ctx.deps);
			return { configSaved: true, path, strategy, requiredFields };
		}

		// Normal import mode
		const sourcePath = ctx.flags.source || ctx.project!.config.components?.markdownSource?.path;
		if (!sourcePath) {
			return { componentCount: 0, skippedCount: 0, warnings: [], outputPath: "", configured: false };
		}
		return runMarkdownImport(ctx.project!.path, sourcePath, ctx.project!.config.components?.markdownSource, ctx.flags.output, ctx.deps);
	},
	renderer: (data, log) => {
		if ("configSaved" in data) {
			log(`Markdown source config saved: path=${data.path}, strategy=${data.strategy}, fields=${data.requiredFields.join(",")}`);
			return;
		}
		renderStorybookImportResult(data, log);
	},
}),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts -t "save-config"
```

Expected: PASS

- [ ] **Step 5: Run full CLI test suite**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts" "01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts"
git commit -m "feat(cli/storybook): add --save-config flag to storybook:import for persisting markdownSource config"
```

---

## Chunk 2: Config Tab Component + Tab System

### Task 5: Create flowti-config-tab component

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/components/projects/flowti-config-tab.ts`

- [ ] **Step 1: Create the config tab component**

Create `src/components/projects/flowti-config-tab.ts`:

```typescript
/**
 * Config tab for the project detail view.
 * Exposes markdown sitemap importer settings:
 * source folder, strategy, and required fields.
 */

import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { ImportStrategy, MarkdownSourceConfig } from "../../domain/projects/types.js";

const STRATEGIES: { id: ImportStrategy; label: string }[] = [
	{ id: "category", label: "Category" },
	{ id: "flat", label: "Flat" },
	{ id: "hierarchical", label: "Hierarchical" },
];

const LOCKED_FIELDS = ["name", "category"] as const;
const OPTIONAL_FIELDS = ["description", "status", "props", "slots", "variants"] as const;

export class FlowtiConfigTab extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sourcePath: { type: String },
		strategy: { type: String },
		requiredFields: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 16px);
			}

			.section-title {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-muted, #999);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.field-group {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
			}

			.field-label {
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				color: var(--text-muted, #999);
			}

			.folder-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
			}

			.folder-display {
				flex: 1;
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border: 1px solid var(--background-modifier-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--background-primary, #1e1e1e);
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				font-family: var(--font-monospace);
				min-height: 1.6em;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.folder-display--empty {
				color: var(--text-faint, #666);
				font-style: italic;
				font-family: inherit;
			}

			.browse-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
				flex-shrink: 0;
			}

			.browse-btn:hover {
				background: var(--background-modifier-hover, #333);
				border-color: var(--interactive-accent, #7c3aed);
				color: var(--interactive-accent, #7c3aed);
			}

			.strategy-group {
				display: flex;
				gap: var(--flowti-space-xs, 4px);
			}

			.strategy-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--background-modifier-border, #444);
				background: none;
				color: var(--text-normal, #ddd);
				font-size: var(--flowti-font-sm, 0.85em);
				cursor: pointer;
			}

			.strategy-btn:hover {
				background: var(--background-modifier-hover, #333);
			}

			.strategy-btn--active {
				background: var(--interactive-accent, #7c3aed);
				color: var(--text-on-accent, #fff);
				border-color: var(--interactive-accent, #7c3aed);
			}

			.chips {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs, 4px);
			}

			.chip {
				padding: 2px 10px;
				border-radius: 12px;
				font-size: var(--flowti-font-sm, 0.85em);
				border: 1px solid var(--background-modifier-border, #444);
				cursor: pointer;
				user-select: none;
			}

			.chip--locked {
				background: var(--background-modifier-hover, #333);
				color: var(--text-faint, #666);
				cursor: default;
				opacity: 0.6;
			}

			.chip--active {
				background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 20%, transparent);
				color: var(--interactive-accent, #7c3aed);
				border-color: var(--interactive-accent, #7c3aed);
			}

			.chip--inactive {
				background: none;
				color: var(--text-muted, #999);
			}

			.chip--inactive:hover {
				background: var(--background-modifier-hover, #333);
			}

			.save-row {
				display: flex;
				justify-content: flex-end;
				padding-top: var(--flowti-space-sm, 8px);
				border-top: 1px solid var(--background-modifier-border, #333);
			}

			.save-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-lg, 24px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--interactive-accent, #7c3aed);
				background: var(--interactive-accent, #7c3aed);
				color: var(--text-on-accent, #fff);
				font-size: var(--flowti-font-sm, 0.85em);
				font-weight: 500;
				cursor: pointer;
			}

			.save-btn:hover {
				opacity: 0.9;
			}
		`,
	];

	sourcePath = "";
	strategy: ImportStrategy = "category";
	requiredFields: string[] = [];

	protected renderContent() {
		return html`
			<div class="section-title">Markdown Sitemap Import</div>
			${this.renderSourceFolder()}
			${this.renderStrategy()}
			${this.renderRequiredFields()}
			${this.renderSaveButton()}
		`;
	}

	private renderSourceFolder() {
		const isEmpty = !this.sourcePath;
		return html`
			<div class="field-group">
				<span class="field-label">Source folder</span>
				<div class="folder-row">
					<span class="folder-display ${isEmpty ? "folder-display--empty" : ""}">${this.sourcePath || "No folder selected"}</span>
					<button class="browse-btn" @click="${this.dispatchBrowse}">Browse</button>
				</div>
			</div>
		`;
	}

	private renderStrategy() {
		return html`
			<div class="field-group">
				<span class="field-label">Strategy</span>
				<div class="strategy-group">
					${STRATEGIES.map((s) => html`
						<button
							class="strategy-btn ${this.strategy === s.id ? "strategy-btn--active" : ""}"
							@click="${() => { this.strategy = s.id; }}"
						>${s.label}</button>
					`)}
				</div>
			</div>
		`;
	}

	private renderRequiredFields() {
		return html`
			<div class="field-group">
				<span class="field-label">Required fields</span>
				<div class="chips">
					${LOCKED_FIELDS.map((f) => html`
						<span class="chip chip--locked" title="Always required">${f}</span>
					`)}
					${OPTIONAL_FIELDS.map((f) => html`
						<span
							class="chip ${this.requiredFields.includes(f) ? "chip--active" : "chip--inactive"}"
							@click="${() => this.toggleField(f)}"
						>${f}</span>
					`)}
				</div>
			</div>
		`;
	}

	private renderSaveButton() {
		return html`
			<div class="save-row">
				<button class="save-btn" @click="${this.dispatchSave}">Save</button>
			</div>
		`;
	}

	private toggleField(field: string): void {
		if (this.requiredFields.includes(field)) {
			this.requiredFields = this.requiredFields.filter((f) => f !== field);
		} else {
			this.requiredFields = [...this.requiredFields, field];
		}
	}

	private dispatchBrowse(): void {
		this.dispatchEvent(new CustomEvent("config-browse-folder", { bubbles: true, composed: true }));
	}

	private dispatchSave(): void {
		const allRequired = [...LOCKED_FIELDS, ...this.requiredFields];
		this.dispatchEvent(new CustomEvent("config-save", {
			detail: {
				path: this.sourcePath,
				strategy: this.strategy,
				requiredFields: allRequired,
			},
			bubbles: true,
			composed: true,
		}));
	}
}

if (!customElements.get("flowti-config-tab")) customElements.define("flowti-config-tab", FlowtiConfigTab);
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-config-tab.ts"
git commit -m "feat(plugin/components): add flowti-config-tab component with folder, strategy, and required fields"
```

---

### Task 6: Add tab system to flowti-project-detail

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts`

- [ ] **Step 1: Add side-effect import for the config tab**

At the top of `flowti-project-detail.ts`, after the existing `import "./flowti-storybook-section.js";` line, add:

```typescript
import "./flowti-config-tab.js";
```

- [ ] **Step 2: Add activeTab property**

In the `static properties` object, add:

```typescript
activeTab: { type: String },
```

And add the field initializer alongside the other fields:

```typescript
activeTab = "overview";
```

- [ ] **Step 3: Add tab bar CSS**

In the `static styles` css block, add the following rules (insert before the closing backtick):

```css
.tab-bar {
	display: flex;
	gap: 0;
	border-bottom: 1px solid var(--background-modifier-border, #333);
	margin-bottom: var(--flowti-space-sm, 8px);
}

.tab-btn {
	padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
	border: none;
	border-bottom: 2px solid transparent;
	background: none;
	color: var(--text-muted, #999);
	font-size: var(--flowti-font-sm, 0.85em);
	cursor: pointer;
}

.tab-btn:hover {
	color: var(--text-normal, #ddd);
}

.tab-btn--active {
	color: var(--interactive-accent, #7c3aed);
	border-bottom-color: var(--interactive-accent, #7c3aed);
	font-weight: 500;
}
```

- [ ] **Step 4: Modify renderContent() for tabs**

Replace the current project-detail rendering in `renderContent()`. The method currently reads:

```typescript
protected renderContent() {
	if (!this.projectName) {
		return this.renderProjectList();
	}
	return html`
		${this.renderHeader()}
		${this.statusMessage ? html`<div class="status-banner">${this.statusMessage}</div>` : ""}
		${this.renderConfigSection()}
		${this.renderNoteSection()}
		${this.renderStorybookSection()}
	`;
}
```

Replace with:

```typescript
protected renderContent() {
	if (!this.projectName) {
		return this.renderProjectList();
	}
	return html`
		${this.renderHeader()}
		${this.statusMessage ? html`<div class="status-banner">${this.statusMessage}</div>` : ""}
		${this.renderTabBar()}
		${this.activeTab === "overview" ? this.renderOverviewTab() : this.renderConfigTab()}
	`;
}

private renderTabBar() {
	return html`
		<div class="tab-bar">
			<button class="tab-btn ${this.activeTab === "overview" ? "tab-btn--active" : ""}" @click="${() => { this.activeTab = "overview"; }}">Overview</button>
			<button class="tab-btn ${this.activeTab === "config" ? "tab-btn--active" : ""}" @click="${() => { this.activeTab = "config"; }}">Config</button>
		</div>
	`;
}

private renderOverviewTab() {
	return html`
		${this.renderConfigSection()}
		${this.renderNoteSection()}
		${this.renderStorybookSection()}
	`;
}

private renderConfigTab() {
	return html`
		<flowti-config-tab
			.sourcePath="${this.config?.markdownSource?.path ?? ""}"
			.strategy="${this.config?.markdownSource?.strategy ?? "category"}"
			.requiredFields="${[...(this.config?.markdownSource?.requiredFields ?? [])].filter((f) => f !== "name" && f !== "category")}"
		></flowti-config-tab>
	`;
}
```

Note: the `requiredFields` passed to the config tab strips the locked fields (`name`, `category`) since those are displayed separately as locked chips.

- [ ] **Step 5: Verify no syntax errors**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin/detail): add Overview|Config tab bar to project detail view"
```

---

## Chunk 3: Handler Wiring

### Task 7: Wire config-save and config-browse-folder events

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`

- [ ] **Step 1: Write the failing test for config-save**

In `tests/infrastructure/handlers/project-handlers.test.ts`, update `mockService()` to include the new method:

```typescript
function mockService(): IProjectService {
	return {
		listProjects: vi.fn(async () => []),
		getProject: vi.fn(async () => ({
			name: "Alpha",
			type: "typescript",
			hasNote: true,
			notePath: "/projects/Alpha/Alpha.md",
			projectPath: "/projects/Alpha",
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null },
		})),
		installStorybook: vi.fn(async () => ({ ok: true })),
		startStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6006", pid: 123 })),
		stopStorybook: vi.fn(async () => ({ ok: true })),
		buildStorybook: vi.fn(async () => ({ ok: true, outputDir: "/path" })),
		scaffoldStorybook: vi.fn(async () => ({ ok: true, filesCreated: 5 })),
		importMarkdownSitemap: vi.fn(async (_p: string, _s: string) => ({ ok: true })),
		saveMarkdownSourceConfig: vi.fn(async () => ({ ok: true })),
	};
}
```

Then add a test:

```typescript
it("forwards config-save to service", async () => {
	const service = mockService();
	mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
	await new Promise((r) => setTimeout(r, 20));
	const el = container.querySelector("flowti-project-detail") as HTMLElement;
	el.dispatchEvent(new CustomEvent("config-save", {
		detail: { path: "components", strategy: "flat", requiredFields: ["name", "category", "description"] },
		bubbles: true,
		composed: true,
	}));
	await new Promise((r) => setTimeout(r, 20));
	expect(service.saveMarkdownSourceConfig).toHaveBeenCalledWith(
		"Alpha",
		{ path: "components", strategy: "flat", requiredFields: ["name", "category", "description"] },
		expect.any(Function),
	);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts -t "config-save"
```

Expected: FAIL — no listener for `config-save`.

- [ ] **Step 3: Add config-save and config-browse-folder handlers**

In `src/infrastructure/handlers/project-handlers.ts`, add a listener for `config-save` after the `storybook-import` listener block (around line 196):

```typescript
el.addEventListener("config-save", ((e: CustomEvent) => {
	const { path, strategy, requiredFields } = e.detail as { path: string; strategy: string; requiredFields: string[] };
	startBusy("Saving config...");
	void projectService.saveMarkdownSourceConfig(currentProject, { path, strategy: strategy as import("../../domain/projects/types.js").ImportStrategy, requiredFields }, appendOutput)
		.then((r) => endBusy(r));
}) as EventListener);

el.addEventListener("config-browse-folder", (() => {
	if (!deps.pickFolder) return;
	void deps.pickFolder().then((folder) => {
		if (folder === null) return;
		const configTab = el.shadowRoot?.querySelector("flowti-config-tab") as (HTMLElement & { sourcePath: string }) | null;
		if (configTab) configTab.sourcePath = folder;
	});
}) as EventListener);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts"
git commit -m "feat(plugin/handlers): wire config-save and config-browse-folder events"
```

---

### Task 8: Update storybook-import handler to use saved config path

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`

- [ ] **Step 1: Update the storybook-import listener**

Find the existing `storybook-import` listener in `project-handlers.ts`:

```typescript
el.addEventListener("storybook-import", (() => {
	if (!deps.pickFolder) return;
	void deps.pickFolder().then((folder) => {
		if (folder === null) return;
		startBusy("Importing markdown to sitemap...");
		void projectService.importMarkdownSitemap(currentProject, folder, appendOutput)
			.then((r) => endBusy(r));
	});
}) as EventListener);
```

Replace with:

```typescript
el.addEventListener("storybook-import", (() => {
	// Use configured path if available, otherwise prompt with folder picker
	const configPath = (el as Record<string, unknown>).config as { markdownSource?: { path: string } } | undefined;
	const savedPath = configPath?.markdownSource?.path;

	if (savedPath) {
		startBusy("Importing markdown to sitemap...");
		void projectService.importMarkdownSitemap(currentProject, savedPath, appendOutput)
			.then((r) => endBusy(r));
		return;
	}

	if (!deps.pickFolder) return;
	void deps.pickFolder().then((folder) => {
		if (folder === null) return;
		startBusy("Importing markdown to sitemap...");
		void projectService.importMarkdownSitemap(currentProject, folder, appendOutput)
			.then((r) => endBusy(r));
	});
}) as EventListener);
```

- [ ] **Step 2: Run all handler tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Run full plugin test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/ 2>&1 | tail -10
```

Expected: All handler tests pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "feat(plugin/handlers): use saved markdownSource path for import, skip folder picker"
```

---

## Chunk 4: Verification

### Task 9: Full verification

- [ ] **Step 1: Run CLI tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 2: Run Plugin handler + service tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/ 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 3: Run Plugin type tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/ 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 4: Type check both projects**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -5
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -10
```

Expected: No new errors.

- [ ] **Step 5: Build CLI**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

Expected: Build succeeds.
