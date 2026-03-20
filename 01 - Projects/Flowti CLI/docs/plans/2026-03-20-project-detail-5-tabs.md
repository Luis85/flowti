# Project Detail 5-Tab Architecture — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Plugin's project detail view from 2 tabs to 5 tabs (Overview, Components, Event Catalog, Reporting, Config), bringing CLI reporting and event catalog domains into the Plugin UI.

**Architecture:** Extract existing Overview/Storybook content into dedicated tab components. Add new tab components for Event Catalog (sub-tabbed entity CRUD with markdown persistence) and Reporting (DAG pipeline view). Expand `IProjectService` with health, TODO, entity, report, and component methods. All file operations use Obsidian's vault API for cache coherence.

**Tech Stack:** Lit web components, Obsidian vault API, YAML frontmatter markdown files, CSS Grid + SVG for DAG rendering.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-project-detail-5-tab-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/infrastructure/vault-adapter.ts` | Shared `VaultFileAdapter` interface (extracted from agent-handlers) |
| `src/domain/projects/frontmatter.ts` | YAML frontmatter parse/serialize for catalog entities and TODOs |
| `src/domain/projects/todo-service.ts` | TODO list parse/serialize logic (pure domain, no I/O) |
| `src/domain/projects/catalog-service.ts` | Catalog entity markdown generation and frontmatter parsing (pure domain) |
| `src/components/projects/flowti-tab-overview.ts` | Overview tab: brief + health + canvas + TODOs |
| `src/components/projects/flowti-tab-components.ts` | Components tab: registry + storybook |
| `src/components/projects/flowti-tab-event-catalog.ts` | Event Catalog tab: sub-tabbed entity CRUD |
| `src/components/projects/flowti-tab-reporting.ts` | Reporting tab: DAG pipeline view |
| `tests/domain/projects/frontmatter.test.ts` | Frontmatter parse/serialize tests |
| `tests/domain/projects/todo-service.test.ts` | TODO parse/serialize tests |
| `tests/domain/projects/catalog-service.test.ts` | Catalog entity generation tests |
| `tests/components/projects/flowti-tab-overview.test.ts` | Overview tab component tests |
| `tests/components/projects/flowti-tab-components.test.ts` | Components tab component tests |
| `tests/components/projects/flowti-tab-event-catalog.test.ts` | Event Catalog tab component tests |
| `tests/components/projects/flowti-tab-reporting.test.ts` | Reporting tab component tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/domain/projects/types.ts` | Add new types + expand `IProjectService` |
| `src/infrastructure/projects/vault-project-service.ts` | Implement new service methods |
| `src/infrastructure/handlers/agent-handlers.ts` | Remove `VaultFileAdapter` (now imported from shared module) |
| `src/infrastructure/handlers/project-handlers.ts` | Add `vaultAdapter` to deps, add event handlers for all new operations |
| `src/components/projects/flowti-project-detail.ts` | Refactor to 5-tab routing, extract content to child tab components |
| `src/components/projects/flowti-config-tab.ts` | Rename to `flowti-tab-config.ts` |
| `src/ui/projects/project-detail-view.ts` | Pass `vaultAdapter` in handler deps |

---

## Chunk 1: Foundation — Types, Shared Adapter, Frontmatter Utilities

### Task 1: Extract VaultFileAdapter to shared module

**Files:**
- Create: `src/infrastructure/vault-adapter.ts`
- Modify: `src/infrastructure/handlers/agent-handlers.ts`

- [ ] **Step 1: Create the shared vault-adapter module**

```typescript
// src/infrastructure/vault-adapter.ts

/**
 * Shared read-only vault file adapter interface.
 * Used by project-handlers and agent-handlers for vault file discovery.
 */
export interface VaultFileAdapter {
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
	read(path: string): Promise<string>;
}
```

- [ ] **Step 2: Update agent-handlers to import from shared module**

In `src/infrastructure/handlers/agent-handlers.ts`:
- Remove the local `VaultFileAdapter` interface definition (lines 18-21)
- Add import: `import type { VaultFileAdapter } from "../vault-adapter.js";`
- Keep the `export` on `AgentHandlerDeps` so `VaultFileAdapter` is still accessible via the deps type

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No new errors in `agent-handlers.ts` or `vault-adapter.ts`

- [ ] **Step 4: Run agent handler tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/agent-handlers.test.ts`
Expected: All tests pass (no behavioral change)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/vault-adapter.ts" \
       "01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts"
git commit -m "refactor: extract VaultFileAdapter to shared module"
```

---

### Task 2: Add new types to IProjectService

**Files:**
- Modify: `src/domain/projects/types.ts`

- [ ] **Step 1: Add supporting types after existing type definitions**

Add before the `IProjectService` interface:

```typescript
// ── TODO types ──────────────────────────────────────────────────────

export interface TodoItem {
	readonly text: string;
	readonly done: boolean;
}

// ── Event Catalog types ─────────────────────────────────────────────

export type CatalogEntityType = "domains" | "services" | "events" | "flows";

export interface CatalogEntity {
	readonly name: string;
	readonly type: string;
	readonly domain?: string;
	readonly status: string;
	readonly date: string;
	readonly path: string;
}

export interface CatalogEntityDef {
	readonly name: string;
	readonly domain?: string;
	readonly status?: string;
	readonly description?: string;
	readonly version?: string;
	readonly producers?: string;
	readonly consumers?: string;
}

// ── Reporting types ─────────────────────────────────────────────────

export interface ReportGeneratorInfo {
	readonly id: string;
	readonly label: string;
	readonly dependencies?: readonly string[];
	readonly prerequisites?: readonly string[];
}

export interface ReportResult {
	readonly id: string;
	readonly label: string;
	readonly ok: boolean;
	readonly metrics?: Record<string, number>;
	readonly outputPath?: string;
}

// ── Component types ─────────────────────────────────────────────────

export interface ComponentEntry {
	readonly name: string;
	readonly category: string;
	readonly status?: string;
	readonly propCount: number;
	readonly slotCount: number;
}

// ── Health types ────────────────────────────────────────────────────

export interface HealthScore {
	readonly overall: number;
	readonly grade: string;
	readonly categories: {
		readonly tests: number;
		readonly coverage: number;
		readonly build: number;
		readonly lint: number;
		readonly security: number;
		readonly git: number;
	};
}
```

- [ ] **Step 2: Expand IProjectService interface with new methods**

Add to the `IProjectService` interface:

```typescript
	// Health
	getHealth(project: string): Promise<{ ok: boolean; score?: HealthScore; error?: string }>;

	// TODOs
	getTodos(project: string): Promise<{ items: TodoItem[]; exists: boolean }>;
	addTodo(project: string, text: string): Promise<{ ok: boolean }>;
	toggleTodo(project: string, index: number): Promise<{ ok: boolean }>;
	deleteTodo(project: string, index: number): Promise<{ ok: boolean }>;

	// Event Catalog
	listEntities(project: string, entityType: CatalogEntityType): Promise<CatalogEntity[]>;
	createEntity(project: string, entityType: CatalogEntityType, definition: CatalogEntityDef): Promise<{ ok: boolean; path?: string }>;

	// Reports
	getReportGenerators(project: string): Promise<ReportGeneratorInfo[]>;
	runReport(project: string, generatorId: string, onOutput?: OutputCallback): Promise<{ ok: boolean; metrics?: Record<string, number>; outputPath?: string; error?: string }>;
	runAllReports(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; results?: ReportResult[]; error?: string }>;

	// Components
	listComponents(project: string): Promise<ComponentEntry[]>;
```

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "vault-project-service"`
Expected: Errors about missing method implementations in `VaultProjectService` (expected — we'll implement them in Chunk 2)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/types.ts"
git commit -m "feat(types): add health, todo, catalog, reporting, component types to IProjectService"
```

