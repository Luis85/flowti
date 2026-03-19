# Project Sidebar — Market-Ready Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Import from Git" with bootstrap wizard to the project sidebar, plus UX polish for market readiness.

**Architecture:** CLI gets three new commands (`project:create`, `project:detect`, `project:bootstrap`) added to the existing `project.controller.ts`, backed by three pure domain modules. Git clone/submodule operations are handled directly by the Plugin's `VaultProjectService` (no CLI command — git must run in the vault root). Plugin gets two new Lit components (dropdown + modal wizard) wired through the existing handler/service pattern. UX polish applies across existing components.

**Tech Stack:** TypeScript, Vitest, Lit, Obsidian API, git CLI

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-project-sidebar-market-ready-design.md`

---

## Chunk 1: CLI Domain + Controller

### Task 1: Git URL Normalizer

**Files:**
- Create: `src/domain/project/git-url.ts`
- Test: `tests/domain/project/git-url.test.ts`

- [ ] **Step 1: Write failing tests for URL normalization**

```typescript
// tests/domain/project/git-url.test.ts
import { describe, it, expect } from "vitest";
import { normalizeGitUrl, extractRepoName } from "../../../src/domain/project/git-url.js";

describe("normalizeGitUrl", () => {
	it("appends .git to bare GitHub HTTPS URL", () => {
		expect(normalizeGitUrl("https://github.com/user/repo")).toBe("https://github.com/user/repo.git");
	});

	it("strips /tree/main path from GitHub URL", () => {
		expect(normalizeGitUrl("https://github.com/user/repo/tree/main/src")).toBe("https://github.com/user/repo.git");
	});

	it("passes through SSH URLs unchanged", () => {
		expect(normalizeGitUrl("git@github.com:user/repo.git")).toBe("git@github.com:user/repo.git");
	});

	it("strips /-/tree path from GitLab URL", () => {
		expect(normalizeGitUrl("https://gitlab.com/user/repo/-/tree/main")).toBe("https://gitlab.com/user/repo.git");
	});

	it("strips /src/main from Bitbucket URL", () => {
		expect(normalizeGitUrl("https://bitbucket.org/user/repo/src/main")).toBe("https://bitbucket.org/user/repo.git");
	});

	it("passes through Azure DevOps _git URL", () => {
		expect(normalizeGitUrl("https://dev.azure.com/org/project/_git/repo")).toBe("https://dev.azure.com/org/project/_git/repo");
	});

	it("converts legacy visualstudio.com to dev.azure.com", () => {
		expect(normalizeGitUrl("https://org.visualstudio.com/project/_git/repo")).toBe("https://dev.azure.com/org/project/_git/repo");
	});

	it("strips query params from Azure DevOps URL", () => {
		expect(normalizeGitUrl("https://dev.azure.com/org/project/_git/repo?path=/src&version=GBmain")).toBe("https://dev.azure.com/org/project/_git/repo");
	});

	it("passes through generic .git URL unchanged", () => {
		expect(normalizeGitUrl("https://example.com/repo.git")).toBe("https://example.com/repo.git");
	});

	it("returns empty string for empty input", () => {
		expect(normalizeGitUrl("")).toBe("");
	});
});

