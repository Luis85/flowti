# Project Hub Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Project Hub sidepanel in the Plugin with project list, detail view, and Storybook lifecycle management — all backed by new CLI server endpoints.

**Architecture:** CLI server gets `/api/projects/*` and `/api/storybook/*` routes that delegate to existing domain functions. Plugin gets a sitemap-driven project list + a dedicated Lit component detail view. Plugin = UI, CLI = logic.

**Tech Stack:** CLI: Node.js HTTP server, existing storybook-service.ts. Plugin: Lit 3.x, Obsidian ItemView, HTTP fetch to CLI server.

**Spec:** `01 - Projects/Flowti Plugin/docs/specs/2026-03-18-project-hub-design.md`

---

## Chunk 1: CLI Server — Project + Storybook API Endpoints

### Task 1: Domain helper — `project-api.ts`

Pure domain function that builds the project list response without I/O coupling to HTTP.

**Files:**
- Create: `01 - Projects/Flowti CLI/src/domain/serve/project-api.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/serve/project-api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/domain/serve/project-api.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { listProjectSummaries, getProjectDetail } from "../../../src/domain/serve/project-api.js";

function mockDeps(files: Record<string, string> = {}, dirs: string[] = []) {
	return {
		disk: {
			readdirSync: vi.fn(() => dirs.map((d) => ({ name: d, isDirectory: () => true }))),
			existsSync: vi.fn((p: string) => p in files),
			readFileSync: vi.fn((p: string) => files[p] ?? ""),
		},
		paths: {
			join: (...args: string[]) => args.join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
		},
	};
}

describe("listProjectSummaries", () => {
	it("returns project list with note and storybook status", () => {
		const deps = mockDeps(
			{
				"root/01 - Projects/Alpha/Alpha.md": "# Alpha",
				"root/01 - Projects/Alpha/configs/flowti.config.json": JSON.stringify({ type: "typescript" }),
				"root/01 - Projects/Beta/configs/flowti.config.json": JSON.stringify({ type: "obsidian-plugin", components: { framework: "react" } }),
			},
			["Alpha", "Beta"],
		);
		const result = listProjectSummaries("root/01 - Projects", "root", deps as never);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Alpha");
		expect(result[0].hasNote).toBe(true);
		expect(result[0].type).toBe("typescript");
		expect(result[1].name).toBe("Beta");
		expect(result[1].hasNote).toBe(false);
		expect(result[1].storybook.framework).toBe("react");
	});

	it("returns empty array when no projects", () => {
		const deps = mockDeps({}, []);
		expect(listProjectSummaries("root/projects", "root", deps as never)).toEqual([]);
	});
});

describe("getProjectDetail", () => {
	it("returns detail for existing project", () => {
		const deps = mockDeps(
			{
				"root/01 - Projects/Alpha/Alpha.md": "# Alpha",
				"root/01 - Projects/Alpha/configs/flowti.config.json": JSON.stringify({ type: "typescript" }),
			},
			["Alpha"],
		);
		const result = getProjectDetail("Alpha", "root/01 - Projects", "root", deps as never);
		expect(result).not.toBeNull();
		expect(result!.name).toBe("Alpha");
		expect(result!.hasNote).toBe(true);
		expect(result!.notePath).toBe("root/01 - Projects/Alpha/Alpha.md");
	});

	it("returns null for non-existent project", () => {
		const deps = mockDeps({}, []);
		expect(getProjectDetail("Nope", "root/projects", "root", deps as never)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/project-api.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Create `src/domain/serve/project-api.ts`**

```typescript
// src/domain/serve/project-api.ts
/**
 * Project API — pure domain functions for project listing and detail.
 * Used by the CLI server's HTTP API routes.
 */

interface ProjectDeps {
	readonly disk: {
		readdirSync(path: string, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
		existsSync(path: string): boolean;
		readFileSync(path: string, encoding: string): string;
	};
	readonly paths: {
		join(...args: string[]): string;
		basename(path: string): string;
	};
}

export interface StorybookStatus {
	readonly installed: boolean;
	readonly framework: string | null;
	readonly running: boolean;
	readonly url: string | null;
	readonly pid: number | null;
}

export interface ProjectSummary {
	readonly name: string;
	readonly type: string;
	readonly hasNote: boolean;
	readonly storybook: StorybookStatus;
}

export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
}

