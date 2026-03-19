# Project Detail Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the project detail sidepanel — fix visual issues, add loading feedback, dismissable logs, brief frontmatter display, and wire open-folder.

**Architecture:** All changes are in Plugin components and handlers. Brief data flows from VaultProjectService → handler → Lit element properties. The `reveal-path` event pattern keeps deps clean.

**Tech Stack:** Lit, Vitest, Obsidian API (metadataCache)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-project-detail-polish-design.md`

---

## Chunk 1: Types + Service (brief data)

### Task 1: Add `brief` to ProjectDetail type

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts:21-26`
- Modify: `01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts`

- [ ] **Step 1: Add brief type and update ProjectDetail**

In `types.ts`, add the brief type before `ProjectDetail` and add the field:

```typescript
export interface ProjectBrief {
	readonly start?: string;
	readonly end?: string;
	readonly goal?: string;
	readonly description?: string;
	readonly status?: string;
}

export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
	readonly hasSitemap: boolean;
	readonly brief?: ProjectBrief;
	readonly config?: ProjectConfig;
}
```

- [ ] **Step 2: Add type test**

Add to `types.test.ts`:

```typescript
it("ProjectDetail has optional brief field", () => {
	expectTypeOf<ProjectDetail>().toHaveProperty("brief");
});
```

Update import to include `ProjectBrief` if needed for the test.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/types.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts"
git commit -m "feat(plugin): add ProjectBrief type to ProjectDetail"
```

---

### Task 2: Read brief frontmatter in VaultProjectService

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts:158-243`

- [ ] **Step 1: Extract brief from note frontmatter**

In `vault-project-service.ts`, in the `getProject()` method, after the note type check (around line 178), add brief extraction using Obsidian's metadata cache:

```typescript
	let brief: import("../../domain/projects/types.js").ProjectBrief | undefined;
	if (noteFile && hasNote) {
		const cache = this.app.metadataCache.getFileCache(noteFile);
		const fm = cache?.frontmatter;
		if (fm) {
			brief = {
				start: fm.start != null ? String(fm.start) : undefined,
				end: fm.end != null ? String(fm.end) : undefined,
				goal: fm.goal != null ? String(fm.goal) : undefined,
				description: fm.description != null ? String(fm.description) : undefined,
				status: fm.status != null ? String(fm.status) : undefined,
			};
		}
	}
```

Then add `brief,` to the return object (around line 234).

- [ ] **Step 2: Pass brief to element in project-handlers**

In `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`, in `loadProject()`, add after `el.hasMarkdownSource`:

```typescript
		el.brief = detail.brief;
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS (brief is optional, mock doesn't need it)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "feat(plugin): read ProjectBrief frontmatter in getProject"
```

---

## Chunk 2: Project detail component polish

### Task 3: Fix border, rename Note→Brief, add brief display

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts`

- [ ] **Step 1: Remove first section's redundant top border**

Add to CSS after the `.section` rule (line 102):

```css
.section:first-of-type {
	border-top: none;
}
```

- [ ] **Step 2: Rename Note → Project Brief**

Replace `renderNoteSection()` (lines 430-437):

```typescript
private renderNoteSection() {
	return html`
		<div class="section">
			<div class="section-title">Project Brief</div>
			${this.hasNote ? this.renderNoteLink() : this.renderNoteWarning()}
		</div>
	`;
}
```

Replace `renderNoteLink()` (lines 439-443):

```typescript
private renderNoteLink() {
	return html`
		<button class="note-link" @click="${this.dispatchOpenNote}">Open brief</button>
	`;
}
```

Replace `renderNoteWarning()` (lines 445-452):

```typescript
private renderNoteWarning() {
	return html`
		<div class="note-warning">
			<span>No project brief</span>
			<button class="note-create" @click="${this.dispatchCreateNote}">Create brief</button>
		</div>
	`;
}
```

- [ ] **Step 3: Add brief property and display**

Add to `static properties`:

```typescript
		brief: { type: Object },
```

Add to instance properties (after `hasMarkdownSource = false;`):

```typescript
	brief: Record<string, string | undefined> | undefined = undefined;