describe("extractRepoName", () => {
	it("extracts name from GitHub URL", () => {
		expect(extractRepoName("https://github.com/user/my-app.git")).toBe("my-app");
	});

	it("extracts name from Azure DevOps URL", () => {
		expect(extractRepoName("https://dev.azure.com/org/project/_git/repo")).toBe("repo");
	});

	it("extracts name from SSH URL", () => {
		expect(extractRepoName("git@github.com:user/cool-lib.git")).toBe("cool-lib");
	});

	it("returns empty string for empty input", () => {
		expect(extractRepoName("")).toBe("");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/git-url.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `normalizeGitUrl` and `extractRepoName`**

```typescript
// src/domain/project/git-url.ts
/**
 * git-url.ts — Pure domain: normalize git URLs from any host.
 *
 * Handles GitHub, GitLab, Bitbucket, Azure DevOps, and generic URLs.
 * Strips UI-only paths (tree, blob, branches) and query params.
 */

export function normalizeGitUrl(raw: string): string {
	const url = raw.trim();
	if (!url) return "";

	// SSH URLs — pass through
	if (url.startsWith("git@")) return url;

	let parsed: URL;
	try { parsed = new URL(url); } catch { return url; }

	// Strip query params
	parsed.search = "";
	parsed.hash = "";

	const host = parsed.hostname.toLowerCase();

	// Azure DevOps — legacy visualstudio.com conversion
	const vsMatch = host.match(/^(.+)\.visualstudio\.com$/);
	if (vsMatch) {
		const org = vsMatch[1];
		const pathParts = parsed.pathname.split("/").filter(Boolean);
		if (pathParts.length >= 3 && pathParts[1] === "_git") {
			return `https://dev.azure.com/${org}/${pathParts[0]}/_git/${pathParts[2]}`;
		}
	}

	// Azure DevOps — pass through (already clean after query strip)
	if (host === "dev.azure.com") {
		return parsed.toString();
	}

	const path = parsed.pathname;

	// GitHub: strip /tree/..., /blob/..., /branches, etc.
	if (host === "github.com") {
		const repoMatch = path.match(/^\/([^/]+\/[^/]+)/);
		if (repoMatch) {
			const repoPath = repoMatch[1].replace(/\.git$/, "");
			return `https://github.com/${repoPath}.git`;
		}
	}

	// GitLab: strip /-/tree/..., /-/blob/..., etc.
	if (host === "gitlab.com" || host.includes("gitlab")) {
		const repoMatch = path.match(/^\/([^/]+\/[^/]+)/);
		if (repoMatch) {
			const repoPath = repoMatch[1].replace(/\.git$/, "");
			return `${parsed.origin}/${repoPath}.git`;
		}
	}

	// Bitbucket: strip /src/..., /branches, etc.
	if (host === "bitbucket.org") {
		const repoMatch = path.match(/^\/([^/]+\/[^/]+)/);
		if (repoMatch) {
			const repoPath = repoMatch[1].replace(/\.git$/, "");
			return `https://bitbucket.org/${repoPath}.git`;
		}
	}

	// Generic: pass through
	return parsed.toString();
}

export function extractRepoName(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return "";

	// SSH: git@host:user/repo.git
	const sshMatch = trimmed.match(/\/([^/]+?)(?:\.git)?$/);
	if (trimmed.startsWith("git@") && sshMatch) return sshMatch[1];

	// Azure DevOps: .../_git/repo
	const azureMatch = trimmed.match(/\/_git\/([^/?]+)/);
	if (azureMatch) return azureMatch[1];

	// HTTPS: last path segment, strip .git
	try {
		const parsed = new URL(trimmed);
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length >= 2) {
			return segments[1].replace(/\.git$/, "");
		}
	} catch {
		// Fall through
	}

	return "";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/git-url.test.ts --config configs/vitest.config.ts`
Expected: PASS (10 + 4 tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/project/git-url.ts" "01 - Projects/Flowti CLI/tests/domain/project/git-url.test.ts"
git commit -m "feat(project): add git URL normalizer with multi-host support"
```

---

### Task 2: Project Detector

**Files:**
- Create: `src/domain/project/project-detect.ts`
- Test: `tests/domain/project/project-detect.test.ts`

- [ ] **Step 1: Write failing tests for project detection**

```typescript
// tests/domain/project/project-detect.test.ts
import { describe, it, expect } from "vitest";
import { detectProject, type DetectionResult } from "../../../src/domain/project/project-detect.js";

function mockDeps(files: Record<string, string>) {
	return {
		disk: {
			existsSync: (p: string) => Object.keys(files).some((f) => p.endsWith(f)),
			readFileSync: (p: string) => {
				const key = Object.keys(files).find((f) => p.endsWith(f));
				return key ? files[key] : "";
			},
		},
		paths: {
			join: (...args: string[]) => args.join("/"),
		},
	};
}

describe("detectProject", () => {
	it("detects typescript when tsconfig.json exists", () => {
		const deps = mockDeps({ "tsconfig.json": "{}", "package.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.type).toBe("typescript");
	});

	it("detects javascript when no tsconfig", () => {
		const deps = mockDeps({ "package.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.type).toBe("javascript");
	});

	it("detects React framework from devDependencies", () => {
		const pkg = JSON.stringify({ devDependencies: { react: "^18", "vite": "^5" } });
		const deps = mockDeps({ "package.json": pkg, "vite.config.ts": "" });
		const result = detectProject("/project", deps);
		expect(result.framework).toBe("React");
	});

	it("detects Angular from angular.json", () => {
		const deps = mockDeps({ "package.json": "{}", "angular.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.framework).toBe("Angular");
	});

	it("detects npm from package-lock.json", () => {
		const deps = mockDeps({ "package.json": "{}", "package-lock.json": "" });
		const result = detectProject("/project", deps);
		expect(result.packageManager).toBe("npm");
	});

	it("detects yarn from yarn.lock", () => {
		const deps = mockDeps({ "package.json": "{}", "yarn.lock": "" });
		const result = detectProject("/project", deps);
		expect(result.packageManager).toBe("yarn");
	});

	it("detects vitest from devDependencies", () => {
		const pkg = JSON.stringify({ devDependencies: { vitest: "^1" } });
		const deps = mockDeps({ "package.json": pkg });
		const result = detectProject("/project", deps);
		expect(result.testFramework).toBe("vitest");
	});

	it("detects existing flowti.config.json", () => {
		const deps = mockDeps({ "package.json": "{}", "configs/flowti.config.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.hasConfig).toBe(true);
	});

	it("returns unknown type when no package.json", () => {
		const deps = mockDeps({});
		const result = detectProject("/project", deps);
		expect(result.type).toBe("unknown");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/project-detect.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `detectProject`**

```typescript
// src/domain/project/project-detect.ts
/**
 * project-detect.ts — Pure domain: scan a project directory and detect its type.
 *
 * Detects: language type, framework, package manager, test framework, existing config.
 * No I/O — all file access via injected deps.
 */

export interface DetectionResult {
	readonly type: "typescript" | "javascript" | "unknown";
	readonly framework: string | undefined;
	readonly packageManager: "npm" | "yarn" | "pnpm" | "bun" | undefined;
	readonly testFramework: string | undefined;
	readonly hasConfig: boolean;
	readonly buildCommand: string | undefined;
	readonly testCommand: string | undefined;
	readonly lintCommand: string | undefined;
}

interface DetectDeps {
	readonly disk: {
		existsSync(path: string): boolean;
		readFileSync(path: string): string;
	};
	readonly paths: {
		join(...segments: string[]): string;
	};
}

export function detectProject(projectPath: string, deps: DetectDeps): DetectionResult {
	const { disk, paths } = deps;

	const exists = (rel: string) => disk.existsSync(paths.join(projectPath, rel));
	const readJson = (rel: string): Record<string, unknown> => {
		try {
			return JSON.parse(disk.readFileSync(paths.join(projectPath, rel))) as Record<string, unknown>;
		} catch { return {}; }
	};

	// ── Type ────────────────────────────────────────────────
	const hasPkg = exists("package.json");
	const hasTsConfig = exists("tsconfig.json");
	const type = !hasPkg ? "unknown" : hasTsConfig ? "typescript" : "javascript";

	// ── Framework ───────────────────────────────────────────
	const pkg = hasPkg ? readJson("package.json") : {};
	const allDeps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
	const framework = detectFramework(allDeps, exists);

	// ── Package manager ─────────────────────────────────────
	const packageManager = exists("bun.lockb") ? "bun" as const
		: exists("pnpm-lock.yaml") ? "pnpm" as const
		: exists("yarn.lock") ? "yarn" as const
		: exists("package-lock.json") ? "npm" as const
		: undefined;

	// ── Test framework ──────────────────────────────────────
	const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
	const testFramework = "vitest" in devDeps ? "vitest"
		: "jest" in devDeps ? "jest"
		: "mocha" in devDeps ? "mocha"
		: "playwright" in devDeps || "@playwright/test" in devDeps ? "playwright"
		: "cypress" in devDeps ? "cypress"
		: undefined;

	// ── Config ──────────────────────────────────────────────
	const hasConfig = exists("flowti.config.json") || exists("configs/flowti.config.json");

	// ── Commands from scripts ───────────────────────────────
	const scripts = (pkg.scripts ?? {}) as Record<string, string>;
	const pm = packageManager ?? "npm";
	const buildCommand = scripts.build ? `${pm} run build` : undefined;
	const testCommand = scripts.test ? `${pm} test` : undefined;
	const lintCommand = scripts.lint ? `${pm} run lint` : undefined;

	return { type, framework, packageManager, testFramework, hasConfig, buildCommand, testCommand, lintCommand };
}

function detectFramework(deps: Record<string, string>, exists: (rel: string) => boolean): string | undefined {
	if (exists("angular.json")) return "Angular";
	if (exists("next.config.js") || exists("next.config.ts") || exists("next.config.mjs")) return "Next.js";
	if (exists("nuxt.config.js") || exists("nuxt.config.ts")) return "Nuxt";
	if (("react" in deps || "react-dom" in deps) && ("vite" in deps || exists("vite.config.ts") || exists("vite.config.js"))) return "React";
	if ("vue" in deps) return "Vue";
	if ("svelte" in deps) return "Svelte";
	if ("react" in deps || "react-dom" in deps) return "React";
	return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/project-detect.test.ts --config configs/vitest.config.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/project/project-detect.ts" "01 - Projects/Flowti CLI/tests/domain/project/project-detect.test.ts"
git commit -m "feat(project): add project type detector with framework/tooling inference"
```

---

### Task 3: Project Bootstrap Config Writer

**Files:**
- Create: `src/domain/project/project-bootstrap.ts`
- Test: `tests/domain/project/project-bootstrap.test.ts`

- [ ] **Step 1: Write failing tests for bootstrap config generation**

```typescript
// tests/domain/project/project-bootstrap.test.ts
import { describe, it, expect } from "vitest";
import { buildBootstrapConfig } from "../../../src/domain/project/project-bootstrap.js";

describe("buildBootstrapConfig", () => {
	it("generates config with build command mapped to build mode", () => {
		const config = buildBootstrapConfig({ build: "npm run build" });
		expect(config.build.commands.full).toBe("npm run build");
	});

	it("generates config with test command mapped to test preset", () => {
		const config = buildBootstrapConfig({ test: "npm test" });
		expect(config.test.commands.unit).toBe("npm test");
	});

	it("generates config with lint threshold defaults when lint command provided", () => {
		const config = buildBootstrapConfig({ lint: "npm run lint" });
		expect(config.devtools.lint.command).toBe("npm run lint");
	});

	it("sets storybook framework in components section", () => {
		const config = buildBootstrapConfig({ storybook: "react" });
		expect(config.components.framework).toBe("react");
	});

	it("omits components section when storybook is undefined", () => {
		const config = buildBootstrapConfig({});
		expect(config.components).toBeUndefined();
	});

	it("generates minimal config when all inputs empty", () => {
		const config = buildBootstrapConfig({});
		expect(config.build.commands).toEqual({});
		expect(config.test.commands).toEqual({});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/project-bootstrap.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildBootstrapConfig`**

```typescript
// src/domain/project/project-bootstrap.ts
/**
 * project-bootstrap.ts — Pure domain: generate flowti.config.json content.
 *
 * Takes wizard answers (build/test/lint commands, storybook framework)
 * and produces the config object to write to disk.
 */

export interface BootstrapInput {
	readonly build?: string;
	readonly test?: string;
	readonly lint?: string;
	readonly storybook?: string;
}

export interface BootstrapConfig {
	readonly build: { readonly commands: Record<string, string> };
	readonly test: { readonly commands: Record<string, string> };
	readonly devtools: { readonly lint: { readonly command?: string; readonly maxComplexity: number; readonly maxLines: number } };
	readonly components?: { readonly framework: string };
}

export function buildBootstrapConfig(input: BootstrapInput): BootstrapConfig {
	const buildCommands: Record<string, string> = {};
	if (input.build) buildCommands.full = input.build;

	const testCommands: Record<string, string> = {};
	if (input.test) testCommands.unit = input.test;

	const config: BootstrapConfig = {
		build: { commands: buildCommands },
		test: { commands: testCommands },
		devtools: {
			lint: {
				...(input.lint ? { command: input.lint } : {}),
				maxComplexity: 10,
				maxLines: 350,
			},
		},
		...(input.storybook ? { components: { framework: input.storybook } } : {}),
	};

	return config;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/project-bootstrap.test.ts --config configs/vitest.config.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/project/project-bootstrap.ts" "01 - Projects/Flowti CLI/tests/domain/project/project-bootstrap.test.ts"
git commit -m "feat(project): add bootstrap config generator for wizard output"
```

---

### Task 4: Project Controller (CLI Commands)

**Note:** `src/controller/project.controller.ts` already exists and exports `project` + `readme` commands. We ADD the three new commands to it. Do NOT overwrite existing commands.

**Files:**
- Modify: `src/controller/project.controller.ts` — add `project:create`, `project:detect`, `project:bootstrap`
- Test: `tests/controller/project.controller.test.ts`

- [ ] **Step 1: Write failing test for `project:detect` command**

```typescript
// tests/controller/project.controller.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return { paths: { join: (...a: string[]) => a.join("/"), dirname: path.default.dirname, basename: path.default.basename } };
});
vi.mock("../../src/infrastructure/config.js", () => ({ PROJECTS_DIR: "/mock/projects" }));

import { commands } from "../../src/controller/project.controller.js";

describe("project:detect", () => {
	it("is registered as a command", () => {
		expect(commands["project:detect"]).toBeDefined();
	});
});

describe("project:create", () => {
	it("is registered as a command", () => {
		expect(commands["project:create"]).toBeDefined();
	});
});

describe("project:bootstrap", () => {
	it("is registered as a command", () => {
		expect(commands["project:bootstrap"]).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/project.controller.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add new commands to existing project controller**

Add imports at the top of the existing `src/controller/project.controller.ts`:

```typescript
import { detectProject, type DetectionResult } from "../domain/project/project-detect.js";
import { buildBootstrapConfig } from "../domain/project/project-bootstrap.js";
```

Then add these three commands to the existing `commands` record (after the `readme` command):

```typescript
	"project:create": adaptDescriptor<{ name: string }, { created: boolean; path: string }>({
		flags: {
			name: { type: "string", required: true, hint: "--name=<project-name>" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const name = ctx.flags.name;
			const projectPath = paths.join(PROJECTS_DIR, name);

			if (disk.existsSync(projectPath)) {
				return { created: false, path: projectPath };
			}

			disk.mkdirSync(paths.join(projectPath, "configs"), { recursive: true });

			const minimalConfig = { build: { commands: {} }, test: { commands: {} } };
			disk.writeFileSync(
				paths.join(projectPath, "configs", "flowti.config.json"),
				JSON.stringify(minimalConfig, null, "\t") + "\n",
				"utf8",
			);

			const briefContent = `---\ntype: ProjectBrief\n---\n\n# ${name}\n\n`;
			disk.writeFileSync(paths.join(projectPath, `${name}.md`), briefContent, "utf8");

			return { created: true, path: projectPath };
		},
		renderer: (data, log) => {
			if (!data.created) { log(`  Project already exists at ${data.path}`); return; }
			log(`  Created project at ${data.path}`);
		},
	}),

	"project:detect": adaptDescriptor<{ project: string }, DetectionResult>({
		flags: {
			project: { type: "string", required: true, hint: "--project=<name>" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const projectPath = paths.join(PROJECTS_DIR, ctx.flags.project);
			return detectProject(projectPath, { disk, paths });
		},
		renderer: (data, log) => {
			log(`  Type: ${data.type}`);
			if (data.framework) log(`  Framework: ${data.framework}`);
			if (data.packageManager) log(`  Package manager: ${data.packageManager}`);
			if (data.testFramework) log(`  Test framework: ${data.testFramework}`);
			log(`  Has config: ${data.hasConfig ? "yes" : "no"}`);
		},
	}),

	"project:bootstrap": adaptDescriptor<{ project: string; build: string; test: string; lint: string; storybook: string }, { path: string }>({
		flags: {
			project: { type: "string", required: true, hint: "--project=<name>" },
			build: { type: "string", required: false, hint: "--build=<cmd>" },
			test: { type: "string", required: false, hint: "--test=<cmd>" },
			lint: { type: "string", required: false, hint: "--lint=<cmd>" },
			storybook: { type: "string", required: false, hint: "--storybook=<framework>" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const projectPath = paths.join(PROJECTS_DIR, ctx.flags.project);
			const configDir = paths.join(projectPath, "configs");

			if (!disk.existsSync(configDir)) {
				disk.mkdirSync(configDir, { recursive: true });
			}

			const config = buildBootstrapConfig({
				build: ctx.flags.build || undefined,
				test: ctx.flags.test || undefined,
				lint: ctx.flags.lint || undefined,
				storybook: ctx.flags.storybook || undefined,
			});

			const configPath = paths.join(configDir, "flowti.config.json");
			disk.writeFileSync(configPath, JSON.stringify(config, null, "\t") + "\n", "utf8");

			// Create brief note if it doesn't exist
			const name = ctx.flags.project;
			const briefPath = paths.join(projectPath, `${name}.md`);
			if (!disk.existsSync(briefPath)) {
				const briefContent = `---\ntype: ProjectBrief\n---\n\n# ${name}\n\n`;
				disk.writeFileSync(briefPath, briefContent, "utf8");
			}

			return { path: configPath };
		},
		renderer: (data, log) => {
			log(`  Config written to ${data.path}`);
		},
	}),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/project.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/project.controller.ts" "01 - Projects/Flowti CLI/tests/controller/project.controller.test.ts"
git commit -m "feat(project): add project:create, project:detect, project:bootstrap CLI commands"
```

---

## Chunk 2: Plugin Components + Handler Wiring + UX Polish

### Task 5: Expand IProjectService Interface + Service Implementations

**Files:**
- Modify: `src/domain/projects/types.ts`
- Modify: `src/infrastructure/projects/vault-project-service.ts`
- Modify: `src/infrastructure/projects/http-project-service.ts`
- Modify: `tests/infrastructure/handlers/project-handlers.test.ts` — update mock

- [ ] **Step 1: Add new methods to `IProjectService`**

In `src/domain/projects/types.ts`, add before the closing `}` of `IProjectService`:

```typescript
importFromGit(url: string, name: string, mode: "submodule" | "template", onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
detectProject(name: string): Promise<{ ok: boolean; type?: string; framework?: string; packageManager?: string; testFramework?: string; hasConfig?: boolean; buildCommand?: string; testCommand?: string; lintCommand?: string; error?: string }>;
bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<{ ok: boolean; error?: string }>;
createEmptyProject(name: string): Promise<{ ok: boolean; error?: string }>;
```

- [ ] **Step 2: Implement in `VaultProjectService`**

Add methods to `vault-project-service.ts` (after `generateSitemapCanvas`):

```typescript
async importFromGit(url: string, name: string, mode: "submodule" | "template", onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const targetDir = join(vaultBase, PROJECTS_FOLDER, name);

	if (existsSync(targetDir)) {
		return { ok: false, error: `Folder "${name}" already exists` };
	}

	if (mode === "submodule") {
		const result = await runAsync("git", ["submodule", "add", url, `${PROJECTS_FOLDER}/${name}`], vaultBase, onOutput);
		return result;
	}

	// Template mode: clone then detach
	const cloneResult = await runAsync("git", ["clone", url, targetDir], vaultBase, onOutput);
	if (!cloneResult.ok) return cloneResult;

	// Remove .git directory — use shell on Windows for file-locking safety
	const gitDir = join(targetDir, ".git");
	if (existsSync(gitDir)) {
		const removeCmd = process.platform === "win32"
			? ["cmd", ["/c", "rmdir", "/s", "/q", gitDir]]
			: ["rm", ["-rf", gitDir]];
		const removeResult = await runAsync(removeCmd[0] as string, removeCmd[1] as string[], vaultBase);
		if (!removeResult.ok) {
			return { ok: false, error: "Failed to detach from remote (could not remove .git directory)" };
		}
	}

	return { ok: true };
}

async detectProject(name: string): Promise<{ ok: boolean; type?: string; framework?: string; packageManager?: string; testFramework?: string; hasConfig?: boolean; buildCommand?: string; testCommand?: string; lintCommand?: string; error?: string }> {
	// Use domain function directly — avoids JSON stdout parsing complexity.
	// Import dynamically to keep the module boundary clean.
	try {
		const vaultBase = getVaultBasePath(this.app);
		const projectPath = join(vaultBase, PROJECTS_FOLDER, name);
		const disk = { existsSync, readFileSync: (p: string) => readFileSync(p, "utf-8") };
		const paths = { join };
		// Inline detection logic matching CLI's detectProject:
		const hasPkg = existsSync(join(projectPath, "package.json"));
		const hasTsConfig = existsSync(join(projectPath, "tsconfig.json"));
		const type = !hasPkg ? "unknown" : hasTsConfig ? "typescript" : "javascript";

		let pkg: Record<string, unknown> = {};
		if (hasPkg) {
			try { pkg = JSON.parse(readFileSync(join(projectPath, "package.json"), "utf-8")) as Record<string, unknown>; } catch { /* empty */ }
		}
		const allDeps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
		const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
		const scripts = (pkg.scripts ?? {}) as Record<string, string>;

		const framework = existsSync(join(projectPath, "angular.json")) ? "Angular"
			: (existsSync(join(projectPath, "next.config.js")) || existsSync(join(projectPath, "next.config.ts"))) ? "Next.js"
			: ("react" in allDeps && ("vite" in allDeps || existsSync(join(projectPath, "vite.config.ts")))) ? "React"
			: "vue" in allDeps ? "Vue"
			: "svelte" in allDeps ? "Svelte"
			: undefined;

		const packageManager = existsSync(join(projectPath, "bun.lockb")) ? "bun"
			: existsSync(join(projectPath, "pnpm-lock.yaml")) ? "pnpm"
			: existsSync(join(projectPath, "yarn.lock")) ? "yarn"
			: existsSync(join(projectPath, "package-lock.json")) ? "npm"
			: undefined;

		const testFramework = "vitest" in devDeps ? "vitest" : "jest" in devDeps ? "jest" : undefined;
		const hasConfig = existsSync(join(projectPath, "configs", "flowti.config.json")) || existsSync(join(projectPath, "flowti.config.json"));
		const pm = packageManager ?? "npm";
		const buildCommand = scripts.build ? `${pm} run build` : undefined;
		const testCommand = scripts.test ? `${pm} test` : undefined;
		const lintCommand = scripts.lint ? `${pm} run lint` : undefined;

		return { ok: true, type, framework, packageManager, testFramework, hasConfig, buildCommand, testCommand, lintCommand };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Detection failed" };
	}
}

async bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<{ ok: boolean; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const cliBin = join(vaultBase, ".flowti", "bin");
	const args = [cliBin, "project:bootstrap", `--project="${name}"`];
	if (config.build) args.push(`--build="${config.build}"`);
	if (config.test) args.push(`--test="${config.test}"`);
	if (config.lint) args.push(`--lint="${config.lint}"`);
	if (config.storybook) args.push(`--storybook=${config.storybook}`);
	return runAsync("node", args, vaultBase);
}

async createEmptyProject(name: string): Promise<{ ok: boolean; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const cliBin = join(vaultBase, ".flowti", "bin");
	return runAsync("node", [cliBin, "project:create", `--name="${name}"`], vaultBase);
}
```

- [ ] **Step 3: Add stubs to `HttpProjectService`**

```typescript
async importFromGit(_url: string, _name: string, _mode: "submodule" | "template"): Promise<ApiResult> {
	return this.post("/api/project/import", { url: _url, name: _name, mode: _mode });
}

async detectProject(name: string): Promise<ApiResult> {
	return this.post("/api/project/detect", { name });
}

async bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<ApiResult> {
	return this.post("/api/project/bootstrap", { name, config });
}

async createEmptyProject(name: string): Promise<ApiResult> {
	return this.post("/api/project/create", { name });
}
```

- [ ] **Step 4: Update test mock**

In `tests/infrastructure/handlers/project-handlers.test.ts`, add to the `mockService()` return:

```typescript
importFromGit: vi.fn(async () => ({ ok: true })),
detectProject: vi.fn(async () => ({ ok: true, type: "typescript" })),
bootstrapProject: vi.fn(async () => ({ ok: true })),
createEmptyProject: vi.fn(async () => ({ ok: true })),
```

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "src/game/" | grep -v "tests/game/" | grep -v "setState"`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts" "01 - Projects/Flowti Plugin/src/infrastructure/projects/http-project-service.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/project-handlers.test.ts"
git commit -m "feat(plugin): expand IProjectService with import/detect/bootstrap/create methods"
```

---

### Task 6: Add Project Dropdown Component

**Files:**
- Create: `src/components/projects/flowti-add-project-dropdown.ts`
- Modify: `src/components/projects/flowti-project-detail.ts` — add "+" button + dropdown + modal slot

- [ ] **Step 1: Create the dropdown component**

Create `src/components/projects/flowti-add-project-dropdown.ts` — a Lit component with:
- "+" button that toggles a dropdown
- Three items: "Import from Git", "New from Template", "Create Empty"
- Dispatches `add-project` event with `{ mode }` detail
- Keyboard support: Escape closes, arrow keys navigate, Enter selects
- Outside click closes
- Follow existing component patterns: extend `FlowtiElement`, use `tokens`, `static properties`, `static styles`

- [ ] **Step 2: Import and render dropdown in project list header**

In `flowti-project-detail.ts`:
- Add side-effect import: `import "./flowti-add-project-dropdown.js";`
- In `renderProjectList()`, change the header from `<div class="list-header">Projects</div>` to include the dropdown component:

```typescript
<div class="list-header">
	<span>Projects</span>
	<flowti-add-project-dropdown></flowti-add-project-dropdown>
</div>
```

- Add CSS for `.list-header`: `display: flex; justify-content: space-between; align-items: center;`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-add-project-dropdown.ts" "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin): add project dropdown with import/template/empty options"
```

---

### Task 7: Git Import Modal Component

**Files:**
- Create: `src/components/projects/flowti-git-import-modal.ts`

This is the largest component. It has four internal states:
1. **form** — URL + name inputs, Setup button
2. **progress** — spinner + output log, Cancel button
3. **wizard-detect** — read-only detection results, Configure/Finish button
4. **wizard-configure** — pre-filled form, Finish button
5. **wizard-done** — summary + Open Project button

- [ ] **Step 1: Create modal component with form state**

Create `src/components/projects/flowti-git-import-modal.ts` with:
- Properties: `mode` ("submodule" | "template"), `step` ("form" | "progress" | "detect" | "configure" | "done"), URL/name fields, detection results, config fields, output lines, error
- Overlay + modal shell (same pattern as `flowti-scaffold-modal.ts`)
- Form state: URL input with auto-normalize on blur, name input with path preview, validation, Setup button
- Import `normalizeGitUrl` and `extractRepoName` — these are CLI domain functions but they're pure, so we can duplicate the logic in the component or import via a shared util. Simplest: inline the normalization logic in the component since it's small.
- Dispatches events: `import-setup`, `import-cancel`, `import-abort`, `wizard-configure`, `wizard-open-project`
- Keyboard: Escape closes, Enter submits primary action

- [ ] **Step 2: Add progress state rendering**

Add `renderProgress()` method:
- Spinner + label
- Scrollable output log (same styling as storybook output)
- Cancel button

- [ ] **Step 3: Add wizard states**

Add `renderDetect()`, `renderConfigure()`, `renderDone()` methods:
- Step indicator bar (three numbered items)
- Detect: read-only grid of detected values
- Configure: text inputs for build/test/lint + framework button group
- Done: summary + "Open Project" button

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-git-import-modal.ts"
git commit -m "feat(plugin): add git import modal with URL form, progress, and bootstrap wizard"
```

---

### Task 8: Wire Events in Project Handlers

**Files:**
- Modify: `src/infrastructure/handlers/project-handlers.ts`
- Modify: `src/components/projects/flowti-project-detail.ts` — add modal rendering

- [ ] **Step 1: Add modal slot to project detail component**

In `flowti-project-detail.ts`:
- Add import: `import "./flowti-git-import-modal.js";`
- Add properties: `showGitModal: { type: Boolean }`, `gitModalMode: { type: String }`
- In `renderProjectList()`, add the modal after the project list:

```typescript
${this.showGitModal ? html`
	<flowti-git-import-modal
		.mode="${this.gitModalMode}"
	></flowti-git-import-modal>
` : ""}
```

- [ ] **Step 2: Wire `add-project` event in handlers**

In `project-handlers.ts`, add listeners:

```typescript
el.addEventListener("add-project", ((e: CustomEvent) => {
	const mode = String(e.detail?.mode);
	if (mode === "empty") {
		// Prompt for name then create
		el.showNamePrompt = true;
		return;
	}
	el.gitModalMode = mode === "template" ? "template" : "submodule";
	el.showGitModal = true;
}) as EventListener);

el.addEventListener("import-setup", ((e: CustomEvent) => {
	const { url, name, mode } = e.detail as { url: string; name: string; mode: string };
	startBusy("Cloning repository...");
	void projectService.importFromGit(url, name, mode as "submodule" | "template", appendOutput)
		.then((r) => {
			if (!r.ok) { endBusy(r); return; }
			appendOutput("Detecting project...");
			return projectService.detectProject(name);
		})
		.then((detectResult) => {
			if (!detectResult) return;
			el.storybookBusy = false;
			el.storybookBusyLabel = "";
			// Push detection results to modal
			const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (modal) {
				modal.step = "detect";
				modal.detectedType = detectResult.type;
				modal.detectedFramework = detectResult.framework;
				modal.detectedPackageManager = detectResult.packageManager;
				modal.detectedTestFramework = detectResult.testFramework;
				modal.detectedHasConfig = detectResult.hasConfig;
				modal.detectedBuild = detectResult.buildCommand;
				modal.detectedTest = detectResult.testCommand;
				modal.detectedLint = detectResult.lintCommand;
			}
		});
}) as EventListener);

el.addEventListener("wizard-configure", ((e: CustomEvent) => {
	const { name, build, test, lint, storybook } = e.detail as Record<string, string>;
	startBusy("Writing config...");
	void projectService.bootstrapProject(name, { build, test, lint, storybook })
		.then((r) => {
			endBusy(r);
			const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (modal && r.ok) modal.step = "done";
		});
}) as EventListener);

el.addEventListener("wizard-open-project", ((e: CustomEvent) => {
	el.showGitModal = false;
	void loadProject(String(e.detail?.name));
}) as EventListener);

el.addEventListener("import-cancel", (() => {
	el.showGitModal = false;
}) as EventListener);
```

- [ ] **Step 3: Wire `createEmptyProject` for the "Create Empty" flow**

```typescript
el.addEventListener("create-empty-project", ((e: CustomEvent) => {
	const name = String(e.detail?.name);
	startBusy("Creating project...");
	void projectService.createEmptyProject(name)
		.then((r) => {
			endBusy(r);
			if (r.ok) void loadProjectList();
		});
}) as EventListener);
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts" "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts"
git commit -m "feat(plugin): wire git import modal events through project handlers"
```

---

### Task 9: UX Polish

**Files:**
- Modify: `src/components/projects/flowti-storybook-section.ts` — regenerate confirm, tooltips
- Modify: `src/components/projects/flowti-config-tab.ts` — tooltips
- Modify: `src/components/projects/flowti-project-detail.ts` — empty state improvement

- [ ] **Step 1: Add regenerate confirm UI to storybook section**

In `flowti-storybook-section.ts`, add property `showConfirm: { type: Boolean }` and replace the Regenerate button with a conditional:

```typescript
${this.showConfirm ? html`
	<span class="confirm-row">
		<span class="confirm-text">Delete and recreate?</span>
		<button class="action-btn action-btn--danger" @click="${() => { this.showConfirm = false; this.dispatchRegenerateConfirmed(); }}">Confirm</button>
		<button class="action-btn" @click="${() => { this.showConfirm = false; }}">Cancel</button>
	</span>
` : html`
	<button class="action-btn action-btn--danger" ?disabled="${this.busy}" @click="${() => { this.showConfirm = true; }}" title="Delete and recreate component library from sitemap">Regenerate</button>
`}
```

Add `dispatchRegenerateConfirmed()` method that dispatches `storybook-regenerate-confirmed`.

- [ ] **Step 2: Improve empty states in project list**

In `flowti-project-detail.ts`, add a `cliConnected` property (`{ type: Boolean }`, default `false`). The handler sets `el.cliConnected = true` after a successful `loadProjectList()` call.

Change the empty list rendering to distinguish two cases per spec:

```typescript
${filtered.length === 0
	? html`<div class="empty-list">
		${!this.cliConnected
			? html`<div class="empty-state"><span class="empty-pulse"></span><span>Waiting for Flowti CLI server...</span></div>`
			: this.projects.length === 0
				? html`<div class="empty-state"><span>No projects yet</span><flowti-add-project-dropdown></flowti-add-project-dropdown></div>`
				: html`<span>No matches</span>`
		}
	</div>`
	: html`<div class="project-list">${filtered.map((p) => this.renderProjectItem(p))}</div>`
}
```

Add CSS:
- `.empty-pulse` — subtle pulsing dot animation (`@keyframes pulse { 0%,100% { opacity:0.3 } 50% { opacity:1 } }`)
- `.empty-state` — centered flex column with spacing

- [ ] **Step 3: Add tooltips to all action buttons**

Verify all buttons in storybook section and config tab have `title` attributes. Add missing ones.

- [ ] **Step 4: Add keyboard support to modals**

In `flowti-git-import-modal.ts` and `flowti-scaffold-modal.ts`, add `@keydown` handler on the overlay:

```typescript
@keydown="${(e: KeyboardEvent) => { if (e.key === "Escape") this.dispatchDismiss(); }}"
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/"
git commit -m "feat(plugin): UX polish — regenerate confirm, empty states, tooltips, keyboard support"
```

---

### Task 10: Type Check + Full Test Run

- [ ] **Step 1: Type check CLI**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 2: Type check Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck`
Expected: Only pre-existing errors (game module, setState)

- [ ] **Step 3: Run CLI lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: No new errors (pre-existing warnings are acceptable)

- [ ] **Step 4: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass (no new failures)

- [ ] **Step 5: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All tests pass (no new failures)

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git commit -m "fix: address type check and test issues from project sidebar feature"
```