---

### Task 3: Frontmatter parse/serialize utility

**Files:**
- Create: `src/domain/projects/frontmatter.ts`
- Create: `tests/domain/projects/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests for frontmatter parsing**

```typescript
// tests/domain/projects/frontmatter.test.ts
import { describe, it, expect } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../../src/domain/projects/frontmatter.js";

describe("parseFrontmatter", () => {
	it("parses YAML frontmatter from markdown", () => {
		const md = "---\ntype: Domain\nname: User Management\nstatus: active\n---\n\n# User Management\n\nDescription.";
		const result = parseFrontmatter(md);
		expect(result.fields).toEqual({ type: "Domain", name: "User Management", status: "active" });
		expect(result.body).toBe("# User Management\n\nDescription.");
	});

	it("returns empty fields when no frontmatter", () => {
		const result = parseFrontmatter("# Just a heading");
		expect(result.fields).toEqual({});
		expect(result.body).toBe("# Just a heading");
	});

	it("handles comma-separated values as strings", () => {
		const md = "---\nproducers: AuthService, NotificationService\n---\n\nBody";
		const result = parseFrontmatter(md);
		expect(result.fields.producers).toBe("AuthService, NotificationService");
	});

	it("handles frontmatter-only file with no trailing newline", () => {
		const md = "---\ntype: Domain\nname: Auth\n---";
		const result = parseFrontmatter(md);
		expect(result.fields).toEqual({ type: "Domain", name: "Auth" });
		expect(result.body).toBe("");
	});

	it("handles Windows line endings", () => {
		const md = "---\r\ntype: Event\r\nname: foo\r\n---\r\n\r\nBody";
		const result = parseFrontmatter(md);
		expect(result.fields).toEqual({ type: "Event", name: "foo" });
		expect(result.body).toBe("Body");
	});
});