```

Add CSS for brief display (add after `.section:first-of-type` rule):

```css
.brief-info {
	display: flex;
	flex-direction: column;
	gap: var(--flowti-space-xs, 4px);
	padding: var(--flowti-space-sm, 8px) 0;
}

.brief-row {
	display: flex;
	gap: var(--flowti-space-sm, 8px);
	font-size: var(--flowti-font-sm, 0.85em);
}

.brief-label {
	color: var(--text-muted, #999);
	min-width: 70px;
}

.brief-value {
	color: var(--text-normal, #ddd);
}

.brief-meta {
	display: flex;
	gap: var(--flowti-space-md, 16px);
	font-size: var(--flowti-font-sm, 0.85em);
	color: var(--text-muted, #999);
}

.brief-description {
	font-size: var(--flowti-font-sm, 0.85em);
	color: var(--text-normal, #ddd);
	line-height: 1.5;
}

.brief-status {
	display: inline-block;
	padding: 1px 8px;
	border-radius: 3px;
	font-size: 0.8em;
	background: var(--background-modifier-hover, #333);
}
```

Add `renderBriefSection()` method:

```typescript
private renderBriefSection() {
	if (!this.brief) return "";
	const { goal, description, start, end, status } = this.brief;
	const hasAny = goal || description || start || end || status;
	if (!hasAny) return "";

	return html`
		<div class="brief-info">
			${goal ? html`
				<div class="brief-row">
					<span class="brief-label">Goal</span>
					<span class="brief-value">${goal}</span>
				</div>
			` : ""}
			${status || start || end ? html`
				<div class="brief-meta">
					${status ? html`<span class="brief-status">${status}</span>` : ""}
					${start ? html`<span>Start: ${start}</span>` : ""}
					${end ? html`<span>End: ${end}</span>` : ""}
				</div>
			` : ""}
			${description ? html`<div class="brief-description">${description}</div>` : ""}
		</div>
	`;
}
```

- [ ] **Step 4: Insert brief display into renderContent**

Modify `renderContent()` — add `renderBriefSection()` between the header and status banner:

```typescript
protected renderContent() {
	if (!this.projectName) {
		return this.renderProjectList();
	}
	return html`
		${this.renderHeader()}
		${this.renderBriefSection()}
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

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin): border fix, Note→Brief rename, brief frontmatter display"
```

---

### Task 4: Storybook badge in section title row

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts:507-524`
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts:326-355`

- [ ] **Step 1: Move badge+status into parent section title**

Replace `renderStorybookSection()` in `flowti-project-detail.ts`:

```typescript
private renderStorybookSection() {
	const badge = this.storybook.framework
		? html`<span class="framework-badge">${this.storybook.framework}</span>`
		: "";
	const statusText = this.storybook.running ? "Running" : this.storybook.installed ? "Installed" : "";
	const statusClass = this.storybook.running ? "status-label--running" : "";
	const dot = this.storybook.running ? html`<span class="dot--running"></span>` : "";

	return html`
		<div class="section">
			<div class="section-title">
				Storybook ${dot} ${badge}
				${statusText ? html`<span class="status-label ${statusClass}">${statusText}</span>` : ""}
			</div>
			<flowti-storybook-section
				.installed="${this.storybook.installed}"
				.framework="${this.storybook.framework}"
				.running="${this.storybook.running}"
				.busy="${this.storybookBusy}"
				.busyLabel="${this.storybookBusyLabel}"
				.outputLines="${this.storybookOutput}"
				.errorNote="${this.storybookError}"
				.url="${this.storybook.url}"
				.pid="${this.storybook.pid}"
			></flowti-storybook-section>
		</div>
	`;
}
```

Add CSS for the inline elements (these may already exist in storybook-section, copy them to project-detail):

```css
.framework-badge {
	display: inline-block;
	padding: 1px 6px;
	border-radius: 3px;
	font-size: 0.8em;
	background: var(--background-modifier-hover, #333);
	color: var(--text-muted, #999);
}

.status-label {
	font-size: 0.8em;
	color: var(--text-muted, #999);
}

.status-label--running {
	color: var(--color-green, #4caf50);
}

.dot--running {
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--color-green, #4caf50);
}
```

- [ ] **Step 2: Remove status row from storybook section**

In `flowti-storybook-section.ts`, replace `renderInstalled()`:

```typescript
private renderInstalled() {
	return html`
		<div class="actions">
			<button class="action-btn action-btn--primary" @click="${() => this.dispatchStart()}" title="Launch dev server on localhost:6006">Start</button>
			<button class="action-btn" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
			<button class="action-btn" @click="${() => this.dispatchOpenFolder()}" title="Open components folder in vault">Open folder</button>
			<button class="action-btn action-btn--danger" @click="${() => this.dispatchRegenerate()}" title="Delete and recreate component library from sitemap">Regenerate</button>
		</div>
	`;
}
```

Replace `renderRunning()`:

```typescript
private renderRunning() {
	return html`
		<div class="status-row">
			<span class="url-label">${this.url}</span>
		</div>
		<div class="actions">
			<button class="action-btn action-btn--primary" @click="${() => this.dispatchView()}" title="Open Storybook in browser">View</button>
			<button class="action-btn action-btn--danger" @click="${() => this.dispatchStop()}" title="Stop the dev server process">Stop</button>
			<button class="action-btn" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
		</div>
	`;
}
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts" "01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts"
git commit -m "feat(plugin): storybook badge+status in section title row"
```

---

## Chunk 3: Loading feedback + dismissable log + open folder

### Task 5: Disable buttons during busy + dismissable output log

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts`

- [ ] **Step 1: Add disabled button CSS**

Add after the existing `.action-btn--primary:hover` rule:

```css
.action-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	pointer-events: none;
}

.output-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: var(--flowti-space-sm, 8px);
	margin-bottom: var(--flowti-space-xs, 4px);
}

.output-header__label {
	font-size: 0.75em;
	color: var(--text-muted, #999);
}

.output-header__dismiss {
	background: none;
	border: none;
	color: var(--text-muted, #999);
	cursor: pointer;
	font-size: 1.1em;
	padding: 0 4px;
}

.output-header__dismiss:hover {
	color: var(--text-normal, #ddd);
}
```

- [ ] **Step 2: Disable buttons when busy**

In `renderInstalled()`, add `?disabled="${this.busy}"` to each button:

```typescript
private renderInstalled() {
	return html`
		<div class="actions">
			<button class="action-btn action-btn--primary" ?disabled="${this.busy}" @click="${() => this.dispatchStart()}" title="Launch dev server on localhost:6006">Start</button>
			<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
			<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchOpenFolder()}" title="Open components folder in vault">Open folder</button>
			<button class="action-btn action-btn--danger" ?disabled="${this.busy}" @click="${() => this.dispatchRegenerate()}" title="Delete and recreate component library from sitemap">Regenerate</button>
		</div>
	`;
}
```

Same for `renderRunning()` buttons.

- [ ] **Step 3: Make output log dismissable when not busy**

Replace `renderOutputLog()`:

```typescript
private renderOutputLog() {
	if (this.outputLines.length === 0) return "";
	return html`
		${!this.busy ? html`
			<div class="output-header">
				<span class="output-header__label">Output</span>
				<button class="output-header__dismiss" @click="${() => this.dismissOutput()}" title="Dismiss">&times;</button>
			</div>
		` : ""}
		<div class="output-log">${this.outputLines.join("\n")}</div>
	`;
}
```

Add the dismiss method:

```typescript
private dismissOutput(): void {
	this.dispatchEvent(new CustomEvent("storybook-dismiss-output", { bubbles: true, composed: true }));
}
```

- [ ] **Step 4: Handle dismiss in project-handlers**

In `project-handlers.ts`, add before the `container.appendChild(el)` line:

```typescript
	el.addEventListener("storybook-dismiss-output", (() => {
		outputLines.length = 0;
		el.storybookOutput = [];
	}) as EventListener);
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "feat(plugin): disable buttons during busy, dismissable output log"
```

---

### Task 6: Wire open-folder to reveal-path event

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`

- [ ] **Step 1: Add reveal-path handler for open-folder**

In `project-handlers.ts`, add before `container.appendChild(el)`:

```typescript
	el.addEventListener("storybook-open-folder", (() => {
		const config = (el.config as { storybookDir?: string } | undefined);
		const dir = config?.storybookDir ?? "components";
		el.dispatchEvent(new CustomEvent("reveal-path", {
			detail: { path: `${currentProject}/${dir}` },
			bubbles: true, composed: true,
		}));
	}) as EventListener);
```

Note: The Plugin shell that mounts this view should listen for `reveal-path` and handle it via Obsidian's API. That wiring is outside this plan's scope — the event contract is what we deliver.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "feat(plugin): wire open-folder to reveal-path event"
```

---

## Chunk 4: Static Storybook Preview

### Task 7: Add hasStaticBuild detection + Preview button + serve handler

The CLI already has a zero-dep static HTTP server (`src/domain/serve/static-server.ts`). The Plugin can serve `components/storybook-static/` on port 6007 and open it in a webviewer tab. Preview is available in both idle and running states — dev server (6006) and static preview (6007) coexist.

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts` — add `hasStaticBuild` to `StorybookStatus`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts` — detect `storybook-static/`, add `previewStorybook` method
- Modify: `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts` — add Preview button
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts` — wire `storybook-preview` event

- [ ] **Step 1: Add `hasStaticBuild` to StorybookStatus**

In `types.ts`, add to `StorybookStatus`:

```typescript
export interface StorybookStatus {
	readonly installed: boolean;
	readonly framework: string | null;
	readonly running: boolean;
	readonly url: string | null;
	readonly pid: number | null;
	readonly hasStaticBuild: boolean;
}
```

Add `previewStorybook` to `IProjectService`:

```typescript
	previewStorybook(project: string): Promise<{ ok: boolean; url?: string; error?: string }>;
	stopPreview(project: string): Promise<{ ok: boolean; error?: string }>;
```

- [ ] **Step 2: Detect static build in VaultProjectService**

In `vault-project-service.ts`, in `detectStorybookOnDisk()` or wherever storybook status is built, add:

```typescript
const hasStaticBuild = existsSync(join(sbParent, "storybook-static", "index.html"));
```

Add it to the returned `StorybookStatus` object.

- [ ] **Step 3: Implement previewStorybook in VaultProjectService**

Add a `previewStorybook` method that starts a static HTTP server:

```typescript
private previewServers = new Map<string, { close: () => void; url: string }>();

async previewStorybook(project: string): Promise<{ ok: boolean; url?: string; error?: string }> {
	// Already serving?
	const existing = this.previewServers.get(project);
	if (existing) return { ok: true, url: existing.url };

	const vaultBase = getVaultBasePath(this.app);
	const staticDir = join(vaultBase, PROJECTS_FOLDER, project, "components", "storybook-static");
	if (!existsSync(staticDir)) return { ok: false, error: "No static build found" };

	try {
		const http = await import("node:http");
		const fs = await import("node:fs");
		const nodePath = await import("node:path");
		const port = 6007;

		const MIME: Record<string, string> = {
			".html": "text/html", ".css": "text/css", ".js": "application/javascript",
			".mjs": "application/javascript", ".json": "application/json",
			".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
		};

		const server = http.createServer((req, res) => {
			res.setHeader("Access-Control-Allow-Origin", "*");
			const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
			const safePath = urlPath === "/" ? "/index.html" : urlPath;
			const filePath = nodePath.join(staticDir, ...safePath.split("/").filter(s => s && s !== ".."));

			if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
			const ext = nodePath.extname(filePath).toLowerCase();
			const mime = MIME[ext] ?? "application/octet-stream";
			const body = fs.readFileSync(filePath);
			res.writeHead(200, { "Content-Type": mime });
			res.end(body);
		});

		await new Promise<void>((resolve) => server.listen(port, resolve));
		const url = `http://localhost:${port}`;
		this.previewServers.set(project, { close: () => server.close(), url });
		return { ok: true, url };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
}

async stopPreview(project: string): Promise<{ ok: boolean; error?: string }> {
	const server = this.previewServers.get(project);
	if (server) {
		server.close();
		this.previewServers.delete(project);
	}
	return { ok: true };
}
```

Add stub implementations to `HttpProjectService`.

- [ ] **Step 4: Add Preview button to storybook section**

In `flowti-storybook-section.ts`, add `hasStaticBuild` property:

```typescript
hasStaticBuild = false;
```

Add to `static properties`:

```typescript
hasStaticBuild: { type: Boolean },
```

In `renderInstalled()`, add Preview button (only when static build exists):

```typescript
private renderInstalled() {
	return html`
		<div class="actions">
			<button class="action-btn action-btn--primary" ?disabled="${this.busy}" @click="${() => this.dispatchStart()}" title="Launch dev server on localhost:6006">Start</button>
			${this.hasStaticBuild ? html`
				<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchPreview()}" title="Open static build in viewer">Preview</button>
			` : ""}
			<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
			<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchOpenFolder()}" title="Open components folder in vault">Open folder</button>
			<button class="action-btn action-btn--danger" ?disabled="${this.busy}" @click="${() => this.dispatchRegenerate()}" title="Delete and recreate component library from sitemap">Regenerate</button>
		</div>
	`;
}
```

Also add Preview to `renderRunning()` (both can coexist):

```typescript
private renderRunning() {
	return html`
		<div class="status-row">
			<span class="url-label">${this.url}</span>
		</div>
		<div class="actions">
			<button class="action-btn action-btn--primary" ?disabled="${this.busy}" @click="${() => this.dispatchView()}" title="Open Storybook in browser">View</button>
			${this.hasStaticBuild ? html`
				<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchPreview()}" title="Open static build in viewer">Preview</button>
			` : ""}
			<button class="action-btn action-btn--danger" ?disabled="${this.busy}" @click="${() => this.dispatchStop()}" title="Stop the dev server process">Stop</button>
			<button class="action-btn" ?disabled="${this.busy}" @click="${() => this.dispatchBuild()}" title="Build static site to storybook-static/">Build</button>
		</div>
	`;
}
```

Add dispatch method:

```typescript
private dispatchPreview(): void {
	this.dispatchEvent(new CustomEvent("storybook-preview", { bubbles: true, composed: true }));
}
```

- [ ] **Step 5: Pass hasStaticBuild from parent**

In `flowti-project-detail.ts`, update `renderStorybookSection()` to pass the new property:

```typescript
.hasStaticBuild="${this.storybook.hasStaticBuild}"
```

- [ ] **Step 6: Wire storybook-preview event in handlers**

In `project-handlers.ts`, add before `container.appendChild(el)`:

```typescript
	el.addEventListener("storybook-preview", (() => {
		void projectService.previewStorybook(currentProject)
			.then((r) => {
				if (r.ok && r.url) {
					deps.openInWebviewer?.(r.url);
				} else if (r.error) {
					el.storybookError = r.error;
				}
			});
	}) as EventListener);
```

- [ ] **Step 7: Update mock service and default storybook status**

In `project-handlers.test.ts`, add to `mockService()`:

```typescript
		previewStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6007" })),
		stopPreview: vi.fn(async () => ({ ok: true })),
```

Add `hasStaticBuild: false` to the storybook mock object.

Update the default storybook status in `flowti-project-detail.ts`:

```typescript
storybook: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false };
```

- [ ] **Step 8: Run tests and commit**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/project-handlers.test.ts tests/domain/projects/types.test.ts`
Expected: PASS

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts" "01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts" "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts" "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts"
git commit -m "feat(plugin): static storybook preview via lightweight HTTP server"
```

---

## Chunk 5: Verification

### Task 8: Build + verify

- [ ] **Step 1: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/ tests/infrastructure/handlers/`
Expected: All pass

- [ ] **Step 2: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: `Build done...`

- [ ] **Step 3: Build CLI** (storybook:clean was added earlier)

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: `Built: .flowti/bin/main.mjs`