function readConfig(projectPath: string, deps: ProjectDeps): Record<string, unknown> {
	const configPath = deps.paths.join(projectPath, "configs", "flowti.config.json");
	if (!deps.disk.existsSync(configPath)) return {};
	try {
		return JSON.parse(deps.disk.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
	} catch { return {}; }
}

function checkStorybookStatus(projectPath: string, vaultRoot: string, config: Record<string, unknown>, deps: ProjectDeps): StorybookStatus {
	const components = (config.components ?? {}) as Record<string, unknown>;
	const framework = components.framework ? String(components.framework) : null;
	const sbDir = deps.paths.join(projectPath, "components", ".storybook");
	const installed = framework !== null || deps.disk.existsSync(sbDir);

	const slug = deps.paths.basename(projectPath).toLowerCase().replace(/\s+/g, "-");
	const pidPath = deps.paths.join(vaultRoot, ".flowti", "var", `storybook-${slug}.pid`);
	let running = false;
	let url: string | null = null;
	let pid: number | null = null;
	if (deps.disk.existsSync(pidPath)) {
		try {
			const data = JSON.parse(deps.disk.readFileSync(pidPath, "utf-8")) as { pid?: number; url?: string };
			pid = data.pid ?? null;
			url = data.url ?? null;
			running = pid !== null;
		} catch { /* corrupt pid file */ }
	}

	return { installed, framework, running, url, pid };
}

export function listProjectSummaries(projectsDir: string, vaultRoot: string, deps: ProjectDeps): ProjectSummary[] {
	let entries: Array<{ name: string; isDirectory(): boolean }>;
	try {
		entries = deps.disk.readdirSync(projectsDir, { withFileTypes: true });
	} catch { return []; }

	return entries
		.filter((e) => e.isDirectory())
		.map((e) => {
			const projectPath = deps.paths.join(projectsDir, e.name);
			const notePath = deps.paths.join(projectPath, `${e.name}.md`);
			const hasNote = deps.disk.existsSync(notePath);
			const config = readConfig(projectPath, deps);
			const type = config.type ? String(config.type) : "unknown";
			const storybook = checkStorybookStatus(projectPath, vaultRoot, config, deps);
			return { name: e.name, type, hasNote, storybook };
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getProjectDetail(name: string, projectsDir: string, vaultRoot: string, deps: ProjectDeps): ProjectDetail | null {
	const projectPath = deps.paths.join(projectsDir, name);
	if (!deps.disk.existsSync(projectPath)) return null;

	const notePath = deps.paths.join(projectPath, `${name}.md`);
	const hasNote = deps.disk.existsSync(notePath);
	const config = readConfig(projectPath, deps);
	const type = config.type ? String(config.type) : "unknown";
	const storybook = checkStorybookStatus(projectPath, vaultRoot, config, deps);

	return { name, type, hasNote, notePath: hasNote ? notePath : null, projectPath, storybook };
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/project-api.ts" "01 - Projects/Flowti CLI/tests/domain/serve/project-api.test.ts"
git commit -m "feat(cli/serve): add project-api domain functions for project listing and detail"
```

---

### Task 2: Wire project + storybook routes into `static-server.ts`

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`

Add `projectsDir` to `ServerContext`, then add the 7 new API routes after the existing agent routes.

- [ ] **Step 1: Add `projectsDir` to `ServerContext`**

In `static-server.ts`, add to `ServerContext` interface:
```typescript
readonly projectsDir: string;
```

- [ ] **Step 2: Add project routes to `handleApiRoute`**

After the last `/api/agent/*` route (before the 404 fallback), add:

```typescript
// ── Project API ──────────────────────────────────────────────────

if (urlPath === "/api/projects" && req.method === "GET") {
	const { listProjectSummaries } = await import("./project-api.js");
	const projects = listProjectSummaries(ctx.projectsDir, ctx.vaultRoot, ctx.deps);
	json(200, { projects });
	return;
}

const projectMatch = urlPath.match(/^\/api\/projects\/(.+)$/);
if (projectMatch && req.method === "GET") {
	const { getProjectDetail } = await import("./project-api.js");
	const detail = getProjectDetail(decodeURIComponent(projectMatch[1]), ctx.projectsDir, ctx.vaultRoot, ctx.deps);
	json(detail ? 200 : 404, detail ?? { error: "Project not found" });
	return;
}

// ── Storybook API ────────────────────────────────────────────────

if (urlPath === "/api/storybook/install" && req.method === "POST") {
	const body = await parseJsonBody(req);
	const project = String(body.project ?? "");
	const framework = String(body.framework ?? "html");
	if (!project) { json(400, { error: "project required" }); return; }

	const projectPath = ctx.deps.paths.join(ctx.projectsDir, project);
	if (!ctx.deps.disk.existsSync(projectPath)) { json(404, { error: "Project not found" }); return; }

	try {
		const { installStorybook, resolveStorybookDir } = await import("../make/component/storybook-service.js");
		const { setFramework } = await import("../make/component/storybook-settings.js");
		setFramework(projectPath, framework, ctx.deps);
		const sbDir = resolveStorybookDir(projectPath, {}, ctx.deps);
		installStorybook(projectPath, project, sbDir, framework, ctx.deps);
		json(200, { ok: true });
	} catch (err) {
		json(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
	}
	return;
}

if (urlPath === "/api/storybook/scaffold" && req.method === "POST") {
	const body = await parseJsonBody(req);
	const project = String(body.project ?? "");
	if (!project) { json(400, { error: "project required" }); return; }

	const projectPath = ctx.deps.paths.join(ctx.projectsDir, project);
	if (!ctx.deps.disk.existsSync(projectPath)) { json(404, { error: "Project not found" }); return; }

	try {
		const { scaffoldStorybookFromSitemap } = await import("../make/storybook-scaffold.js");
		const { getFramework } = await import("../make/component/storybook-settings.js");
		const sitemapPath = ctx.deps.paths.join(projectPath, "configs", "sitemap.json");
		const framework = getFramework(projectPath, ctx.deps) ?? "html";
		const result = scaffoldStorybookFromSitemap(sitemapPath, framework, ctx.deps);
		if (!result.ok) { json(400, { ok: false, error: result.error }); return; }
		// Write generated files
		let filesCreated = 0;
		for (const file of result.files ?? []) {
			const fullPath = ctx.deps.paths.join(projectPath, file.path);
			const dir = ctx.deps.paths.join(fullPath, "..");
			if (!ctx.deps.disk.existsSync(dir)) ctx.deps.disk.mkdirSync(dir, { recursive: true });
			ctx.deps.disk.writeFileSync(fullPath, file.content, "utf-8");
			filesCreated++;
		}
		json(200, { ok: true, filesCreated });
	} catch (err) {
		json(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
	}
	return;
}

if (urlPath === "/api/storybook/start" && req.method === "POST") {
	const body = await parseJsonBody(req);
	const project = String(body.project ?? "");
	if (!project) { json(400, { error: "project required" }); return; }

	const projectPath = ctx.deps.paths.join(ctx.projectsDir, project);
	if (!ctx.deps.disk.existsSync(projectPath)) { json(404, { error: "Project not found" }); return; }

	try {
		const { resolveStorybookDir } = await import("../make/component/storybook-service.js");
		const sbDir = resolveStorybookDir(projectPath, {}, ctx.deps);
		const { spawn } = await import("node:child_process");
		const child = spawn("npx", ["storybook", "dev", "-p", "6006", "--no-open"], {
			cwd: sbDir,
			detached: true,
			stdio: "ignore",
			shell: true,
			windowsHide: true,
		});
		child.unref();
		const pid = child.pid ?? 0;
		const url = "http://localhost:6006";

		// Write PID file
		const slug = project.toLowerCase().replace(/\s+/g, "-");
		const pidPath = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", `storybook-${slug}.pid`);
		const varDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var");
		if (!ctx.deps.disk.existsSync(varDir)) ctx.deps.disk.mkdirSync(varDir, { recursive: true });
		ctx.deps.disk.writeFileSync(pidPath, JSON.stringify({ pid, url, project, startedAt: new Date().toISOString() }), "utf-8");

		// Poll until ready
		const deadline = Date.now() + 30000;
		while (Date.now() < deadline) {
			try {
				const res = await fetch(`${url}/`);
				if (res.ok) { json(200, { ok: true, url, pid }); return; }
			} catch { /* not ready */ }
			await new Promise((r) => setTimeout(r, 1000));
		}
		json(200, { ok: true, url, pid });
	} catch (err) {
		json(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
	}
	return;
}

if (urlPath === "/api/storybook/stop" && req.method === "POST") {
	const body = await parseJsonBody(req);
	const project = String(body.project ?? "");
	if (!project) { json(400, { error: "project required" }); return; }

	const slug = project.toLowerCase().replace(/\s+/g, "-");
	const pidPath = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", `storybook-${slug}.pid`);
	try {
		if (ctx.deps.disk.existsSync(pidPath)) {
			const data = JSON.parse(ctx.deps.disk.readFileSync(pidPath, "utf-8")) as { pid?: number };
			if (data.pid) {
				try { process.kill(data.pid, "SIGTERM"); } catch { /* already dead */ }
			}
			ctx.deps.disk.unlinkSync(pidPath);
		}
		json(200, { ok: true });
	} catch (err) {
		json(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
	}
	return;
}

if (urlPath === "/api/storybook/build" && req.method === "POST") {
	const body = await parseJsonBody(req);
	const project = String(body.project ?? "");
	if (!project) { json(400, { error: "project required" }); return; }

	const projectPath = ctx.deps.paths.join(ctx.projectsDir, project);
	if (!ctx.deps.disk.existsSync(projectPath)) { json(404, { error: "Project not found" }); return; }

	try {
		const { resolveStorybookDir } = await import("../make/component/storybook-service.js");
		const { execSync } = await import("node:child_process");
		const sbDir = resolveStorybookDir(projectPath, {}, ctx.deps);
		execSync("npx storybook build", { cwd: sbDir, timeout: 120000, windowsHide: true });
		json(200, { ok: true, outputDir: ctx.deps.paths.join(sbDir, "storybook-static") });
	} catch (err) {
		json(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
	}
	return;
}
```

- [ ] **Step 3: Update `dashboard-service.ts` to pass `projectsDir` into ServerContext**

Find where `serverContext` is created and add `projectsDir`:
```typescript
projectsDir: opts.projectsDir,
```

- [ ] **Step 4: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/project-api.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Build CLI**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts" "01 - Projects/Flowti CLI/src/domain/serve/dashboard-service.ts"
git commit -m "feat(cli/serve): add /api/projects and /api/storybook endpoints"
```

---

## Chunk 2: Plugin — Domain Types + Project Service

### Task 3: Domain types for projects

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/domain/projects/types.ts`
- Test: `01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/domain/projects/types.test.ts
import { describe, it, expect } from "vitest";
import type { ProjectSummary, ProjectDetail, StorybookStatus } from "../../../src/domain/projects/types.js";

describe("project domain types", () => {
	it("ProjectSummary has required shape", () => {
		const sb: StorybookStatus = { installed: true, framework: "react", running: false, url: null, pid: null };
		const p: ProjectSummary = { name: "Alpha", type: "typescript", hasNote: true, storybook: sb };
		expect(p.name).toBe("Alpha");
		expect(p.storybook.framework).toBe("react");
	});

	it("ProjectDetail extends ProjectSummary", () => {
		const sb: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null };
		const d: ProjectDetail = { name: "Beta", type: "unknown", hasNote: false, notePath: null, projectPath: "/projects/Beta", storybook: sb };
		expect(d.projectPath).toBe("/projects/Beta");
	});
});
```

- [ ] **Step 2: Create `src/domain/projects/types.ts`**

```typescript
// src/domain/projects/types.ts
export interface StorybookStatus {
	readonly installed: boolean;
	readonly framework: string | null;
	readonly running: boolean;
	readonly url: string | null;
	readonly pid: number | null;
}

export interface ProjectSummary {
	readonly name: string;
	readonly type: string;
	readonly hasNote: boolean;
	readonly storybook: StorybookStatus;
}

export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
}

export type StorybookFramework = "html-vite" | "react" | "vue" | "angular";
```

- [ ] **Step 3: Run test — expect PASS**
- [ ] **Step 4: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/tests/domain/projects/types.test.ts"
git commit -m "feat(plugin/projects): add domain types for project hub"
```

---

### Task 4: HTTP project service

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/projects/http-project-service.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/infrastructure/projects/http-project-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpProjectService } from "../../../src/infrastructure/projects/http-project-service.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
	return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) };
}

describe("HttpProjectService", () => {
	beforeEach(() => { mockFetch.mockReset(); });

	it("listProjects returns project summaries", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			projects: [{ name: "Alpha", type: "typescript", hasNote: true, storybook: { installed: false, framework: null, running: false, url: null, pid: null } }],
		}));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.listProjects();
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Alpha");
	});

	it("getProject returns project detail", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			name: "Alpha", type: "typescript", hasNote: true, notePath: "/path", projectPath: "/path",
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null },
		}));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.getProject("Alpha");
		expect(result?.storybook.framework).toBe("react");
	});

	it("installStorybook posts to /api/storybook/install", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.installStorybook("Alpha", "react");
		expect(result.ok).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith(
			"http://localhost:3000/api/storybook/install",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("startStorybook returns url", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, url: "http://localhost:6006", pid: 123 }));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.startStorybook("Alpha");
		expect(result.url).toBe("http://localhost:6006");
	});

	it("stopStorybook posts to /api/storybook/stop", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.stopStorybook("Alpha");
		expect(result.ok).toBe(true);
	});

	it("buildStorybook posts to /api/storybook/build", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, outputDir: "/path" }));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.buildStorybook("Alpha");
		expect(result.ok).toBe(true);
	});

	it("scaffoldStorybook posts to /api/storybook/scaffold", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, filesCreated: 5 }));
		const service = new HttpProjectService("http://localhost:3000");
		const result = await service.scaffoldStorybook("Alpha");
		expect(result.ok).toBe(true);
	});
});
```

- [ ] **Step 2: Create `src/infrastructure/projects/http-project-service.ts`**

```typescript
// src/infrastructure/projects/http-project-service.ts
import type { ProjectSummary, ProjectDetail } from "../../domain/projects/types.js";

interface ApiResult { ok: boolean; error?: string; [key: string]: unknown }

export class HttpProjectService {
	private baseUrl: string;

	constructor(baseUrl: string) { this.baseUrl = baseUrl; }

	async listProjects(): Promise<ProjectSummary[]> {
		try {
			const res = await fetch(`${this.baseUrl}/api/projects`);
			if (!res.ok) return [];
			const data = await res.json() as { projects: ProjectSummary[] };
			return data.projects ?? [];
		} catch { return []; }
	}

	async getProject(name: string): Promise<ProjectDetail | null> {
		try {
			const res = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(name)}`);
			if (!res.ok) return null;
			return await res.json() as ProjectDetail;
		} catch { return null; }
	}

	async installStorybook(project: string, framework: string): Promise<ApiResult> {
		return this.post("/api/storybook/install", { project, framework });
	}

	async startStorybook(project: string): Promise<ApiResult & { url?: string; pid?: number }> {
		return this.post("/api/storybook/start", { project });
	}

	async stopStorybook(project: string): Promise<ApiResult> {
		return this.post("/api/storybook/stop", { project });
	}

	async buildStorybook(project: string): Promise<ApiResult> {
		return this.post("/api/storybook/build", { project });
	}

	async scaffoldStorybook(project: string): Promise<ApiResult & { filesCreated?: number }> {
		return this.post("/api/storybook/scaffold", { project });
	}

	private async post(path: string, body: Record<string, unknown>): Promise<ApiResult> {
		try {
			const res = await fetch(`${this.baseUrl}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			return await res.json() as ApiResult;
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Network error" };
		}
	}
}
```

- [ ] **Step 3: Run test — expect PASS**
- [ ] **Step 4: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/projects/http-project-service.test.ts"
git commit -m "feat(plugin/projects): add HttpProjectService for CLI server communication"
```

---

## Chunk 3: Plugin — Lit Components

### Task 5: `flowti-storybook-section` component

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/components/projects/flowti-storybook-section.ts`
- Test: `01 - Projects/Flowti Plugin/tests/components/projects/flowti-storybook-section.test.ts`

This is the storybook management card with three states: not-installed, installed, running.

- [ ] **Step 1: Write test, Step 2: Run — fail, Step 3: Implement, Step 4: Run — pass, Step 5: Commit**

Follow the TDD pattern from Phase B agent components. The test should cover:
- Renders "not configured" when `installed=false`
- Shows 4 framework buttons when not installed
- Dispatches `storybook-install` with `{ framework }` on button click
- Shows action buttons (Start, Scaffold, Build) when installed but not running
- Shows running indicator (green dot + URL) when running
- Dispatches `storybook-start`, `storybook-stop`, `storybook-build`, `storybook-scaffold` events

Commit: `git commit -m "feat(plugin/projects): add flowti-storybook-section component"`

---

### Task 6: `flowti-project-detail` root component

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts`
- Test: `01 - Projects/Flowti Plugin/tests/components/projects/flowti-project-detail.test.ts`

Root detail component with header (name, type, note status, back button) + storybook section.

- [ ] **Step 1-5: TDD cycle**

Tests should cover:
- Renders project name and type
- Shows "Create note" button when `hasNote=false`
- Shows "Open note" link when `hasNote=true`
- Dispatches `back-to-list`, `open-project-note`, `create-project-note` events
- Composes `<flowti-storybook-section>` child component
- Passes storybook status to child

Commit: `git commit -m "feat(plugin/projects): add flowti-project-detail root component"`

---

## Chunk 4: Plugin — Handler, View, Bootstrap

### Task 7: Project handler

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts`

Mounts `<flowti-project-detail>`, bridges component events to `HttpProjectService` calls. Same pattern as `agent-handlers.ts`.

- [ ] **Step 1-5: TDD cycle**

Tests should cover:
- Mounts element into container
- Sets project data from service
- Forwards storybook-install to service.installStorybook
- Forwards storybook-start → service.startStorybook → opens webviewer
- Forwards storybook-stop, storybook-build, storybook-scaffold
- Dispose removes element

Commit: `git commit -m "feat(plugin/projects): add project handler bridging components to CLI server"`

---

### Task 8: View + Bootstrap + Registration

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/ui/projects/project-detail-view.ts`
- Create: `01 - Projects/Flowti Plugin/src/ui/projects/types.ts`
- Create: `01 - Projects/Flowti Plugin/src/bootstrap/project-setup.ts`
- Modify: `01 - Projects/Flowti Plugin/src/main.ts` (add project setup)

- [ ] **Step 1: Create view type constant**

```typescript
// src/ui/projects/types.ts
export const VIEW_TYPE_PROJECT_DETAIL = "flowti-project-detail";
```

- [ ] **Step 2: Create project detail ItemView**

Same pattern as `agent-sidepanel-view.ts`. Dynamic import of `project-handlers.ts`.

- [ ] **Step 3: Create `project-setup.ts`**

Registers detail view, adds `"Open project hub"` command + ribbon icon.

- [ ] **Step 4: Wire into `main.ts`**

Add import and call `setupProjectDomain()` in `onload`.

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit -skipLibCheck`

- [ ] **Step 6: Build plugin**

Run: `cd "01 - Projects/Flowti Plugin" && node esbuild.config.mjs`

- [ ] **Step 7: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/ui/projects/" "01 - Projects/Flowti Plugin/src/bootstrap/project-setup.ts" "01 - Projects/Flowti Plugin/src/main.ts"
git commit -m "feat(plugin/projects): register project detail view + bootstrap + command"
```

---

### Task 9: Quality gate

- [ ] Run CLI tests: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/project-api.test.ts --config configs/vitest.config.ts`
- [ ] Run Plugin tests: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects tests/infrastructure/projects tests/components/projects tests/infrastructure/handlers/project-handlers.test.ts`
- [ ] Run type check: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit -skipLibCheck`
- [ ] Build both: CLI + Plugin
- [ ] Fix any issues and commit

---

## Summary

| Task | What | Project | Tests (est.) |
|------|------|---------|-------------|
| 1 | `project-api.ts` domain functions | CLI | 4 |
| 2 | Wire API routes into static-server | CLI | — |
| 3 | Domain types (`types.ts`) | Plugin | 2 |
| 4 | `HttpProjectService` | Plugin | 7 |
| 5 | `flowti-storybook-section` component | Plugin | 6 |
| 6 | `flowti-project-detail` component | Plugin | 6 |
| 7 | Project handler | Plugin | 6 |
| 8 | View + Bootstrap + Registration | Plugin | — |
| 9 | Quality gate | Both | full suite |
| **Total** | **9 tasks** | | **~31** |