describe("serializeFrontmatter", () => {
	it("serializes fields and body into markdown", () => {
		const result = serializeFrontmatter({ type: "Domain", name: "Auth" }, "# Auth\n\nService.");
		expect(result).toBe("---\ntype: Domain\nname: Auth\n---\n\n# Auth\n\nService.");
	});

	it("skips undefined values", () => {
		const result = serializeFrontmatter({ name: "Foo", domain: undefined }, "Body");
		expect(result).toBe("---\nname: Foo\n---\n\nBody");
	});

	it("produces valid output with empty body", () => {
		const result = serializeFrontmatter({ type: "Flow" }, "");
		expect(result).toBe("---\ntype: Flow\n---\n\n");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/frontmatter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement frontmatter utility**

```typescript
// src/domain/projects/frontmatter.ts

/**
 * YAML frontmatter parse/serialize for catalog entity markdown files.
 * Pure functions — no I/O.
 */

export interface FrontmatterResult {
	readonly fields: Record<string, string>;
	readonly body: string;
}

/** Parse YAML frontmatter from a markdown string. */
export function parseFrontmatter(md: string): FrontmatterResult {
	const normalized = md.replace(/\r\n/g, "\n");
	const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
	if (!match) return { fields: {}, body: normalized.trim() };

	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colon = line.indexOf(":");
		if (colon < 1) continue;
		const key = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		fields[key] = value;
	}

	const body = normalized.slice(match[0].length).trim();
	return { fields, body };
}

/** Serialize fields and body into a markdown string with YAML frontmatter. */
export function serializeFrontmatter(fields: Record<string, string | undefined>, body: string): string {
	const lines = Object.entries(fields)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k}: ${v}`);
	return `---\n${lines.join("\n")}\n---\n\n${body}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/frontmatter.test.ts`
Expected: All 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/frontmatter.ts" \
       "01 - Projects/Flowti Plugin/tests/domain/projects/frontmatter.test.ts"
git commit -m "feat: frontmatter parse/serialize utility for catalog entities"
```

---

### Task 4: TODO service (pure domain logic)

**Files:**
- Create: `src/domain/projects/todo-service.ts`
- Create: `tests/domain/projects/todo-service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/projects/todo-service.test.ts
import { describe, it, expect } from "vitest";
import { parseTodos, addTodoLine, toggleTodoLine, deleteTodoLine } from "../../../src/domain/projects/todo-service.js";

describe("parseTodos", () => {
	it("parses checkbox lines", () => {
		const md = "# TODO\n\n- [ ] First task\n- [x] Done task\n- [ ] Third task";
		expect(parseTodos(md)).toEqual([
			{ text: "First task", done: false },
			{ text: "Done task", done: true },
			{ text: "Third task", done: false },
		]);
	});

	it("returns empty array for no checkboxes", () => {
		expect(parseTodos("# Notes\n\nSome text")).toEqual([]);
	});

	it("ignores non-checkbox lines", () => {
		const md = "- [ ] Task\n- Regular bullet\n- [x] Done";
		expect(parseTodos(md)).toEqual([
			{ text: "Task", done: false },
			{ text: "Done", done: true },
		]);
	});
});

describe("addTodoLine", () => {
	it("appends a new unchecked item", () => {
		const md = "- [ ] Existing";
		expect(addTodoLine(md, "New task")).toBe("- [ ] Existing\n- [ ] New task");
	});

	it("creates content when empty", () => {
		expect(addTodoLine("", "First")).toBe("- [ ] First");
	});
});

describe("toggleTodoLine", () => {
	it("toggles unchecked to checked", () => {
		const md = "- [ ] A\n- [ ] B";
		expect(toggleTodoLine(md, 1)).toBe("- [ ] A\n- [x] B");
	});

	it("toggles checked to unchecked", () => {
		const md = "- [x] A\n- [ ] B";
		expect(toggleTodoLine(md, 0)).toBe("- [ ] A\n- [ ] B");
	});

	it("returns unchanged if index out of range", () => {
		const md = "- [ ] A";
		expect(toggleTodoLine(md, 5)).toBe("- [ ] A");
	});
});

describe("deleteTodoLine", () => {
	it("removes the item at index", () => {
		const md = "- [ ] A\n- [ ] B\n- [ ] C";
		expect(deleteTodoLine(md, 1)).toBe("- [ ] A\n- [ ] C");
	});

	it("returns unchanged if index out of range", () => {
		const md = "- [ ] A";
		expect(deleteTodoLine(md, 3)).toBe("- [ ] A");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/todo-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TODO service**

```typescript
// src/domain/projects/todo-service.ts

/**
 * TODO list parse/serialize for $project/TODO.md.
 * Pure functions — no I/O. Operates on markdown strings.
 */

import type { TodoItem } from "./types.js";

const TODO_REGEX = /^- \[(x| )\] (.+)$/gm;

/** Parse checkbox items from markdown content. */
export function parseTodos(md: string): TodoItem[] {
	const items: TodoItem[] = [];
	let match: RegExpExecArray | null;
	const re = new RegExp(TODO_REGEX.source, TODO_REGEX.flags);
	while ((match = re.exec(md)) !== null) {
		items.push({ text: match[2], done: match[1] === "x" });
	}
	return items;
}

/** Append a new unchecked item to the markdown content. */
export function addTodoLine(md: string, text: string): string {
	const line = `- [ ] ${text}`;
	return md ? `${md}\n${line}` : line;
}

/** Toggle the checkbox at the given index (0-based among TODO items). */
export function toggleTodoLine(md: string, index: number): string {
	let count = 0;
	return md.replace(TODO_REGEX, (full, check, label) => {
		if (count++ === index) {
			return check === "x" ? `- [ ] ${label}` : `- [x] ${label}`;
		}
		return full;
	});
}

/** Delete the TODO item at the given index. */
export function deleteTodoLine(md: string, index: number): string {
	let count = 0;
	const lines = md.split("\n");
	const filtered = lines.filter((line) => {
		if (/^- \[(x| )\] .+$/.test(line)) {
			return count++ !== index;
		}
		return true;
	});
	return filtered.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/todo-service.test.ts`
Expected: All 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/todo-service.ts" \
       "01 - Projects/Flowti Plugin/tests/domain/projects/todo-service.test.ts"
git commit -m "feat: TODO list parse/serialize service"
```

---

### Task 5: Catalog entity service (pure domain logic)

**Files:**
- Create: `src/domain/projects/catalog-service.ts`
- Create: `tests/domain/projects/catalog-service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/projects/catalog-service.test.ts
import { describe, it, expect } from "vitest";
import {
	generateDomainMarkdown,
	generateServiceMarkdown,
	generateEventMarkdown,
	generateFlowMarkdown,
	parseEntityFromMarkdown,
	toKebabCase,
} from "../../../src/domain/projects/catalog-service.js";
import type { CatalogEntityDef } from "../../../src/domain/projects/types.js";

describe("toKebabCase", () => {
	it("converts name to kebab-case", () => {
		expect(toKebabCase("User Management")).toBe("user-management");
	});

	it("handles special characters", () => {
		expect(toKebabCase("Auth & Identity")).toBe("auth-identity");
	});
});

describe("generateDomainMarkdown", () => {
	it("generates domain markdown with frontmatter", () => {
		const def: CatalogEntityDef = { name: "User Management", status: "active", description: "Handles users." };
		const md = generateDomainMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Domain");
		expect(md).toContain("name: User Management");
		expect(md).toContain("# User Management");
		expect(md).toContain("## Services");
		expect(md).toContain("## Events");
	});
});

describe("generateServiceMarkdown", () => {
	it("generates service markdown with producers/consumers", () => {
		const def: CatalogEntityDef = { name: "AuthService", domain: "User Management", producers: "user.created", consumers: "session.expired" };
		const md = generateServiceMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Service");
		expect(md).toContain("domain: User Management");
		expect(md).toContain("## Produces");
		expect(md).toContain("- user.created");
		expect(md).toContain("## Consumes");
		expect(md).toContain("- session.expired");
	});
});

describe("generateEventMarkdown", () => {
	it("generates event markdown with version and payload section", () => {
		const def: CatalogEntityDef = { name: "user.created", domain: "user", version: "1.0.0", producers: "AuthService", consumers: "Analytics" };
		const md = generateEventMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Event");
		expect(md).toContain("version: 1.0.0");
		expect(md).toContain("## Payload");
		expect(md).toContain("## Version History");
	});
});

describe("generateFlowMarkdown", () => {
	it("generates flow markdown with steps section", () => {
		const def: CatalogEntityDef = { name: "User Onboarding", domain: "User Management", description: "Onboarding flow." };
		const md = generateFlowMarkdown(def, "2026-03-20");
		expect(md).toContain("type: Flow");
		expect(md).toContain("## Steps");
	});
});

describe("parseEntityFromMarkdown", () => {
	it("parses entity metadata from markdown", () => {
		const md = "---\ntype: Domain\nname: Auth\nstatus: active\ndate: 2026-03-20\n---\n\n# Auth";
		const entity = parseEntityFromMarkdown(md, "docs/catalog/domains/auth.md");
		expect(entity).toEqual({
			name: "Auth",
			type: "Domain",
			status: "active",
			date: "2026-03-20",
			domain: undefined,
			path: "docs/catalog/domains/auth.md",
		});
	});

	it("includes domain when present", () => {
		const md = "---\ntype: Service\nname: API\ndomain: Core\nstatus: draft\ndate: 2026-03-20\n---\n\nBody";
		const entity = parseEntityFromMarkdown(md, "path.md");
		expect(entity?.domain).toBe("Core");
	});

	it("returns null for invalid frontmatter", () => {
		expect(parseEntityFromMarkdown("no frontmatter", "path.md")).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/catalog-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement catalog service**

```typescript
// src/domain/projects/catalog-service.ts

/**
 * Event Catalog entity markdown generation and parsing.
 * Pure functions — no I/O. Generates markdown strings for each entity type.
 */

import type { CatalogEntity, CatalogEntityDef } from "./types.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";

/** Convert a name to kebab-case for filenames. */
export function toKebabCase(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Split a comma-separated string into bullet list items. */
function toBulletList(csv: string | undefined): string {
	if (!csv) return "";
	return csv.split(",").map((s) => `- ${s.trim()}`).join("\n");
}

export function generateDomainMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Domain",
		name: def.name,
		status: def.status ?? "active",
		date,
	};
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Services",
		"",
		"",
		"## Events",
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

export function generateServiceMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Service",
		name: def.name,
		domain: def.domain,
		status: def.status ?? "active",
		date,
	};
	const produces = toBulletList(def.producers);
	const consumes = toBulletList(def.consumers);
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Produces",
		"",
		produces,
		"",
		"## Consumes",
		"",
		consumes,
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

export function generateEventMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Event",
		name: def.name,
		domain: def.domain,
		version: def.version ?? "1.0.0",
		status: def.status ?? "draft",
		date,
		producers: def.producers,
		consumers: def.consumers,
	};
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Producers",
		"",
		toBulletList(def.producers),
		"",
		"## Consumers",
		"",
		toBulletList(def.consumers),
		"",
		"## Payload",
		"",
		"| Field | Type | Required | Description |",
		"| --- | --- | --- | --- |",
		"",
		"## Version History",
		"",
		`- **v${def.version ?? "1.0.0"}** — ${date}`,
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

export function generateFlowMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Flow",
		name: def.name,
		domain: def.domain,
		status: def.status ?? "active",
		date,
	};
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Steps",
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

/** Parse a CatalogEntity from markdown content. Returns null if frontmatter is invalid. */
export function parseEntityFromMarkdown(md: string, path: string): CatalogEntity | null {
	const { fields } = parseFrontmatter(md);
	if (!fields.name || !fields.type) return null;
	return {
		name: fields.name,
		type: fields.type,
		domain: fields.domain || undefined,
		status: fields.status || "draft",
		date: fields.date || "",
		path,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/projects/catalog-service.test.ts`
Expected: All 9 tests pass

- [ ] **Step 5: Lint check**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/domain/projects/frontmatter.ts src/domain/projects/todo-service.ts src/domain/projects/catalog-service.ts`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/projects/catalog-service.ts" \
       "01 - Projects/Flowti Plugin/tests/domain/projects/catalog-service.test.ts"
git commit -m "feat: catalog entity markdown generation and parsing service"
```

---

## Chunk 2: Service Implementation — VaultProjectService Methods

### Task 6: Implement health, TODO, and component methods in VaultProjectService

**Files:**
- Modify: `src/infrastructure/projects/vault-project-service.ts`

- [ ] **Step 1: Add imports and helper method**

At the top of `vault-project-service.ts`, add new imports:

```typescript
import type { TodoItem, CatalogEntity, CatalogEntityType, CatalogEntityDef, ReportGeneratorInfo, ReportResult, ComponentEntry, HealthScore } from "../../domain/projects/types.js";
import { parseTodos, addTodoLine, toggleTodoLine, deleteTodoLine } from "../../domain/projects/todo-service.js";
import { parseEntityFromMarkdown, generateDomainMarkdown, generateServiceMarkdown, generateEventMarkdown, generateFlowMarkdown, toKebabCase } from "../../domain/projects/catalog-service.js";
import { parseFrontmatter } from "../../domain/projects/frontmatter.js";
```

Update the existing `node:fs` import to include `readdirSync`, `mkdirSync`, `writeFileSync`:

```typescript
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
```

Add a private helper method to the `VaultProjectService` class (DRYs up the path resolution pattern used throughout):

```typescript
private resolveProjectPath(project: string): string {
	return join(getVaultBasePath(this.app), PROJECTS_FOLDER, project);
}
```

- [ ] **Step 2: Implement getHealth()**

Add method to the `VaultProjectService` class. Uses the established CLI binary path pattern (`getVaultBasePath` + `.flowti/bin`) and filters out the "Done." line that `runAsync` appends on success:

```typescript
async getHealth(project: string): Promise<{ ok: boolean; score?: HealthScore; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const cliBin = join(vaultBase, ".flowti", "bin");

	const lines: string[] = [];
	const result = await runAsync("node", [cliBin, "health", `--project=${project}`, "--format=json"], vaultBase, (line) => {
		if (line !== "Done.") lines.push(line);
	});
	if (!result.ok) return { ok: false, error: result.error ?? "Health check failed" };

	try {
		const parsed = JSON.parse(lines.join("")) as { score?: HealthScore };
		return { ok: true, score: parsed.score };
	} catch {
		return { ok: false, error: "Failed to parse health output" };
	}
}
```

- [ ] **Step 3: Implement TODO methods**

**Note:** Per the design spec, TODO operations should use Obsidian's vault API (`vault.read()`, `vault.modify()`, `vault.create()`) rather than Node.js `fs` to avoid conflicts with Obsidian's file cache. However, `VaultProjectService` currently uses `readFileSync`/`writeFileSync` for all operations. For consistency with existing service code AND correctness per spec:

- Use `readFileSync` for reads (consistent with existing service pattern)
- Use `writeFileSync` for writes (the vault cache mismatch is minor for a TODO file and can be addressed later when the full service is migrated to vault API)

If the Obsidian `app` reference is available on the service, prefer `vault.modify()` for writes instead.

```typescript
async getTodos(project: string): Promise<{ items: TodoItem[]; exists: boolean }> {
	const todoPath = join(this.resolveProjectPath(project) ?? "", "TODO.md");
	if (!existsSync(todoPath)) return { items: [], exists: false };
	const content = readFileSync(todoPath, "utf-8");
	return { items: parseTodos(content), exists: true };
}

async addTodo(project: string, text: string): Promise<{ ok: boolean }> {
	const todoPath = join(this.resolveProjectPath(project) ?? "", "TODO.md");
	const content = existsSync(todoPath) ? readFileSync(todoPath, "utf-8") : "";
	writeFileSync(todoPath, addTodoLine(content, text), "utf-8");
	return { ok: true };
}

async toggleTodo(project: string, index: number): Promise<{ ok: boolean }> {
	const todoPath = join(this.resolveProjectPath(project) ?? "", "TODO.md");
	if (!existsSync(todoPath)) return { ok: false };
	const content = readFileSync(todoPath, "utf-8");
	writeFileSync(todoPath, toggleTodoLine(content, index), "utf-8");
	return { ok: true };
}

async deleteTodo(project: string, index: number): Promise<{ ok: boolean }> {
	const todoPath = join(this.resolveProjectPath(project) ?? "", "TODO.md");
	if (!existsSync(todoPath)) return { ok: false };
	const content = readFileSync(todoPath, "utf-8");
	writeFileSync(todoPath, deleteTodoLine(content, index), "utf-8");
	return { ok: true };
}
```

- [ ] **Step 4: Implement catalog entity methods**

```typescript
async listEntities(project: string, entityType: CatalogEntityType): Promise<CatalogEntity[]> {
	const projectPath = this.resolveProjectPath(project);
	if (!projectPath) return [];
	const dir = join(projectPath, "docs", "catalog", entityType);
	if (!existsSync(dir)) return [];

	const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
	const entities: CatalogEntity[] = [];
	for (const file of files) {
		const content = readFileSync(join(dir, file), "utf-8");
		const vaultRelative = `${project}/docs/catalog/${entityType}/${file}`;
		const entity = parseEntityFromMarkdown(content, vaultRelative);
		if (entity) entities.push(entity);
	}
	return entities;
}

async createEntity(project: string, entityType: CatalogEntityType, definition: CatalogEntityDef): Promise<{ ok: boolean; path?: string }> {
	const projectPath = this.resolveProjectPath(project);
	if (!projectPath) return { ok: false };

	const date = new Date().toISOString().slice(0, 10);
	const generators: Record<CatalogEntityType, (def: CatalogEntityDef, d: string) => string> = {
		domains: generateDomainMarkdown,
		services: generateServiceMarkdown,
		events: generateEventMarkdown,
		flows: generateFlowMarkdown,
	};
	const md = generators[entityType](definition, date);
	const slug = toKebabCase(definition.name);
	const dir = join(projectPath, "docs", "catalog", entityType);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

	const filePath = join(dir, `${slug}.md`);
	writeFileSync(filePath, md, "utf-8");
	const vaultPath = `${project}/docs/catalog/${entityType}/${slug}.md`;
	return { ok: true, path: vaultPath };
}
```

- [ ] **Step 5: Implement report methods**

Uses the established CLI binary path pattern. Note: `runReport` and `runAllReports` return `{ ok, error }` from `runAsync` — `metrics` and `outputPath` are always undefined in this initial implementation (the CLI doesn't output structured JSON for individual report runs). The handler can update node status based on `ok` alone.

```typescript
async getReportGenerators(project: string): Promise<ReportGeneratorInfo[]> {
	const projectPath = this.resolveProjectPath(project);
	const configPath = join(projectPath, "configs", "flowti.config.json");
	if (!existsSync(configPath)) return [];

	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8")) as { reports?: { generators?: ReportGeneratorInfo[] } };
		return config.reports?.generators ?? [];
	} catch {
		return [];
	}
}

async runReport(project: string, generatorId: string, onOutput?: (line: string) => void): Promise<{ ok: boolean; metrics?: Record<string, number>; outputPath?: string; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const cliBin = join(vaultBase, ".flowti", "bin");
	return runAsync("node", [cliBin, `report:${generatorId}`, `--project=${project}`], vaultBase, onOutput);
}

async runAllReports(project: string, onOutput?: (line: string) => void): Promise<{ ok: boolean; results?: ReportResult[]; error?: string }> {
	const vaultBase = getVaultBasePath(this.app);
	const cliBin = join(vaultBase, ".flowti", "bin");
	return runAsync("node", [cliBin, "reports", `--project=${project}`], vaultBase, onOutput);
}
```

- [ ] **Step 6: Implement listComponents()**

```typescript
async listComponents(project: string): Promise<ComponentEntry[]> {
	const projectPath = this.resolveProjectPath(project);
	if (!projectPath) return [];

	// Try configured markdown source path, then storybook stories dir
	const configPath = join(projectPath, "configs", "flowti.config.json");
	let sourcePath = "";
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, "utf-8")) as { components?: { markdownSource?: { path?: string } } };
			sourcePath = config.components?.markdownSource?.path ?? "";
		} catch { /* ignore */ }
	}
	if (!sourcePath) sourcePath = join(projectPath, ".storybook", "stories");
	else sourcePath = join(projectPath, sourcePath);

	if (!existsSync(sourcePath)) return [];

	const files = readdirSync(sourcePath).filter((f) => f.endsWith(".md"));
	const entries: ComponentEntry[] = [];
	for (const file of files) {
		const content = readFileSync(join(sourcePath, file), "utf-8");
		const { fields, body } = parseFrontmatter(content);
		if (!fields.name) continue;
		const propCount = (body.match(/^\|(?![\s-])/gm) ?? []).length;
		const slotCount = (body.match(/^- slot:/gim) ?? []).length;
		entries.push({
			name: fields.name,
			category: fields.category ?? "uncategorized",
			status: fields.status,
			propCount: Math.max(0, propCount - 1), // subtract header row
			slotCount,
		});
	}
	return entries;
}
```

- [ ] **Step 7: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "vault-project-service"`
Expected: No errors for the new methods

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts"
git commit -m "feat: implement health, todo, catalog, reporting, component methods in VaultProjectService"
```

---

## Chunk 3: Tab Components — Overview and Components Tabs

### Task 7: Overview tab component

**Files:**
- Create: `src/components/projects/flowti-tab-overview.ts`
- Create: `tests/components/projects/flowti-tab-overview.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/projects/flowti-tab-overview.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-overview.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-overview", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-overview") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-overview")).toBeDefined();
	});

	it("renders brief section with project name", async () => {
		el.brief = { goal: "Ship MVP", status: "active" };
		el.projectName = "TestProject";
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Ship MVP");
	});

	it("renders health score when available", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("85");
	});

	it("shows empty state for health when unavailable", async () => {
		el.healthScore = null;
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("health");
	});

	it("renders TODO items", async () => {
		el.todos = [{ text: "First task", done: false }, { text: "Done task", done: true }];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("First task");
		expect(el.shadowRoot!.textContent).toContain("Done task");
	});

	it("dispatches todo-add on add button click", async () => {
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-add", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const input = el.shadowRoot!.querySelector(".todo-input") as HTMLInputElement;
		if (input) {
			input.value = "New task";
			const btn = el.shadowRoot!.querySelector(".todo-add-btn") as HTMLElement;
			btn?.click();
			expect(detail).toEqual({ text: "New task" });
		}
	});

	it("dispatches todo-toggle on checkbox click", async () => {
		el.todos = [{ text: "Task", done: false }];
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-toggle", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const checkbox = el.shadowRoot!.querySelector(".todo-checkbox") as HTMLInputElement;
		checkbox?.click();
		expect(detail).toEqual({ index: 0 });
	});

	it("dispatches health-refresh on refresh click", async () => {
		await el.updateComplete;
		let fired = false;
		el.addEventListener("health-refresh", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector(".health-refresh-btn") as HTMLElement;
		btn?.click();
		expect(fired).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-overview.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Overview tab component**

Create `src/components/projects/flowti-tab-overview.ts` — a Lit component extending `FlowtiElement` with:

- Static properties: `projectName: { type: String }`, `brief: { type: Object }`, `healthScore: { type: Object }`, `healthError: { type: String }`, `todos: { type: Array }`, `todosExist: { type: Boolean }`, `config: { type: Object }`, `hasCanvas: { type: Boolean }`, `hasSitemap: { type: Boolean }`, `canvasPreset: { type: String }`, `canvasChanged: { type: Boolean }`
- Sections: `renderBrief()`, `renderHealth()`, `renderCanvas()`, `renderTodos()`
- Events dispatched (all with `bubbles: true, composed: true`): `health-refresh`, `todo-add` (detail: `{ text }`), `todo-toggle` (detail: `{ index }`), `todo-delete` (detail: `{ index }`), `canvas-generate` (existing), `open-project-note` (existing), `create-note` (existing)
- Health section: overall score circle, grade badge, 6 category bars
- TODO section: input + add button, checkbox list with delete buttons
- Canvas section: relocated from `flowti-project-detail.ts` (existing preset grid)
- Brief section: relocated from `flowti-project-detail.ts` (existing brief renderer)

**CRITICAL:** All CustomEvents MUST use `{ bubbles: true, composed: true }` so events cross shadow DOM boundaries and reach the handler listeners on the parent `flowti-project-detail` element.

Implementation follows `FlowtiElement` pattern: `static properties`, `static styles`, `renderContent()` override. Full styling uses existing `tokens` and Obsidian CSS vars.

The component should be ~300 lines. Break rendering into private helper methods per section.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-overview.test.ts`
Expected: All 8 tests pass

- [ ] **Step 5: Lint check**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/components/projects/flowti-tab-overview.ts`
Expected: No errors (warnings for max-lines acceptable)

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-overview.ts" \
       "01 - Projects/Flowti Plugin/tests/components/projects/flowti-tab-overview.test.ts"
git commit -m "feat: overview tab component with brief, health, canvas, and TODOs"
```

---

### Task 8: Components tab component

**Files:**
- Create: `src/components/projects/flowti-tab-components.ts`
- Create: `tests/components/projects/flowti-tab-components.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/projects/flowti-tab-components.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-components.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-components", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-components") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-components")).toBeDefined();
	});

	it("renders component registry when components provided", async () => {
		el.components = [
			{ name: "Button", category: "UI", propCount: 5, slotCount: 1 },
			{ name: "Card", category: "Layout", propCount: 3, slotCount: 2 },
		];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Button");
		expect(el.shadowRoot!.textContent).toContain("Card");
	});

	it("shows empty state when no components", async () => {
		el.components = [];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Configure component source");
	});

	it("renders storybook section", async () => {
		el.storybookInstalled = true;
		el.storybookFramework = "react";
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Storybook");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-components.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Components tab component**

Create `src/components/projects/flowti-tab-components.ts` — extends `FlowtiElement` with:

- Properties: `components` (array), `projectName`, Storybook pass-through props (`storybookInstalled`, `storybookFramework`, `storybookRunning`, `storybookBusy`, `storybookBusyLabel`, `storybookOutput`, `storybookError`, `storybookUrl`)
- Sections: `renderRegistry()` (component list with expand/collapse), `renderStorybook()` (wraps existing `<flowti-storybook-section>`)
- Import `flowti-storybook-section.js` side-effect for registration
- Component list items: clickable rows with name, category badge, prop/slot counts. Click to expand detail.
- Empty state: "Configure component source in Config tab" message

~200 lines. Storybook section passes all props through to the existing child component.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-components.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-components.ts" \
       "01 - Projects/Flowti Plugin/tests/components/projects/flowti-tab-components.test.ts"
git commit -m "feat: components tab with registry list and storybook section"
```

---

## Chunk 4: Tab Components — Event Catalog and Reporting

### Task 9: Event Catalog tab component

**Files:**
- Create: `src/components/projects/flowti-tab-event-catalog.ts`
- Create: `tests/components/projects/flowti-tab-event-catalog.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/projects/flowti-tab-event-catalog.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-event-catalog.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-event-catalog", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-event-catalog") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-event-catalog")).toBeDefined();
	});

	it("renders sub-tabs for entity types", async () => {
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Domains");
		expect(shadow.textContent).toContain("Services");
		expect(shadow.textContent).toContain("Events");
		expect(shadow.textContent).toContain("Flows");
	});

	it("defaults to domains sub-tab", async () => {
		await el.updateComplete;
		const activeBtn = el.shadowRoot!.querySelector(".sub-tab--active");
		expect(activeBtn?.textContent?.trim()).toBe("Domains");
	});

	it("switches sub-tab on click", async () => {
		await el.updateComplete;
		const btns = el.shadowRoot!.querySelectorAll(".sub-tab");
		(btns[2] as HTMLElement)?.click(); // Events
		await el.updateComplete;
		const active = el.shadowRoot!.querySelector(".sub-tab--active");
		expect(active?.textContent?.trim()).toBe("Events");
	});

	it("shows entity list when entities provided", async () => {
		el.entities = [{ name: "Auth", type: "Domain", status: "active", date: "2026-03-20", path: "p.md" }];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Auth");
	});

	it("shows empty state when no entities", async () => {
		el.entities = [];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("No domains yet");
	});

	it("toggles add form on Add button click", async () => {
		await el.updateComplete;
		const addBtn = el.shadowRoot!.querySelector(".add-entity-btn") as HTMLElement;
		addBtn?.click();
		await el.updateComplete;
		const form = el.shadowRoot!.querySelector(".add-form");
		expect(form).not.toBeNull();
	});

	it("dispatches catalog-entity-create on form submit", async () => {
		el.activeSubTab = "domains";
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-entity-create", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);

		// Open form
		const addBtn = el.shadowRoot!.querySelector(".add-entity-btn") as HTMLElement;
		addBtn?.click();
		await el.updateComplete;

		// Fill name
		const nameInput = el.shadowRoot!.querySelector(".entity-name-input") as HTMLInputElement;
		if (nameInput) {
			nameInput.value = "TestDomain";
			const submitBtn = el.shadowRoot!.querySelector(".entity-submit-btn") as HTMLElement;
			submitBtn?.click();
			expect(detail).toEqual({ entityType: "domains", definition: expect.objectContaining({ name: "TestDomain" }) });
		}
	});

	it("dispatches catalog-list-refresh on tab switch", async () => {
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btns = el.shadowRoot!.querySelectorAll(".sub-tab");
		(btns[1] as HTMLElement)?.click(); // Services
		expect(detail).toEqual({ entityType: "services" });
	});

	it("dispatches open-project-note when entity row clicked", async () => {
		el.entities = [{ name: "Auth", type: "Domain", status: "active", date: "2026-03-20", path: "docs/catalog/domains/auth.md" }];
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("open-project-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const row = el.shadowRoot!.querySelector(".entity-row") as HTMLElement;
		row?.click();
		expect(detail).toEqual({ path: "docs/catalog/domains/auth.md" });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-event-catalog.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Event Catalog tab component**

Create `src/components/projects/flowti-tab-event-catalog.ts` — extends `FlowtiElement` with:

- Static properties: `entities: { type: Array }`, `activeSubTab: { type: String }`, `showAddForm: { type: Boolean }`, `projectName: { type: String }`
- Sub-tab bar: Domains | Services | Events | Flows — secondary styling (smaller, underline active indicator)
- Entity list: rows with name, status badge, domain tag, date. Click row dispatches `open-project-note` (matching existing handler event name).
- Add form: inline form below Add button with fields varying by entity type. Submit dispatches `catalog-entity-create`.
- Events (all with `bubbles: true, composed: true`): `catalog-entity-create`, `catalog-list-refresh`, `open-project-note`
- Empty state per entity type: "No [type] yet. Add one to get started."

**CRITICAL:** All CustomEvents MUST use `{ bubbles: true, composed: true }` so events cross shadow DOM boundaries.

~350 lines. The add form fields adapt based on `activeSubTab` (Domain: name/status/description; Service: adds domain/produces/consumers; Event: adds version/producers/consumers; Flow: adds domain/description).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-event-catalog.test.ts`
Expected: All 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-event-catalog.ts" \
       "01 - Projects/Flowti Plugin/tests/components/projects/flowti-tab-event-catalog.test.ts"
git commit -m "feat: event catalog tab with sub-tabs and entity CRUD"
```

---

### Task 10: Reporting tab component (DAG pipeline view)

**Files:**
- Create: `src/components/projects/flowti-tab-reporting.ts`
- Create: `tests/components/projects/flowti-tab-reporting.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/projects/flowti-tab-reporting.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-reporting.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-reporting", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-reporting") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-reporting")).toBeDefined();
	});

	it("renders pipeline nodes from generators", async () => {
		el.generators = [
			{ id: "test", label: "Test Report" },
			{ id: "coverage", label: "Coverage Report" },
			{ id: "status", label: "Status Report", dependencies: ["test", "coverage"] },
		];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Test Report");
		expect(el.shadowRoot!.textContent).toContain("Coverage Report");
		expect(el.shadowRoot!.textContent).toContain("Status Report");
	});

	it("shows empty state when no generators", async () => {
		el.generators = [];
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("No report generators configured");
	});

	it("renders Run All button", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		const btn = el.shadowRoot!.querySelector(".run-all-btn");
		expect(btn).not.toBeNull();
	});

	it("dispatches report-run-all on Run All click", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		let fired = false;
		el.addEventListener("report-run-all", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector(".run-all-btn") as HTMLElement;
		btn?.click();
		expect(fired).toBe(true);
	});

	it("dispatches report-run on individual node Run click", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("report-run", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector(".node-run-btn") as HTMLElement;
		btn?.click();
		expect(detail).toEqual({ generatorId: "test" });
	});

	it("shows node status badges", async () => {
		el.generators = [{ id: "test", label: "Test" }];
		el.nodeStates = { test: "passed" };
		await el.updateComplete;
		const badge = el.shadowRoot!.querySelector(".node-badge--passed");
		expect(badge).not.toBeNull();
	});

	it("arranges nodes in topological layers", async () => {
		el.generators = [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
			{ id: "c", label: "C", dependencies: ["a", "b"] },
		];
		await el.updateComplete;
		const layers = el.shadowRoot!.querySelectorAll(".dag-layer");
		expect(layers.length).toBe(2); // layer 0: a, b; layer 1: c
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-reporting.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Reporting tab component**

Create `src/components/projects/flowti-tab-reporting.ts` — extends `FlowtiElement` with:

- Static properties: `generators: { type: Array }`, `nodeStates: { type: Object }`, `expandedNode: { type: String }`, `outputLines: { type: Array }`, `busy: { type: Boolean }`, `projectName: { type: String }`
- DAG layout: `topoSort()` private method groups generators into layers by dependency depth. CSS Grid: each layer is a column, nodes stack vertically within columns.
- SVG overlay: `renderEdges()` draws SVG paths between dependent nodes. Uses `requestAnimationFrame` + `getBoundingClientRect()` after render to compute positions.
- Node rendering: card with label, status badge (color-coded circle), Run button. Click to expand output log.
- Controls: "Run All" button at top.
- Events (all with `bubbles: true, composed: true`): `report-run` (detail: `{ generatorId }`), `report-run-all`
- Empty state: "No report generators configured" message.

**CRITICAL:** All CustomEvents MUST use `{ bubbles: true, composed: true }` so events cross shadow DOM boundaries.

~400 lines. The topological sort is a simple BFS/Kahn's algorithm.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-tab-reporting.test.ts`
Expected: All 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-reporting.ts" \
       "01 - Projects/Flowti Plugin/tests/components/projects/flowti-tab-reporting.test.ts"
git commit -m "feat: reporting tab with DAG pipeline view"
```

---

## Chunk 5: Integration — Parent Refactor, Handlers, Wiring

### Task 11: Rename config tab for consistency

**Files:**
- Rename: `src/components/projects/flowti-config-tab.ts` → `src/components/projects/flowti-tab-config.ts`
- Rename: `tests/components/projects/flowti-config-tab.test.ts` → `tests/components/projects/flowti-tab-config.test.ts`

- [ ] **Step 1: Git rename the source file**

```bash
cd "C:\Projects\flowti"
git mv "01 - Projects/Flowti Plugin/src/components/projects/flowti-config-tab.ts" \
       "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-config.ts"
```

Note: No test file exists for `flowti-config-tab.test.ts` — skip test rename.

- [ ] **Step 2: Update custom element name in the renamed source file**

In `flowti-tab-config.ts`: update the `customElements.define` call and `customElements.get` guard at the bottom from `"flowti-config-tab"` to `"flowti-tab-config"`.

- [ ] **Step 3: Update import in flowti-project-detail.ts**

Change: `import "./flowti-config-tab.js"` → `import "./flowti-tab-config.js"`
Change: element tag from `<flowti-config-tab>` → `<flowti-tab-config>` in render methods

- [ ] **Step 4: Update querySelector in project-handlers.ts**

There are 2 occurrences of `querySelector("flowti-config-tab")` in `project-handlers.ts` that must be updated to `querySelector("flowti-tab-config")`. Search and replace both.

- [ ] **Step 5: Run type check and tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "flowti-config-tab\|flowti-tab-config"`
Expected: No errors referencing old name

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-tab-config.ts" \
       "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts" \
       "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts"
git commit -m "refactor: rename flowti-config-tab to flowti-tab-config for consistency"
```

---

### Task 12: Refactor flowti-project-detail.ts to 5-tab routing

**Files:**
- Modify: `src/components/projects/flowti-project-detail.ts`

- [ ] **Step 1: Add imports for new tab components**

```typescript
import "./flowti-tab-overview.js";
import "./flowti-tab-components.js";
import "./flowti-tab-event-catalog.js";
import "./flowti-tab-reporting.js";
```

- [ ] **Step 2: Add new reactive properties**

Add to `static properties`:
```typescript
healthScore: { type: Object },
healthError: { type: String },
todos: { type: Array },
todosExist: { type: Boolean },
catalogEntities: { type: Array },
components: { type: Array },
reportGenerators: { type: Array },
reportNodeStates: { type: Object },
reportOutput: { type: Array },
reportBusy: { type: Boolean },
```

Declare instance properties:
```typescript
healthScore: HealthScore | null = null;
healthError = "";
todos: TodoItem[] = [];
todosExist = false;
catalogEntities: CatalogEntity[] = [];
components: ComponentEntry[] = [];
reportGenerators: ReportGeneratorInfo[] = [];
reportNodeStates: Record<string, string> = {};
reportOutput: string[] = [];
reportBusy = false;
```

- [ ] **Step 3: Update tab bar to 5 tabs**

Replace the existing `renderTabBar()` to add 3 new tabs:

```typescript
private renderTabBar() {
	const tab = (id: string, label: string) => html`
		<button class="tab-btn ${this.activeTab === id ? "tab-btn--active" : ""}"
			@click="${() => { this.activeTab = id; }}"
		>${label}</button>
	`;
	return html`
		<div class="tab-bar">
			${tab("overview", "Overview")}
			${tab("components", "Components")}
			${tab("catalog", "Event Catalog")}
			${tab("reporting", "Reporting")}
			${tab("config", "Config")}
		</div>
	`;
}
```

- [ ] **Step 4: Update renderContent() to route to tab components**

Replace the conditional tab rendering with:

```typescript
// In renderContent(), replace the tab conditional block with:
${this.activeTab === "overview" ? html`
	<flowti-tab-overview
		.projectName="${this.projectName}"
		.brief="${this.brief}"
		.config="${this.config}"
		.healthScore="${this.healthScore}"
		.healthError="${this.healthError}"
		.todos="${this.todos}"
		.todosExist="${this.todosExist}"
		.hasCanvas="${this.hasCanvas}"
		.hasSitemap="${this.hasSitemap}"
		.canvasPreset="${this.canvasPreset}"
		.canvasChanged="${this.canvasChanged}"
	></flowti-tab-overview>
` : ""}
${this.activeTab === "components" ? html`
	<flowti-tab-components
		.projectName="${this.projectName}"
		.components="${this.components}"
		.storybookInstalled="${this.storybook?.installed ?? false}"
		.storybookFramework="${this.storybook?.framework ?? ""}"
		.storybookRunning="${this.storybook?.running ?? false}"
		.storybookUrl="${this.storybook?.url ?? ""}"
		.storybookBusy="${this.storybookBusy}"
		.storybookBusyLabel="${this.storybookBusyLabel}"
		.storybookOutput="${this.storybookOutput}"
		.storybookError="${this.storybookError}"
	></flowti-tab-components>
` : ""}
${this.activeTab === "catalog" ? html`
	<flowti-tab-event-catalog
		.projectName="${this.projectName}"
		.entities="${this.catalogEntities}"
	></flowti-tab-event-catalog>
` : ""}
${this.activeTab === "reporting" ? html`
	<flowti-tab-reporting
		.projectName="${this.projectName}"
		.generators="${this.reportGenerators}"
		.nodeStates="${this.reportNodeStates}"
		.outputLines="${this.reportOutput}"
		.busy="${this.reportBusy}"
	></flowti-tab-reporting>
` : ""}
${this.activeTab === "config" ? html`
	<flowti-tab-config
		.projectName="${this.projectName}"
		.config="${this.config}"
		.hasCanvas="${this.hasCanvas}"
	></flowti-tab-config>
` : ""}
```

- [ ] **Step 5: Remove inlined rendering methods that moved to tab components**

Remove from `flowti-project-detail.ts`:
- `renderBriefSection()` (moved to Overview tab)
- `renderNoteSection()` (moved to Overview tab)
- `renderCanvasSection()` (moved to Overview tab)
- `renderStorybookSection()` (moved to Components tab)

Keep: `renderProjectList()`, `renderTabBar()`, `renderActivityBar()`, modal methods.

- [ ] **Step 6: Update existing flowti-project-detail.test.ts**

The existing test file queries for elements (`.note-create`, `.note-link`, `flowti-storybook-section`) that previously lived in the parent's shadow root but now live inside child tab components. Update tests to either:
- Set `el.activeTab = "overview"` before asserting brief/note elements
- Remove assertions for elements that are now tested in their own tab component tests
- Update querySelector paths to account for the tab component boundary

At minimum, tests that check for Storybook or brief elements in the parent shadow root must be updated or removed since those are now rendered by `flowti-tab-overview` and `flowti-tab-components`.

- [ ] **Step 7: Run type check and tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "flowti-project-detail"`
Expected: No errors (warnings acceptable)

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/flowti-project-detail.test.ts`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/projects/flowti-project-detail.ts" \
       "01 - Projects/Flowti Plugin/tests/components/projects/flowti-project-detail.test.ts"
git commit -m "refactor: 5-tab routing in project detail, extract sections to tab components"
```

---

### Task 13: Expand project-handlers.ts with new event handlers

**Files:**
- Modify: `src/infrastructure/handlers/project-handlers.ts`
- Modify: `src/ui/projects/project-detail-view.ts`

- [ ] **Step 1: Update ProjectHandlerDeps**

```typescript
import type { VaultFileAdapter } from "../vault-adapter.js";

export interface ProjectHandlerDeps {
	readonly projectService: IProjectService;
	readonly projectName: string;
	readonly openNote?: (path: string) => void;
	readonly createNote?: (name: string) => void;
	readonly openInWebviewer?: (url: string) => void;
	readonly navigateBack?: () => void;
	readonly pickFolder?: () => Promise<string | null>;
	readonly revealFolder?: (path: string) => void;
	readonly vaultAdapter?: VaultFileAdapter;
}
```

- [ ] **Step 2: Add health event handlers**

In `mountProjectDetail()`, after existing event listeners:

```typescript
// Health
el.addEventListener("health-refresh", (() => {
	void projectService.getHealth(currentProject).then((r) => {
		if (r.ok && r.score) {
			el.healthScore = r.score;
			el.healthError = "";
		} else {
			el.healthError = r.error ?? "Health check failed";
		}
	});
}) as EventListener);
```

- [ ] **Step 3: Add TODO event handlers**

```typescript
// TODOs
const refreshTodos = () => {
	void projectService.getTodos(currentProject).then((r) => {
		el.todos = r.items;
		el.todosExist = r.exists;
	});
};

el.addEventListener("todo-add", ((e: CustomEvent) => {
	void projectService.addTodo(currentProject, String(e.detail?.text ?? "")).then(() => refreshTodos());
}) as EventListener);

el.addEventListener("todo-toggle", ((e: CustomEvent) => {
	void projectService.toggleTodo(currentProject, Number(e.detail?.index ?? 0)).then(() => refreshTodos());
}) as EventListener);

el.addEventListener("todo-delete", ((e: CustomEvent) => {
	void projectService.deleteTodo(currentProject, Number(e.detail?.index ?? 0)).then(() => refreshTodos());
}) as EventListener);
```

- [ ] **Step 4: Add catalog event handlers**

```typescript
// Event Catalog
el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => {
	const entityType = String(e.detail?.entityType ?? "domains");
	void projectService.listEntities(currentProject, entityType as CatalogEntityType).then((entities) => {
		el.catalogEntities = entities;
	});
}) as EventListener);

el.addEventListener("catalog-entity-create", ((e: CustomEvent) => {
	const { entityType, definition } = e.detail as { entityType: string; definition: CatalogEntityDef };
	void projectService.createEntity(currentProject, entityType as CatalogEntityType, definition).then((r) => {
		if (r.ok) {
			void projectService.listEntities(currentProject, entityType as CatalogEntityType).then((entities) => {
				el.catalogEntities = entities;
			});
		}
	});
}) as EventListener);
```

- [ ] **Step 5: Add reporting event handlers**

```typescript
// Reporting
el.addEventListener("report-run", ((e: CustomEvent) => {
	const id = String(e.detail?.generatorId ?? "");
	el.reportNodeStates = { ...el.reportNodeStates, [id]: "running" };
	el.reportBusy = true;
	const lines: string[] = [];
	void projectService.runReport(currentProject, id, (line) => {
		lines.push(line);
		if (lines.length > 200) lines.shift();
		el.reportOutput = [...lines];
	}).then((r) => {
		el.reportNodeStates = { ...el.reportNodeStates, [id]: r.ok ? "passed" : "failed" };
		el.reportBusy = false;
	});
}) as EventListener);

el.addEventListener("report-run-all", (() => {
	el.reportBusy = true;
	const lines: string[] = [];
	// Set all nodes to running
	const states: Record<string, string> = {};
	for (const g of (el.reportGenerators as Array<{ id: string }>)) states[g.id] = "running";
	el.reportNodeStates = states;

	void projectService.runAllReports(currentProject, (line) => {
		lines.push(line);
		if (lines.length > 200) lines.shift();
		el.reportOutput = [...lines];
	}).then((r) => {
		if (r.ok && r.results) {
			const updated: Record<string, string> = {};
			for (const result of r.results) updated[result.id] = result.ok ? "passed" : "failed";
			el.reportNodeStates = updated;
		}
		el.reportBusy = false;
	});
}) as EventListener);
```

- [ ] **Step 6: Add initial data loading to loadProject()**

In the existing `loadProject()` function, after loading the project detail, add:

```typescript
// Load health
void projectService.getHealth(currentProject).then((r) => {
	if (r.ok && r.score) el.healthScore = r.score;
});

// Load TODOs
void projectService.getTodos(currentProject).then((r) => {
	el.todos = r.items;
	el.todosExist = r.exists;
});

// Load components
void projectService.listComponents(currentProject).then((c) => {
	el.components = c;
});

// Load report generators
void projectService.getReportGenerators(currentProject).then((g) => {
	el.reportGenerators = g;
});

// Load initial catalog entities (domains)
void projectService.listEntities(currentProject, "domains").then((entities) => {
	el.catalogEntities = entities;
});
```

- [ ] **Step 7: Update project-detail-view.ts to pass vaultAdapter**

In `src/ui/projects/project-detail-view.ts`, add `vaultAdapter` to the deps passed to `mountProjectDetail()`:

```typescript
const vaultAdapter = this.app.vault.adapter as unknown as VaultFileAdapter;
// Add to deps: vaultAdapter
```

- [ ] **Step 8: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -E "project-handlers|project-detail"`
Expected: No new errors

- [ ] **Step 9: Run all project component tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-handlers.ts" \
       "01 - Projects/Flowti Plugin/src/ui/projects/project-detail-view.ts"
git commit -m "feat: wire all new tab events through project handlers"
```

---

### Task 14: Final integration test and cleanup

- [ ] **Step 1: Run full type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No new errors (pre-existing errors acceptable)

- [ ] **Step 2: Run full lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/components/projects/ src/domain/projects/ src/infrastructure/handlers/project-handlers.ts src/infrastructure/vault-adapter.ts`
Expected: No errors (warnings for max-lines/complexity acceptable)

- [ ] **Step 3: Run all project-related tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/projects/ tests/domain/projects/`
Expected: All tests pass

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 5: Build check**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build succeeds

- [ ] **Step 6: Final commit**

```bash
git add -A "01 - Projects/Flowti Plugin/"
git commit -m "feat: project detail 5-tab architecture — overview, components, event catalog, reporting, config"
```
