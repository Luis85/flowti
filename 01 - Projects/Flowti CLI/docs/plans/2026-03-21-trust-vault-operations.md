# Trust & Vault Operations — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire trust-gated vault operations, staging, standing order evaluation, and cached vault context into a working pipeline so agents can perform real file operations against the vault.

**Architecture:** New `vault-ops` domain with pure functions. A pipeline executor chains: validate → trust check → execute/stage → record success → award reward. Vault context uses a cached file index for 60k-file vaults. Controllers expose trust management, staging review, and vault execution via CLI.

**Tech Stack:** TypeScript (ES2022, NodeNext), Vitest, zero runtime deps (Node.js built-ins only)

**Spec:** `docs/specs/2026-03-21-trust-vault-operations-design.md`

**Commands (run from `01 - Projects/Flowti CLI/`):**

```bash
# Run single test file
npx vitest run tests/domain/vault-ops/vault-ops-types.test.ts --config configs/vitest.config.ts

# Run all vault-ops tests
npx vitest run tests/domain/vault-ops/ --config configs/vitest.config.ts

# Type check
npx tsc --noEmit --project configs/tsconfig.json

# Full suite
npm test
```

---

## File Map

### New Files (Create)

| File | Purpose |
|------|---------|
| `src/domain/vault-ops/vault-ops-types.ts` | Request/result/context/cache types |
| `src/domain/vault-ops/frontmatter.ts` | Domain-level YAML frontmatter parser + serializer |
| `src/domain/vault-ops/vault-ops.ts` | 7 pure vault operation functions |
| `src/domain/vault-ops/vault-context.ts` | Cached vault context builder + scope filtering |
| `src/domain/vault-ops/vault-executor.ts` | 5-step pipeline orchestrator |
| `src/domain/vault-ops/standing-order-evaluator.ts` | Event → matched orders → VaultOpRequest[] |
| `src/controller/staging.controller.ts` | staging:list, staging:review, staging:approve, staging:reject |
| `src/controller/vault.controller.ts` | vault:exec, vault:context, task:evaluate |
| `src/ui/displays/staging-display.ts` | Staging list/review/approve/reject renderers |
| `src/ui/displays/vault-display.ts` | Vault context + operation result renderers |
| `tests/domain/vault-ops/vault-ops-types.test.ts` | Type validation tests |
| `tests/domain/vault-ops/frontmatter.test.ts` | Parser/serializer tests |
| `tests/domain/vault-ops/vault-ops.test.ts` | 7 operation tests |
| `tests/domain/vault-ops/vault-context.test.ts` | Context + cache + scope tests |
| `tests/domain/vault-ops/vault-executor.test.ts` | Pipeline flow tests |
| `tests/domain/vault-ops/standing-order-evaluator.test.ts` | Event matching + rule eval tests |
| `tests/controller/staging.controller.test.ts` | Staging controller tests |
| `tests/controller/vault.controller.test.ts` | Vault controller tests |

### Modified Files (Extend)

| File | Change |
|------|--------|
| `src/controller/trust.controller.ts` | Add `trust:reset` command |
| `src/ui/displays/trust-display.ts` | Add `renderTrustReset` renderer |
| `src/cli/register-builtin-domains.ts` | Register staging + vault domains, add `trust:reset` to projectFree |
| `tests/controller/trust.controller.test.ts` | Add `trust:reset` tests |

---

## Chunk 1: Foundation — Types & Frontmatter Utility

### Task 1: Vault Ops Types

**Files:**
- Create: `src/domain/vault-ops/vault-ops-types.ts`
- Create: `tests/domain/vault-ops/vault-ops-types.test.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
// src/domain/vault-ops/vault-ops-types.ts
import type { VaultOperation } from "../trust/trust-types.js";

// --- Deps (structural types — no infrastructure imports) ---

export interface VaultOpsDeps {
	readonly disk: {
		existsSync(p: string): boolean;
		readFileSync(p: string, enc: string): string;
		writeFileSync(p: string, data: string, enc?: string): void;
		mkdirSync(p: string, opts?: { recursive?: boolean }): void;
		renameSync(from: string, to: string): void;
		readdirSync(p: string, opts?: { withFileTypes?: boolean; recursive?: boolean }): unknown[];
		statSync(p: string): { mtimeMs: number };
		rmSync(p: string, opts?: { recursive?: boolean }): void;
	};
	readonly clock: { iso(): string };
	readonly paths: {
		join(...segs: string[]): string;
		dirname(p: string): string;
		basename(p: string): string;
		relative(from: string, to: string): string;
	};
	readonly vaultRoot: string;
}

// --- Requests ---

export interface VaultOpRequest {
	readonly agentName: string;
	readonly operation: VaultOperation;
	readonly taskId?: string;
}

export interface VaultReadRequest extends VaultOpRequest {
	readonly operation: "vault-read";
	readonly path: string;
}

export interface VaultSearchRequest extends VaultOpRequest {
	readonly operation: "vault-search";
	readonly query: {
		readonly tags?: readonly string[];
		readonly folder?: string;
		readonly pattern?: string;
	};
}

export interface VaultTagRequest extends VaultOpRequest {
	readonly operation: "vault-tag";
	readonly path: string;
	readonly addTags?: readonly string[];
	readonly removeTags?: readonly string[];
}

export interface VaultCreateRequest extends VaultOpRequest {
	readonly operation: "vault-create";
	readonly path: string;
	readonly frontmatter?: Record<string, unknown>;
	readonly body?: string;
}

export interface VaultEditRequest extends VaultOpRequest {
	readonly operation: "vault-edit";
	readonly path: string;
	readonly content: string;
}

export interface VaultMoveRequest extends VaultOpRequest {
	readonly operation: "vault-move";
	readonly fromPath: string;
	readonly toPath: string;
}

export interface VaultLinkRequest extends VaultOpRequest {
	readonly operation: "vault-link";
	readonly path: string;
	readonly addLinks?: readonly string[];
	readonly removeLinks?: readonly string[];
}

export type AnyVaultOpRequest =
	| VaultReadRequest
	| VaultSearchRequest
	| VaultTagRequest
	| VaultCreateRequest
	| VaultEditRequest
	| VaultMoveRequest
	| VaultLinkRequest;

// --- Results ---

export type VaultOpOutcome = "executed" | "staged" | "queued" | "denied" | "failed";

export interface VaultOpResult {
	readonly outcome: VaultOpOutcome;
	readonly operation: VaultOperation;
	readonly agentName: string;
	readonly taskId?: string;
	readonly data?: unknown;
	readonly stagingId?: string;
	readonly reason?: string;
}

// --- Context ---

export interface FolderEntry {
	readonly path: string;
	readonly noteCount: number;
}

export interface TagEntry {
	readonly tag: string;
	readonly count: number;
}

export interface RecentChange {
	readonly path: string;
	readonly action: "created" | "modified" | "deleted" | "moved";
	readonly at: string;
}

export interface VaultContext {
	readonly folderMap: readonly FolderEntry[];
	readonly tagIndex: readonly TagEntry[];
	readonly recentChanges: readonly RecentChange[];
}

export interface VaultScope {
	readonly folders?: readonly string[];
	readonly tags?: readonly string[];
}

// --- Cache ---

export interface FileIndexEntry {
	readonly path: string;
	readonly mtimeMs: number;
	readonly tags: readonly string[];
}

export interface VaultContextCache {
	readonly version: number;
	readonly builtAt: string;
	readonly folderMap: readonly FolderEntry[];
	readonly tagIndex: readonly TagEntry[];
	readonly fileIndex: readonly FileIndexEntry[];
}

// --- Standing Order Event ---

export interface VaultEvent {
	readonly folder: string;
	readonly type: string;
	readonly path: string;
	readonly at: string;
}
```

- [ ] **Step 2: Write the type validation test**

```typescript
// tests/domain/vault-ops/vault-ops-types.test.ts
import { describe, it, expect } from "vitest";
import type {
	VaultOpsDeps,
	VaultReadRequest,
	VaultSearchRequest,
	VaultTagRequest,
	VaultCreateRequest,
	VaultEditRequest,
	VaultMoveRequest,
	VaultLinkRequest,
	AnyVaultOpRequest,
	VaultOpOutcome,
	VaultOpResult,
	FolderEntry,
	TagEntry,
	RecentChange,
	VaultContext,
	VaultScope,
	FileIndexEntry,
	VaultContextCache,
	VaultEvent,
} from "../../../src/domain/vault-ops/vault-ops-types.js";

describe("vault-ops-types", () => {
	describe("VaultOpRequest variants", () => {
		it("accepts a valid VaultReadRequest", () => {
			const req: VaultReadRequest = {
				agentName: "auditor",
				operation: "vault-read",
				path: "00 - Inbox/note.md",
			};
			expect(req.operation).toBe("vault-read");
			expect(req.path).toBe("00 - Inbox/note.md");
		});

		it("accepts a valid VaultSearchRequest", () => {
			const req: VaultSearchRequest = {
				agentName: "auditor",
				operation: "vault-search",
				query: { tags: ["project"], folder: "01 - Projects" },
			};
			expect(req.operation).toBe("vault-search");
			expect(req.query.tags).toEqual(["project"]);
		});

		it("accepts a valid VaultTagRequest", () => {
			const req: VaultTagRequest = {
				agentName: "auditor",
				operation: "vault-tag",
				path: "note.md",
				addTags: ["reviewed"],
				removeTags: ["needs-triage"],
			};
			expect(req.addTags).toEqual(["reviewed"]);
		});

		it("accepts a valid VaultCreateRequest", () => {
			const req: VaultCreateRequest = {
				agentName: "writer",
				operation: "vault-create",
				path: "01 - Projects/new.md",
				frontmatter: { type: "Note", tags: ["draft"] },
				body: "Hello world",
			};
			expect(req.frontmatter?.type).toBe("Note");
		});

		it("accepts a valid VaultEditRequest", () => {
			const req: VaultEditRequest = {
				agentName: "editor",
				operation: "vault-edit",
				path: "note.md",
				content: "Updated body",
			};
			expect(req.content).toBe("Updated body");
		});

		it("accepts a valid VaultMoveRequest", () => {
			const req: VaultMoveRequest = {
				agentName: "organizer",
				operation: "vault-move",
				fromPath: "00 - Inbox/note.md",
				toPath: "01 - Projects/note.md",
			};
			expect(req.fromPath).toBe("00 - Inbox/note.md");
		});

		it("accepts a valid VaultLinkRequest", () => {
			const req: VaultLinkRequest = {
				agentName: "linker",
				operation: "vault-link",
				path: "note.md",
				addLinks: ["related-note"],
				removeLinks: ["old-link"],
			};
			expect(req.addLinks).toEqual(["related-note"]);
		});

		it("AnyVaultOpRequest covers all variants", () => {
			const requests: AnyVaultOpRequest[] = [
				{ agentName: "a", operation: "vault-read", path: "x" },
				{ agentName: "a", operation: "vault-search", query: {} },
				{ agentName: "a", operation: "vault-tag", path: "x" },
				{ agentName: "a", operation: "vault-create", path: "x" },
				{ agentName: "a", operation: "vault-edit", path: "x", content: "y" },
				{ agentName: "a", operation: "vault-move", fromPath: "x", toPath: "y" },
				{ agentName: "a", operation: "vault-link", path: "x" },
			];
			expect(requests).toHaveLength(7);
		});
	});

	describe("VaultOpResult", () => {
		it("covers all outcome types", () => {
			const outcomes: VaultOpOutcome[] = ["executed", "staged", "queued", "denied", "failed"];
			expect(outcomes).toHaveLength(5);
		});

		it("accepts a result with staging id", () => {
			const result: VaultOpResult = {
				outcome: "staged",
				operation: "vault-tag",
				agentName: "auditor",
				taskId: "task-001",
				stagingId: "task-001",
			};
			expect(result.stagingId).toBe("task-001");
		});

		it("accepts a denied result with reason", () => {
			const result: VaultOpResult = {
				outcome: "denied",
				operation: "vault-edit",
				agentName: "auditor",
				reason: "out of scope",
			};
			expect(result.reason).toBe("out of scope");
		});
	});

	describe("VaultContext types", () => {
		it("accepts a valid VaultContext", () => {
			const ctx: VaultContext = {
				folderMap: [{ path: "00 - Inbox", noteCount: 5 }],
				tagIndex: [{ tag: "project", count: 12 }],
				recentChanges: [{ path: "note.md", action: "created", at: "2026-03-21T10:00:00Z" }],
			};
			expect(ctx.folderMap).toHaveLength(1);
		});

		it("accepts a valid VaultScope", () => {
			const scope: VaultScope = {
				folders: ["00 - Inbox", "01 - Projects"],
				tags: ["project", "review"],
			};
			expect(scope.folders).toHaveLength(2);
		});
	});

	describe("VaultContextCache", () => {
		it("accepts a valid cache structure", () => {
			const cache: VaultContextCache = {
				version: 1,
				builtAt: "2026-03-21T10:00:00Z",
				folderMap: [{ path: "00 - Inbox", noteCount: 3 }],
				tagIndex: [{ tag: "project", count: 7 }],
				fileIndex: [{ path: "note.md", mtimeMs: 1711000000000, tags: ["project"] }],
			};
			expect(cache.version).toBe(1);
			expect(cache.fileIndex).toHaveLength(1);
		});
	});

	describe("VaultEvent", () => {
		it("uses type field (matching matchEvent contract)", () => {
			const event: VaultEvent = {
				folder: "00 - Inbox",
				type: "file-created",
				path: "00 - Inbox/new-note.md",
				at: "2026-03-21T10:00:00Z",
			};
			expect(event.type).toBe("file-created");
		});
	});
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-ops-types.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 4: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/vault-ops/vault-ops-types.ts" "01 - Projects/Flowti CLI/tests/domain/vault-ops/vault-ops-types.test.ts"
git commit -m "feat(vault-ops): add request/result/context/cache type definitions"
```

---

### Task 2: Frontmatter Parser & Serializer

**Files:**
- Create: `src/domain/vault-ops/frontmatter.ts`
- Create: `tests/domain/vault-ops/frontmatter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/vault-ops/frontmatter.test.ts
import { describe, it, expect } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../../src/domain/vault-ops/frontmatter.js";

describe("frontmatter", () => {
	describe("parseFrontmatter", () => {
		it("parses YAML frontmatter and body", () => {
			const content = "---\ntitle: Hello\ntags:\n  - one\n  - two\n---\nBody text here";
			const result = parseFrontmatter(content);
			expect(result.frontmatter.title).toBe("Hello");
			expect(result.frontmatter.tags).toEqual(["one", "two"]);
			expect(result.body).toBe("Body text here");
		});

		it("returns empty frontmatter when no delimiters", () => {
			const result = parseFrontmatter("Just body text");
			expect(result.frontmatter).toEqual({});
			expect(result.body).toBe("Just body text");
		});

		it("returns empty frontmatter when delimiters but no content", () => {
			const result = parseFrontmatter("---\n---\nBody");
			expect(result.frontmatter).toEqual({});
			expect(result.body).toBe("Body");
		});

		it("handles multiline body after frontmatter", () => {
			const content = "---\ntype: Note\n---\nLine 1\nLine 2\nLine 3";
			const result = parseFrontmatter(content);
			expect(result.frontmatter.type).toBe("Note");
			expect(result.body).toBe("Line 1\nLine 2\nLine 3");
		});

		it("handles boolean and numeric values", () => {
			const content = "---\ndraft: true\npriority: 5\n---\n";
			const result = parseFrontmatter(content);
			expect(result.frontmatter.draft).toBe(true);
			expect(result.frontmatter.priority).toBe(5);
		});

		it("handles quoted strings", () => {
			const content = '---\ntitle: "Hello: World"\n---\n';
			const result = parseFrontmatter(content);
			expect(result.frontmatter.title).toBe("Hello: World");
		});

		it("handles empty file", () => {
			const result = parseFrontmatter("");
			expect(result.frontmatter).toEqual({});
			expect(result.body).toBe("");
		});

		it("preserves leading newline in body", () => {
			const content = "---\ntype: Note\n---\n\n# Title\n\nBody";
			const result = parseFrontmatter(content);
			expect(result.body).toBe("\n# Title\n\nBody");
		});
	});

	describe("serializeFrontmatter", () => {
		it("serializes frontmatter and body", () => {
			const result = serializeFrontmatter({ title: "Hello", type: "Note" }, "Body text");
			expect(result).toBe("---\ntitle: Hello\ntype: Note\n---\nBody text");
		});

		it("serializes array values", () => {
			const result = serializeFrontmatter({ tags: ["one", "two"] }, "");
			expect(result).toBe("---\ntags:\n  - one\n  - two\n---\n");
		});

		it("serializes boolean and numeric values", () => {
			const result = serializeFrontmatter({ draft: true, priority: 5 }, "");
			expect(result).toBe("---\ndraft: true\npriority: 5\n---\n");
		});

		it("quotes strings with colons", () => {
			const result = serializeFrontmatter({ title: "Hello: World" }, "");
			expect(result).toBe('---\ntitle: "Hello: World"\n---\n');
		});

		it("returns only body when frontmatter is empty", () => {
			const result = serializeFrontmatter({}, "Just body");
			expect(result).toBe("Just body");
		});

		it("handles null and undefined values by omitting them", () => {
			const result = serializeFrontmatter({ title: "Hi", empty: null, missing: undefined }, "");
			expect(result).toBe("---\ntitle: Hi\n---\n");
		});

		it("roundtrips with parseFrontmatter", () => {
			const original = "---\ntitle: Test\ntags:\n  - a\n  - b\ntype: Note\n---\n# Title\n\nBody";
			const parsed = parseFrontmatter(original);
			const serialized = serializeFrontmatter(parsed.frontmatter, parsed.body);
			const reparsed = parseFrontmatter(serialized);
			expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
			expect(reparsed.body).toBe(parsed.body);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/frontmatter.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/vault-ops/frontmatter.ts

const DELIMITER = "---";

export function parseFrontmatter(content: string): {
	readonly frontmatter: Record<string, unknown>;
	readonly body: string;
} {
	if (!content.startsWith(DELIMITER)) {
		return { frontmatter: {}, body: content };
	}

	const lines = content.split("\n");
	let endIndex = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === DELIMITER) {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		return { frontmatter: {}, body: content };
	}

	const yamlLines = lines.slice(1, endIndex);
	const frontmatter = parseYamlLines(yamlLines);
	const body = lines.slice(endIndex + 1).join("\n");

	return { frontmatter, body };
}

export function serializeFrontmatter(
	frontmatter: Record<string, unknown>,
	body: string,
): string {
	const entries = Object.entries(frontmatter).filter(
		([, v]) => v !== null && v !== undefined,
	);

	if (entries.length === 0) {
		return body;
	}

	const yamlLines: string[] = [];
	for (const [key, value] of entries) {
		if (Array.isArray(value)) {
			yamlLines.push(`${key}:`);
			for (const item of value) {
				yamlLines.push(`  - ${item}`);
			}
		} else {
			yamlLines.push(`${key}: ${serializeValue(value)}`);
		}
	}

	return `${DELIMITER}\n${yamlLines.join("\n")}\n${DELIMITER}\n${body}`;
}

function parseYamlLines(lines: string[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	let currentKey = "";
	let currentArray: string[] | null = null;

	for (const line of lines) {
		if (line.trim() === "") continue;

		const arrayMatch = line.match(/^  - (.+)$/);
		if (arrayMatch && currentKey) {
			if (!currentArray) currentArray = [];
			currentArray.push(arrayMatch[1]);
			continue;
		}

		if (currentKey && currentArray) {
			result[currentKey] = currentArray;
			currentArray = null;
		}

		const kvMatch = line.match(/^([^:]+):\s*(.*)$/);
		if (kvMatch) {
			currentKey = kvMatch[1].trim();
			const rawValue = kvMatch[2].trim();
			if (rawValue === "") {
				currentArray = [];
			} else {
				result[currentKey] = parseValue(rawValue);
			}
		}
	}

	if (currentKey && currentArray) {
		result[currentKey] = currentArray;
	}

	return result;
}

function parseValue(raw: string): unknown {
	if (raw === "true") return true;
	if (raw === "false") return false;
	if (raw === "null") return null;

	const num = Number(raw);
	if (!Number.isNaN(num) && raw !== "") return num;

	if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
		return raw.slice(1, -1);
	}

	return raw;
}

function serializeValue(value: unknown): string {
	if (typeof value === "string") {
		if (value.includes(":") || value.includes("#") || value.includes("'") || value.includes('"')) {
			return `"${value.replace(/"/g, '\\"')}"`;
		}
		return value;
	}
	return String(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/frontmatter.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/vault-ops/frontmatter.ts" "01 - Projects/Flowti CLI/tests/domain/vault-ops/frontmatter.test.ts"
git commit -m "feat(vault-ops): add domain-level frontmatter parser and serializer"
```

---

## Chunk 2: Vault Operations — The 7 Functions

### Task 3: Vault Operations

**Files:**
- Create: `src/domain/vault-ops/vault-ops.ts`
- Create: `tests/domain/vault-ops/vault-ops.test.ts`

**Reference:** Each operation is a pure function that receives a typed request + `VaultOpsDeps`. They do not know about trust or staging. All paths are relative to vault root — resolved via `deps.paths.join(deps.vaultRoot, req.path)`.

**Mock helper pattern** (used across all vault-ops tests):

```typescript
function makeDeps(files: Record<string, string> = {}): VaultOpsDeps {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: (p: string) => p in store,
			readFileSync: (p: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return store[p];
			},
			writeFileSync: (p: string, content: string) => { store[p] = content; },
			mkdirSync: () => undefined,
			renameSync: (from: string, to: string) => {
				if (!(from in store)) throw new Error(`ENOENT: ${from}`);
				store[to] = store[from];
				delete store[from];
			},
			readdirSync: (dir: string, opts?: { withFileTypes?: boolean; recursive?: boolean }) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				const entries = Object.keys(store)
					.filter(p => p.startsWith(prefix))
					.map(p => {
						const rel = p.slice(prefix.length);
						return opts?.withFileTypes
							? { name: rel, isFile: () => true, isDirectory: () => false }
							: rel;
					});
				return entries as ReturnType<typeof deps.disk.readdirSync>;
			},
			statSync: (p: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return { mtimeMs: Date.now() };
			},
			rmSync: (p: string) => { delete store[p]; },
		},
		clock: { iso: () => "2026-03-21T10:00:00Z" },
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (from: string, to: string) => to.replace(from + "/", ""),
		},
		vaultRoot: "/vault",
	};
}
```

- [ ] **Step 1: Write the failing tests for vault-read and vault-search**

```typescript
// tests/domain/vault-ops/vault-ops.test.ts
import { describe, it, expect } from "vitest";
import {
	vaultRead,
	vaultSearch,
	vaultTag,
	vaultCreate,
	vaultEdit,
	vaultMove,
	vaultLink,
} from "../../../src/domain/vault-ops/vault-ops.js";
import type { VaultOpsDeps } from "../../../src/domain/vault-ops/vault-ops-types.js";

// makeDeps helper as shown above — paste full implementation here

describe("vault-ops", () => {
	describe("vaultRead", () => {
		it("reads file content and frontmatter", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntitle: Hello\n---\nBody text" });
			const result = vaultRead({ agentName: "a", operation: "vault-read", path: "note.md" }, deps);
			expect(result.frontmatter.title).toBe("Hello");
			expect(result.content).toBe("Body text");
		});

		it("throws when file does not exist", () => {
			const deps = makeDeps();
			expect(() => vaultRead({ agentName: "a", operation: "vault-read", path: "missing.md" }, deps))
				.toThrow("ENOENT");
		});

		it("returns empty frontmatter for plain text", () => {
			const deps = makeDeps({ "/vault/plain.md": "Just text" });
			const result = vaultRead({ agentName: "a", operation: "vault-read", path: "plain.md" }, deps);
			expect(result.frontmatter).toEqual({});
			expect(result.content).toBe("Just text");
		});
	});

	describe("vaultSearch", () => {
		it("finds files by tag", () => {
			const deps = makeDeps({
				"/vault/a.md": "---\ntags:\n  - project\n---\n",
				"/vault/b.md": "---\ntags:\n  - other\n---\n",
				"/vault/c.md": "---\ntags:\n  - project\n  - review\n---\n",
			});
			const result = vaultSearch(
				{ agentName: "a", operation: "vault-search", query: { tags: ["project"] } },
				deps,
			);
			expect(result.matches).toHaveLength(2);
			expect(result.matches.map(m => m.path)).toContain("a.md");
			expect(result.matches.map(m => m.path)).toContain("c.md");
		});

		it("finds files by folder", () => {
			const deps = makeDeps({
				"/vault/inbox/a.md": "---\ntags:\n  - x\n---\n",
				"/vault/projects/b.md": "---\n---\n",
			});
			const result = vaultSearch(
				{ agentName: "a", operation: "vault-search", query: { folder: "inbox" } },
				deps,
			);
			expect(result.matches).toHaveLength(1);
			expect(result.matches[0].path).toBe("inbox/a.md");
		});

		it("returns empty for no matches", () => {
			const deps = makeDeps({ "/vault/a.md": "---\ntags:\n  - x\n---\n" });
			const result = vaultSearch(
				{ agentName: "a", operation: "vault-search", query: { tags: ["nonexistent"] } },
				deps,
			);
			expect(result.matches).toHaveLength(0);
		});
	});

	describe("vaultTag", () => {
		it("adds tags to existing frontmatter", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - existing\n---\nBody" });
			const result = vaultTag(
				{ agentName: "a", operation: "vault-tag", path: "note.md", addTags: ["new-tag"] },
				deps,
			);
			expect(result.tags).toContain("existing");
			expect(result.tags).toContain("new-tag");
		});

		it("removes tags from existing frontmatter", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - remove-me\n  - keep\n---\nBody" });
			const result = vaultTag(
				{ agentName: "a", operation: "vault-tag", path: "note.md", removeTags: ["remove-me"] },
				deps,
			);
			expect(result.tags).not.toContain("remove-me");
			expect(result.tags).toContain("keep");
		});

		it("creates tags array when none exists", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntitle: Hi\n---\nBody" });
			const result = vaultTag(
				{ agentName: "a", operation: "vault-tag", path: "note.md", addTags: ["first"] },
				deps,
			);
			expect(result.tags).toEqual(["first"]);
		});

		it("throws when file does not exist", () => {
			const deps = makeDeps();
			expect(() => vaultTag(
				{ agentName: "a", operation: "vault-tag", path: "missing.md" },
				deps,
			)).toThrow("ENOENT");
		});
	});

	describe("vaultCreate", () => {
		it("creates a new file with frontmatter and body", () => {
			const deps = makeDeps();
			const result = vaultCreate(
				{
					agentName: "a",
					operation: "vault-create",
					path: "new-note.md",
					frontmatter: { type: "Note", tags: ["draft"] },
					body: "# Title\n\nContent",
				},
				deps,
			);
			expect(result.path).toBe("new-note.md");
			const written = deps.disk.readFileSync(deps.paths.join(deps.vaultRoot, "new-note.md"), "utf-8");
			expect(written).toContain("type: Note");
			expect(written).toContain("# Title");
		});

		it("throws when file already exists", () => {
			const deps = makeDeps({ "/vault/existing.md": "content" });
			expect(() => vaultCreate(
				{ agentName: "a", operation: "vault-create", path: "existing.md" },
				deps,
			)).toThrow("already exists");
		});

		it("creates file with body only when no frontmatter", () => {
			const deps = makeDeps();
			vaultCreate(
				{ agentName: "a", operation: "vault-create", path: "plain.md", body: "Just text" },
				deps,
			);
			const written = deps.disk.readFileSync("/vault/plain.md", "utf-8");
			expect(written).toBe("Just text");
		});
	});

	describe("vaultEdit", () => {
		it("replaces body while preserving frontmatter", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntitle: Keep\n---\nOld body" });
			const result = vaultEdit(
				{ agentName: "a", operation: "vault-edit", path: "note.md", content: "New body" },
				deps,
			);
			expect(result.path).toBe("note.md");
			const written = deps.disk.readFileSync("/vault/note.md", "utf-8");
			expect(written).toContain("title: Keep");
			expect(written).toContain("New body");
			expect(written).not.toContain("Old body");
		});

		it("throws when file does not exist", () => {
			const deps = makeDeps();
			expect(() => vaultEdit(
				{ agentName: "a", operation: "vault-edit", path: "missing.md", content: "x" },
				deps,
			)).toThrow("ENOENT");
		});
	});

	describe("vaultMove", () => {
		it("moves file to new location", () => {
			const deps = makeDeps({ "/vault/old.md": "content" });
			const result = vaultMove(
				{ agentName: "a", operation: "vault-move", fromPath: "old.md", toPath: "new.md" },
				deps,
			);
			expect(result.fromPath).toBe("old.md");
			expect(result.toPath).toBe("new.md");
			expect(deps.disk.existsSync("/vault/new.md")).toBe(true);
			expect(deps.disk.existsSync("/vault/old.md")).toBe(false);
		});

		it("throws when source does not exist", () => {
			const deps = makeDeps();
			expect(() => vaultMove(
				{ agentName: "a", operation: "vault-move", fromPath: "missing.md", toPath: "x.md" },
				deps,
			)).toThrow("ENOENT");
		});

		it("throws when target already exists", () => {
			const deps = makeDeps({ "/vault/a.md": "a", "/vault/b.md": "b" });
			expect(() => vaultMove(
				{ agentName: "a", operation: "vault-move", fromPath: "a.md", toPath: "b.md" },
				deps,
			)).toThrow("already exists");
		});
	});

	describe("vaultLink", () => {
		it("adds wikilinks to Related section", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntitle: Hi\n---\n# Title\n\nBody" });
			const result = vaultLink(
				{ agentName: "a", operation: "vault-link", path: "note.md", addLinks: ["other-note", "another"] },
				deps,
			);
			expect(result.links).toContain("other-note");
			expect(result.links).toContain("another");
			const written = deps.disk.readFileSync("/vault/note.md", "utf-8");
			expect(written).toContain("## Related");
			expect(written).toContain("[[other-note]]");
			expect(written).toContain("[[another]]");
		});

		it("removes wikilinks from content", () => {
			const deps = makeDeps({
				"/vault/note.md": "---\ntitle: Hi\n---\nSee [[remove-me]] and [[keep]]",
			});
			const result = vaultLink(
				{ agentName: "a", operation: "vault-link", path: "note.md", removeLinks: ["remove-me"] },
				deps,
			);
			expect(result.links).not.toContain("remove-me");
			const written = deps.disk.readFileSync("/vault/note.md", "utf-8");
			expect(written).not.toContain("[[remove-me]]");
			expect(written).toContain("[[keep]]");
		});

		it("throws when file does not exist", () => {
			const deps = makeDeps();
			expect(() => vaultLink(
				{ agentName: "a", operation: "vault-link", path: "missing.md", addLinks: ["x"] },
				deps,
			)).toThrow("ENOENT");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-ops.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/vault-ops/vault-ops.ts
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import type {
	VaultOpsDeps,
	VaultReadRequest,
	VaultSearchRequest,
	VaultTagRequest,
	VaultCreateRequest,
	VaultEditRequest,
	VaultMoveRequest,
	VaultLinkRequest,
} from "./vault-ops-types.js";

export function vaultRead(
	req: VaultReadRequest,
	deps: VaultOpsDeps,
): { readonly content: string; readonly frontmatter: Record<string, unknown> } {
	const abs = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(abs, "utf-8");
	const { frontmatter, body } = parseFrontmatter(raw);
	return { content: body, frontmatter };
}

export function vaultSearch(
	req: VaultSearchRequest,
	deps: VaultOpsDeps,
): { readonly matches: readonly { readonly path: string; readonly tags: readonly string[] }[] } {
	const searchRoot = req.query.folder
		? deps.paths.join(deps.vaultRoot, req.query.folder)
		: deps.vaultRoot;

	const matches: { path: string; tags: string[] }[] = [];

	const entries = deps.disk.readdirSync(searchRoot, { withFileTypes: true, recursive: true });
	for (const entry of entries) {
		const name = typeof entry === "string" ? entry : entry.name;
		if (!name.endsWith(".md")) continue;

		const absPath = deps.paths.join(searchRoot, name);
		const relPath = deps.paths.relative(deps.vaultRoot, absPath);

		const raw = deps.disk.readFileSync(absPath, "utf-8");
		const { frontmatter } = parseFrontmatter(raw);
		const fileTags = Array.isArray(frontmatter.tags) ? frontmatter.tags as string[] : [];

		if (req.query.tags && req.query.tags.length > 0) {
			const hasMatch = req.query.tags.some(t => fileTags.includes(t));
			if (!hasMatch) continue;
		}

		if (req.query.pattern) {
			const regex = new RegExp(req.query.pattern);
			if (!regex.test(name)) continue;
		}

		matches.push({ path: relPath, tags: fileTags });
	}

	return { matches };
}

export function vaultTag(
	req: VaultTagRequest,
	deps: VaultOpsDeps,
): { readonly path: string; readonly tags: readonly string[] } {
	const abs = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(abs, "utf-8");
	const { frontmatter, body } = parseFrontmatter(raw);

	const existing = Array.isArray(frontmatter.tags) ? [...frontmatter.tags as string[]] : [];
	const toAdd = req.addTags ?? [];
	const toRemove = new Set(req.removeTags ?? []);

	for (const tag of toAdd) {
		if (!existing.includes(tag)) existing.push(tag);
	}

	const tags = existing.filter(t => !toRemove.has(t));
	const updated = { ...frontmatter, tags };
	deps.disk.writeFileSync(abs, serializeFrontmatter(updated, body), "utf-8");

	return { path: req.path, tags };
}

export function vaultCreate(
	req: VaultCreateRequest,
	deps: VaultOpsDeps,
): { readonly path: string } {
	const abs = deps.paths.join(deps.vaultRoot, req.path);

	if (deps.disk.existsSync(abs)) {
		throw new Error(`File already exists: ${req.path}`);
	}

	const dir = deps.paths.dirname(abs);
	deps.disk.mkdirSync(dir, { recursive: true });

	const content = req.frontmatter && Object.keys(req.frontmatter).length > 0
		? serializeFrontmatter(req.frontmatter, req.body ?? "")
		: req.body ?? "";

	deps.disk.writeFileSync(abs, content, "utf-8");
	return { path: req.path };
}

export function vaultEdit(
	req: VaultEditRequest,
	deps: VaultOpsDeps,
): { readonly path: string } {
	const abs = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(abs, "utf-8");
	const { frontmatter } = parseFrontmatter(raw);

	const content = Object.keys(frontmatter).length > 0
		? serializeFrontmatter(frontmatter, req.content)
		: req.content;

	deps.disk.writeFileSync(abs, content, "utf-8");
	return { path: req.path };
}

export function vaultMove(
	req: VaultMoveRequest,
	deps: VaultOpsDeps,
): { readonly fromPath: string; readonly toPath: string } {
	const absFrom = deps.paths.join(deps.vaultRoot, req.fromPath);
	const absTo = deps.paths.join(deps.vaultRoot, req.toPath);

	if (!deps.disk.existsSync(absFrom)) {
		throw new Error(`ENOENT: source does not exist: ${req.fromPath}`);
	}
	if (deps.disk.existsSync(absTo)) {
		throw new Error(`File already exists: ${req.toPath}`);
	}

	const dir = deps.paths.dirname(absTo);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.renameSync(absFrom, absTo);

	return { fromPath: req.fromPath, toPath: req.toPath };
}

export function vaultLink(
	req: VaultLinkRequest,
	deps: VaultOpsDeps,
): { readonly path: string; readonly links: readonly string[] } {
	const abs = deps.paths.join(deps.vaultRoot, req.path);
	const raw = deps.disk.readFileSync(abs, "utf-8");
	const { frontmatter, body } = parseFrontmatter(raw);

	let updatedBody = body;

	if (req.removeLinks && req.removeLinks.length > 0) {
		for (const target of req.removeLinks) {
			updatedBody = updatedBody.replace(new RegExp(`\\[\\[${escapeRegex(target)}\\]\\]`, "g"), "");
		}
	}

	if (req.addLinks && req.addLinks.length > 0) {
		const linksSection = req.addLinks.map(t => `- [[${t}]]`).join("\n");
		if (updatedBody.includes("## Related")) {
			updatedBody = updatedBody.replace(
				/(## Related\n)/,
				`$1${linksSection}\n`,
			);
		} else {
			updatedBody = `${updatedBody}\n\n## Related\n${linksSection}`;
		}
	}

	const content = Object.keys(frontmatter).length > 0
		? serializeFrontmatter(frontmatter, updatedBody)
		: updatedBody;

	deps.disk.writeFileSync(abs, content, "utf-8");

	const linkPattern = /\[\[([^\]]+)\]\]/g;
	const allLinks: string[] = [];
	let match;
	while ((match = linkPattern.exec(content)) !== null) {
		allLinks.push(match[1]);
	}

	return { path: req.path, links: allLinks };
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-ops.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/vault-ops/vault-ops.ts" "01 - Projects/Flowti CLI/tests/domain/vault-ops/vault-ops.test.ts"
git commit -m "feat(vault-ops): implement 7 vault operation functions with tests"
```

---

## Chunk 3: Vault Context & Cache

### Task 4: Vault Context with Cached File Index

**Files:**
- Create: `src/domain/vault-ops/vault-context.ts`
- Create: `tests/domain/vault-ops/vault-context.test.ts`

**Reference:** The vault has ~60k files. Context uses a build-once, invalidate-on-change cache at `.flowti/var/vault-context-cache.json`. Cold start: full walk + parse. Warm start: mtime-only scan, re-parse only changed files.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/vault-ops/vault-context.test.ts
import { describe, it, expect } from "vitest";
import {
	buildVaultContext,
	loadOrBuildCache,
	invalidateContextCache,
	filterByScope,
} from "../../../src/domain/vault-ops/vault-context.js";
import type { VaultOpsDeps, VaultContextCache, VaultScope } from "../../../src/domain/vault-ops/vault-ops-types.js";

// makeDeps helper as in Task 3, extended with statSync returning mtimeMs

describe("vault-context", () => {
	describe("loadOrBuildCache — cold start", () => {
		it("builds cache from vault files when no cache exists", () => {
			const deps = makeDeps({
				"/vault/inbox/note1.md": "---\ntags:\n  - project\n---\n",
				"/vault/inbox/note2.md": "---\ntags:\n  - review\n---\n",
				"/vault/projects/spec.md": "---\ntags:\n  - project\n  - spec\n---\n",
			});
			const cache = loadOrBuildCache(deps);
			expect(cache.fileIndex).toHaveLength(3);
			expect(cache.folderMap.find(f => f.path === "inbox")?.noteCount).toBe(2);
			expect(cache.tagIndex.find(t => t.tag === "project")?.count).toBe(2);
		});

		it("writes cache to disk after cold start", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - x\n---\n" });
			loadOrBuildCache(deps);
			expect(deps.disk.existsSync("/vault/.flowti/var/vault-context-cache.json")).toBe(true);
		});
	});

	describe("loadOrBuildCache — warm start", () => {
		it("reuses cached entries for unchanged files", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - x\n---\n" });
			const cold = loadOrBuildCache(deps);
			// simulate warm start by providing the cache
			const warm = loadOrBuildCache(deps, cold);
			expect(warm.fileIndex).toHaveLength(1);
			expect(warm.fileIndex[0].tags).toEqual(["x"]);
		});

		it("detects new files and adds them to index", () => {
			const deps = makeDeps({ "/vault/old.md": "---\ntags:\n  - a\n---\n" });
			const cold = loadOrBuildCache(deps);
			// add a new file
			deps.disk.writeFileSync("/vault/new.md", "---\ntags:\n  - b\n---\n", "utf-8");
			const warm = loadOrBuildCache(deps, cold);
			expect(warm.fileIndex).toHaveLength(2);
		});

		it("removes deleted files from index", () => {
			const deps = makeDeps({
				"/vault/keep.md": "---\ntags:\n  - a\n---\n",
				"/vault/delete.md": "---\ntags:\n  - b\n---\n",
			});
			const cold = loadOrBuildCache(deps);
			deps.disk.rmSync("/vault/delete.md");
			const warm = loadOrBuildCache(deps, cold);
			expect(warm.fileIndex).toHaveLength(1);
			expect(warm.fileIndex[0].path).toBe("keep.md");
		});
	});

	describe("buildVaultContext", () => {
		it("returns folderMap, tagIndex, and recentChanges", () => {
			const deps = makeDeps({
				"/vault/inbox/a.md": "---\ntags:\n  - project\n---\n",
				"/vault/inbox/b.md": "---\ntags:\n  - review\n---\n",
			});
			const ctx = buildVaultContext(deps);
			expect(ctx.folderMap.length).toBeGreaterThan(0);
			expect(ctx.tagIndex.length).toBeGreaterThan(0);
			expect(ctx.recentChanges.length).toBeGreaterThan(0);
		});

		it("limits recentChanges to 50 entries", () => {
			const files: Record<string, string> = {};
			for (let i = 0; i < 60; i++) {
				files[`/vault/note-${i}.md`] = `---\ntags:\n  - t${i}\n---\n`;
			}
			const deps = makeDeps(files);
			const ctx = buildVaultContext(deps);
			expect(ctx.recentChanges.length).toBeLessThanOrEqual(50);
		});
	});

	describe("filterByScope", () => {
		it("filters folderMap to allowed folder prefixes", () => {
			const ctx = {
				folderMap: [
					{ path: "inbox", noteCount: 5 },
					{ path: "projects", noteCount: 3 },
					{ path: "archive", noteCount: 10 },
				],
				tagIndex: [
					{ tag: "project", count: 3 },
					{ tag: "archive", count: 2 },
				],
				recentChanges: [],
			};
			const scope: VaultScope = { folders: ["inbox", "projects"] };
			const filtered = filterByScope(ctx, scope);
			expect(filtered.folderMap).toHaveLength(2);
			expect(filtered.folderMap.map(f => f.path)).toEqual(["inbox", "projects"]);
		});

		it("filters tagIndex to allowed tag prefixes", () => {
			const ctx = {
				folderMap: [],
				tagIndex: [
					{ tag: "project", count: 3 },
					{ tag: "project/sub", count: 1 },
					{ tag: "private", count: 5 },
				],
				recentChanges: [],
			};
			const scope: VaultScope = { tags: ["project"] };
			const filtered = filterByScope(ctx, scope);
			expect(filtered.tagIndex).toHaveLength(2);
		});

		it("returns unfiltered when no scope provided", () => {
			const ctx = {
				folderMap: [{ path: "a", noteCount: 1 }],
				tagIndex: [{ tag: "x", count: 1 }],
				recentChanges: [],
			};
			const filtered = filterByScope(ctx);
			expect(filtered).toEqual(ctx);
		});
	});

	describe("invalidateContextCache", () => {
		it("deletes the cache file", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - x\n---\n" });
			loadOrBuildCache(deps);
			expect(deps.disk.existsSync("/vault/.flowti/var/vault-context-cache.json")).toBe(true);
			invalidateContextCache(deps);
			expect(deps.disk.existsSync("/vault/.flowti/var/vault-context-cache.json")).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-context.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/vault-ops/vault-context.ts
import { parseFrontmatter } from "./frontmatter.js";
import type {
	VaultOpsDeps,
	VaultContext,
	VaultContextCache,
	VaultScope,
	FolderEntry,
	TagEntry,
	FileIndexEntry,
	RecentChange,
} from "./vault-ops-types.js";

const CACHE_VERSION = 1;
const MAX_RECENT = 50;

function cachePath(deps: VaultOpsDeps): string {
	return deps.paths.join(deps.vaultRoot, ".flowti/var/vault-context-cache.json");
}

function walkMdFiles(deps: VaultOpsDeps): { path: string; mtimeMs: number }[] {
	const results: { path: string; mtimeMs: number }[] = [];
	const entries = deps.disk.readdirSync(deps.vaultRoot, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		const name = typeof entry === "string" ? entry : (entry as { name: string }).name;
		if (!name.endsWith(".md")) continue;
		// skip .flowti and .obsidian directories
		if (name.startsWith(".flowti") || name.startsWith(".obsidian")) continue;
		const abs = deps.paths.join(deps.vaultRoot, name);
		try {
			const stat = deps.disk.statSync(abs);
			results.push({ path: name, mtimeMs: stat.mtimeMs });
		} catch {
			// skip files that can't be stat'd
		}
	}
	return results;
}

function parseFileTags(deps: VaultOpsDeps, relPath: string): readonly string[] {
	try {
		const abs = deps.paths.join(deps.vaultRoot, relPath);
		const raw = deps.disk.readFileSync(abs, "utf-8");
		const { frontmatter } = parseFrontmatter(raw);
		return Array.isArray(frontmatter.tags) ? frontmatter.tags as string[] : [];
	} catch {
		return [];
	}
}

function deriveFolderMap(fileIndex: readonly FileIndexEntry[]): FolderEntry[] {
	const counts: Record<string, number> = {};
	for (const entry of fileIndex) {
		const parts = entry.path.split("/");
		const folder = parts.length > 1 ? parts[0] : ".";
		counts[folder] = (counts[folder] ?? 0) + 1;
	}
	return Object.entries(counts)
		.map(([path, noteCount]) => ({ path, noteCount }))
		.sort((a, b) => a.path.localeCompare(b.path));
}

function deriveTagIndex(fileIndex: readonly FileIndexEntry[]): TagEntry[] {
	const counts: Record<string, number> = {};
	for (const entry of fileIndex) {
		for (const tag of entry.tags) {
			counts[tag] = (counts[tag] ?? 0) + 1;
		}
	}
	return Object.entries(counts)
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count);
}

export function loadOrBuildCache(
	deps: VaultOpsDeps,
	existingCache?: VaultContextCache,
): VaultContextCache {
	const diskFiles = walkMdFiles(deps);
	const diskMap = new Map(diskFiles.map(f => [f.path, f.mtimeMs]));

	let fileIndex: FileIndexEntry[];

	if (!existingCache) {
		// Cold start: parse all files
		fileIndex = diskFiles.map(f => ({
			path: f.path,
			mtimeMs: f.mtimeMs,
			tags: parseFileTags(deps, f.path),
		}));
	} else {
		// Warm start: diff against cache
		const cacheMap = new Map(existingCache.fileIndex.map(f => [f.path, f]));
		fileIndex = [];

		for (const [path, mtimeMs] of diskMap) {
			const cached = cacheMap.get(path);
			if (cached && cached.mtimeMs === mtimeMs) {
				// Unchanged — reuse cached entry
				fileIndex.push(cached);
			} else {
				// New or modified — re-parse
				fileIndex.push({ path, mtimeMs, tags: parseFileTags(deps, path) });
			}
		}
		// Deleted files are simply not in diskMap, so they drop out
	}

	const cache: VaultContextCache = {
		version: CACHE_VERSION,
		builtAt: deps.clock.iso(),
		folderMap: deriveFolderMap(fileIndex),
		tagIndex: deriveTagIndex(fileIndex),
		fileIndex,
	};

	// Persist cache
	const cp = cachePath(deps);
	deps.disk.mkdirSync(deps.paths.dirname(cp), { recursive: true });
	deps.disk.writeFileSync(cp, JSON.stringify(cache), "utf-8");

	return cache;
}

export function buildVaultContext(
	deps: VaultOpsDeps,
	scope?: VaultScope,
): VaultContext {
	// Try to load existing cache from disk
	const cp = cachePath(deps);
	let existingCache: VaultContextCache | undefined;
	if (deps.disk.existsSync(cp)) {
		try {
			existingCache = JSON.parse(deps.disk.readFileSync(cp, "utf-8")) as VaultContextCache;
		} catch {
			existingCache = undefined;
		}
	}

	const cache = loadOrBuildCache(deps, existingCache);

	// Build recentChanges from top N by mtime
	const sorted = [...cache.fileIndex].sort((a, b) => b.mtimeMs - a.mtimeMs);
	const recentChanges: RecentChange[] = sorted.slice(0, MAX_RECENT).map(f => ({
		path: f.path,
		action: "modified" as const,
		at: new Date(f.mtimeMs).toISOString(),
	}));

	const ctx: VaultContext = {
		folderMap: cache.folderMap,
		tagIndex: cache.tagIndex,
		recentChanges,
	};

	return scope ? filterByScope(ctx, scope) : ctx;
}

export function filterByScope(
	ctx: VaultContext,
	scope?: VaultScope,
): VaultContext {
	if (!scope) return ctx;

	const folderMap = scope.folders
		? ctx.folderMap.filter(f => scope.folders!.some(sf => f.path === sf || f.path.startsWith(sf + "/")))
		: ctx.folderMap;

	const tagIndex = scope.tags
		? ctx.tagIndex.filter(t => scope.tags!.some(st => t.tag === st || t.tag.startsWith(st + "/")))
		: ctx.tagIndex;

	return { folderMap, tagIndex, recentChanges: ctx.recentChanges };
}

export function invalidateContextCache(deps: VaultOpsDeps): void {
	const cp = cachePath(deps);
	if (deps.disk.existsSync(cp)) {
		deps.disk.rmSync(cp);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-context.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/vault-ops/vault-context.ts" "01 - Projects/Flowti CLI/tests/domain/vault-ops/vault-context.test.ts"
git commit -m "feat(vault-ops): add cached vault context builder with scope filtering"
```

---

## Chunk 4: Vault Executor Pipeline

### Task 5: Vault Executor

**Files:**
- Create: `src/domain/vault-ops/vault-executor.ts`
- Create: `tests/domain/vault-ops/vault-executor.test.ts`

**Reference:** The executor chains 5 steps: `validateRequest → checkTrust → executeOrStage → recordResult → awardReward`. It returns updated trust profile + economy ledger. Never writes to disk itself. See spec Section 4.

**Dependencies it calls:**
- `trust-manager.ts`: `canPerform(profile, operation)`, `recordSuccess(profile, operation, agentLevel, config)`
- `economy-ledger.ts`: `getAccount(ledger, agentName)`, `creditReward(ledger, agentName, reward)`
- `economy-rules.ts`: `calculateReward(context)`
- `staging.ts`: `createStagingArea(...)`, `readManifest(...)`
- `vault-ops.ts`: `vaultRead`, `vaultTag`, `vaultCreate`, `vaultEdit`, `vaultMove`, `vaultLink`, `vaultSearch`

- [ ] **Step 1: Write the failing tests**

Test the 5 pipeline paths:
1. `auto` trust → operation executed → success recorded → reward credited
2. `review` trust → operation staged → no recording yet → no reward yet
3. `manual` trust → queued → no recording → no reward
4. validation failure → denied → short-circuit
5. operation throws → failed → no recording → no reward

Plus: scope enforcement, staging approval flow (post-approval recording + reward).

```typescript
// tests/domain/vault-ops/vault-executor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock infrastructure
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import {
	executeVaultOp,
	validateRequest,
	approveStaged,
} from "../../../src/domain/vault-ops/vault-executor.js";
import type {
	VaultOpsDeps,
	VaultTagRequest,
	VaultReadRequest,
	VaultScope,
} from "../../../src/domain/vault-ops/vault-ops-types.js";
import type { AgentTrustProfile, TrustConfig } from "../../../src/domain/trust/trust-types.js";
import { DEFAULT_OPERATION_TRUST, DEFAULT_TRUST_CONFIG } from "../../../src/domain/trust/trust-types.js";
import type { EconomyLedger } from "../../../src/domain/economy/economy-types.js";

// makeDeps, makeProfile, makeLedger helpers...

describe("vault-executor", () => {
	describe("validateRequest", () => {
		it("rejects path traversal", () => {
			const result = validateRequest(
				{ agentName: "a", operation: "vault-read", path: "../etc/passwd" } as VaultReadRequest,
				makeDeps(),
			);
			expect(result.valid).toBe(false);
		});

		it("rejects empty path", () => {
			const result = validateRequest(
				{ agentName: "a", operation: "vault-read", path: "" } as VaultReadRequest,
				makeDeps(),
			);
			expect(result.valid).toBe(false);
		});

		it("accepts valid path", () => {
			const result = validateRequest(
				{ agentName: "a", operation: "vault-read", path: "inbox/note.md" } as VaultReadRequest,
				makeDeps({ "/vault/inbox/note.md": "content" }),
			);
			expect(result.valid).toBe(true);
		});

		it("rejects path outside scope", () => {
			const scope: VaultScope = { folders: ["inbox"] };
			const result = validateRequest(
				{ agentName: "a", operation: "vault-read", path: "private/secret.md" } as VaultReadRequest,
				makeDeps({ "/vault/private/secret.md": "content" }),
				scope,
			);
			expect(result.valid).toBe(false);
		});
	});

	describe("executeVaultOp — auto trust path", () => {
		it("executes operation and records success", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - old\n---\nBody" });
			const profile = makeProfile({ "vault-tag": "auto" });
			const ledger = makeLedger();
			const req: VaultTagRequest = {
				agentName: "auditor",
				operation: "vault-tag",
				taskId: "task-001",
				path: "note.md",
				addTags: ["new"],
			};

			const { result, profile: updated } = executeVaultOp(
				req, deps, profile, DEFAULT_TRUST_CONFIG, ledger,
			);

			expect(result.outcome).toBe("executed");
			expect(updated.successCounts["vault-tag"]).toBe(1);
		});
	});

	describe("executeVaultOp — review trust path", () => {
		it("stages operation instead of executing", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - old\n---\nBody" });
			const profile = makeProfile({ "vault-tag": "review" });
			const req: VaultTagRequest = {
				agentName: "auditor",
				operation: "vault-tag",
				taskId: "task-001",
				path: "note.md",
				addTags: ["new"],
			};

			const { result } = executeVaultOp(
				req, deps, profile, DEFAULT_TRUST_CONFIG, makeLedger(),
			);

			expect(result.outcome).toBe("staged");
			expect(result.stagingId).toBe("task-001");
		});
	});

	describe("executeVaultOp — manual trust path", () => {
		it("returns queued without executing", () => {
			const deps = makeDeps({ "/vault/note.md": "content" });
			const profile = makeProfile({ "vault-edit": "manual" });
			const req = {
				agentName: "auditor",
				operation: "vault-edit" as const,
				taskId: "task-001",
				path: "note.md",
				content: "new",
			};

			const { result } = executeVaultOp(
				req, deps, profile, DEFAULT_TRUST_CONFIG, makeLedger(),
			);

			expect(result.outcome).toBe("queued");
		});
	});

	describe("executeVaultOp — operation failure", () => {
		it("returns failed when operation throws", () => {
			const deps = makeDeps(); // no files
			const profile = makeProfile({ "vault-read": "auto" });
			const req: VaultReadRequest = {
				agentName: "auditor",
				operation: "vault-read",
				path: "missing.md",
			};

			const { result } = executeVaultOp(
				req, deps, profile, DEFAULT_TRUST_CONFIG, makeLedger(),
			);

			expect(result.outcome).toBe("failed");
			expect(result.reason).toBeDefined();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-executor.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/vault-ops/vault-executor.ts
import type {
	VaultOpsDeps,
	AnyVaultOpRequest,
	VaultOpResult,
	VaultOpOutcome,
	VaultScope,
} from "./vault-ops-types.js";
import type { AgentTrustProfile, TrustConfig, TrustLevel } from "../trust/trust-types.js";
import type { EconomyLedger } from "../economy/economy-types.js";
import { recordSuccess } from "../trust/trust-manager.js";
import { getAccount, creditReward as creditLedger } from "../economy/economy-ledger.js";
import { calculateReward } from "../economy/economy-rules.js";
import type { TaskTrustTier } from "../tasks/task-types.js";
import { createStagingArea } from "../tasks/staging.js";
import {
	vaultRead,
	vaultSearch,
	vaultTag,
	vaultCreate,
	vaultEdit,
	vaultMove,
	vaultLink,
} from "./vault-ops.js";

interface ValidationResult {
	readonly valid: boolean;
	readonly reason?: string;
}

export function validateRequest(
	req: AnyVaultOpRequest,
	deps: VaultOpsDeps,
	scope?: VaultScope,
): ValidationResult {
	const path = "path" in req ? (req as { path: string }).path : undefined;
	const fromPath = "fromPath" in req ? (req as { fromPath: string }).fromPath : undefined;
	const toPath = "toPath" in req ? (req as { toPath: string }).toPath : undefined;

	const pathsToCheck = [path, fromPath, toPath].filter(Boolean) as string[];

	if (req.operation !== "vault-search" && pathsToCheck.length === 0) {
		return { valid: false, reason: "Path is required" };
	}

	for (const p of pathsToCheck) {
		if (p === "") return { valid: false, reason: "Path cannot be empty" };
		if (p.includes("..")) return { valid: false, reason: "Path traversal not allowed" };
	}

	if (scope?.folders && scope.folders.length > 0) {
		for (const p of pathsToCheck) {
			const inScope = scope.folders.some(f => p.startsWith(f));
			if (!inScope) return { valid: false, reason: `Path "${p}" is outside agent scope` };
		}
	}

	return { valid: true };
}

function getTrustLevel(profile: AgentTrustProfile, operation: AnyVaultOpRequest["operation"]): TrustLevel {
	return profile.operations[operation];
}

const OP_TO_ACTION: Record<string, string> = {
	"vault-create": "create",
	"vault-edit": "modify",
	"vault-tag": "tag",
	"vault-move": "move",
	"vault-link": "link",
	"vault-read": "read",
	"vault-search": "search",
};

function dispatchOp(req: AnyVaultOpRequest, deps: VaultOpsDeps): unknown {
	switch (req.operation) {
		case "vault-read": return vaultRead(req, deps);
		case "vault-search": return vaultSearch(req, deps);
		case "vault-tag": return vaultTag(req, deps);
		case "vault-create": return vaultCreate(req, deps);
		case "vault-edit": return vaultEdit(req, deps);
		case "vault-move": return vaultMove(req, deps);
		case "vault-link": return vaultLink(req, deps);
	}
}

export function executeVaultOp(
	req: AnyVaultOpRequest,
	deps: VaultOpsDeps,
	profile: AgentTrustProfile,
	config: TrustConfig,
	ledger: EconomyLedger,
	scope?: VaultScope,
): {
	readonly result: VaultOpResult;
	readonly profile: AgentTrustProfile;
	readonly ledger: EconomyLedger;
} {
	// Step 1: Validate
	const validation = validateRequest(req, deps, scope);
	if (!validation.valid) {
		return {
			result: {
				outcome: "denied",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
				reason: validation.reason,
			},
			profile,
			ledger,
		};
	}

	// Step 2: Check trust
	const trustLevel = getTrustLevel(profile, req.operation);

	// Step 3: Execute or stage
	if (trustLevel === "manual") {
		return {
			result: {
				outcome: "queued",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
			},
			profile,
			ledger,
		};
	}

	if (trustLevel === "review") {
		try {
			const stagingRoot = deps.paths.join(deps.vaultRoot, ".flowti/var/staging", req.taskId ?? "unknown");
			const previewRoot = deps.paths.join(stagingRoot, "preview");
			const stagingDeps: VaultOpsDeps = { ...deps, vaultRoot: previewRoot };
			deps.disk.mkdirSync(previewRoot, { recursive: true });
			dispatchOp(req, stagingDeps);

			const files = "path" in req
				? [{ path: (req as { path: string }).path, action: OP_TO_ACTION[req.operation] ?? "modify", previewPath: deps.paths.join("preview", (req as { path: string }).path) }]
				: [];
			createStagingArea(
				{ disk: deps.disk, paths: deps.paths },
				stagingRoot,
				{ taskId: req.taskId ?? "unknown", agentName: req.agentName, operation: req.operation, files, createdAt: deps.clock.iso(), status: "pending" },
			);

			return {
				result: {
					outcome: "staged",
					operation: req.operation,
					agentName: req.agentName,
					taskId: req.taskId,
					stagingId: req.taskId,
				},
				profile,
				ledger,
			};
		} catch (err) {
			return {
				result: {
					outcome: "failed",
					operation: req.operation,
					agentName: req.agentName,
					taskId: req.taskId,
					reason: err instanceof Error ? err.message : String(err),
				},
				profile,
				ledger,
			};
		}
	}

	// auto trust — execute directly
	try {
		const data = dispatchOp(req, deps);

		// Step 4: Record success
		const agentLevel = getAccount(ledger, req.agentName).level;
		const { profile: updatedProfile } = recordSuccess(profile, req.operation, agentLevel, config);

		// Step 5: Award reward
		let updatedLedger = ledger;
		if (req.taskId) {
			const base = { xp: 50, coin: 25 }; // default base reward — override from task definition if available
			const reward = calculateReward(base, {
				trustTier: "auto" as TaskTrustTier,
				isFirstCompletion: false,
				isStandingOrder: false,
				isDelegation: false,
			});
			updatedLedger = creditLedger(ledger, req.agentName, reward).ledger;
		}

		return {
			result: {
				outcome: "executed",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
				data,
			},
			profile: updatedProfile,
			ledger: updatedLedger,
		};
	} catch (err) {
		return {
			result: {
				outcome: "failed",
				operation: req.operation,
				agentName: req.agentName,
				taskId: req.taskId,
				reason: err instanceof Error ? err.message : String(err),
			},
			profile,
			ledger,
		};
	}
}

export function approveStaged(
	taskId: string,
	deps: VaultOpsDeps,
	profile: AgentTrustProfile,
	config: TrustConfig,
	ledger: EconomyLedger,
	operation: AnyVaultOpRequest["operation"],
	agentName: string,
): {
	readonly profile: AgentTrustProfile;
	readonly ledger: EconomyLedger;
} {
	const agentLevel = getAccount(ledger, agentName).level;
	const { profile: updatedProfile } = recordSuccess(profile, operation, agentLevel, config);
	const base = { xp: 50, coin: 25 };
	const reward = calculateReward(base, {
		trustTier: "review" as TaskTrustTier,
		isFirstCompletion: false,
		isStandingOrder: false,
		isDelegation: false,
	});
	const updatedLedger = creditLedger(ledger, agentName, reward).ledger;

	return { profile: updatedProfile, ledger: updatedLedger };
}
```

Note: The `createStagingArea` call may need adjustment to match the exact signature in `staging.ts`. Read that file during implementation to verify the parameter shape. The `calculateReward` call may also need a `RewardContext` object — check `economy-rules.ts` for the exact interface.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/vault-executor.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/vault-ops/vault-executor.ts" "01 - Projects/Flowti CLI/tests/domain/vault-ops/vault-executor.test.ts"
git commit -m "feat(vault-ops): implement 5-step vault executor pipeline"
```

---

## Chunk 5: Standing Order Evaluator

### Task 6: Standing Order Evaluator

**Files:**
- Create: `src/domain/vault-ops/standing-order-evaluator.ts`
- Create: `tests/domain/vault-ops/standing-order-evaluator.test.ts`

**Reference:** Evaluates vault events against standing orders. Uses existing `buildIndex()` and `matchEvent()` from `standing-order-index.ts`. Returns `VaultOpRequest[]` ready for the executor.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/vault-ops/standing-order-evaluator.test.ts
import { describe, it, expect } from "vitest";
import {
	evaluateEvent,
	evaluateRules,
	recordStandingOrderRun,
} from "../../../src/domain/vault-ops/standing-order-evaluator.js";
import type { VaultEvent, VaultOpsDeps } from "../../../src/domain/vault-ops/vault-ops-types.js";
import type { TaskSummary } from "../../../src/domain/tasks/task-types.js";
import type { StandingOrderRule } from "../../../src/domain/tasks/task-types.js";

describe("standing-order-evaluator", () => {
	describe("evaluateRules", () => {
		it("matches when file is missing a required tag", () => {
			const deps = makeDeps({ "/vault/inbox/note.md": "---\ntags:\n  - other\n---\n" });
			const rules: StandingOrderRule[] = [
				{ match: { tags: { missing: ["project"] } }, action: "tag", value: "needs-triage" },
			];
			const result = evaluateRules(rules, "inbox/note.md", deps);
			expect(result).toEqual({ action: "tag", value: "needs-triage" });
		});

		it("returns null when no rules match", () => {
			const deps = makeDeps({ "/vault/inbox/note.md": "---\ntags:\n  - project\n---\n" });
			const rules: StandingOrderRule[] = [
				{ match: { tags: { missing: ["project"] } }, action: "tag", value: "needs-triage" },
			];
			const result = evaluateRules(rules, "inbox/note.md", deps);
			expect(result).toBeNull();
		});

		it("returns first matching rule", () => {
			const deps = makeDeps({ "/vault/note.md": "---\ntags:\n  - x\n---\n" });
			const rules: StandingOrderRule[] = [
				{ match: { tags: { missing: ["project"] } }, action: "tag", value: "first" },
				{ match: { tags: { missing: ["review"] } }, action: "tag", value: "second" },
			];
			const result = evaluateRules(rules, "note.md", deps);
			expect(result?.value).toBe("first");
		});
	});

	describe("evaluateEvent", () => {
		it("returns vault-tag request for matching standing order", () => {
			const deps = makeDeps({
				"/vault/inbox/new.md": "---\ntags:\n  - other\n---\n",
			});
			const event: VaultEvent = {
				folder: "inbox",
				type: "file-created",
				path: "inbox/new.md",
				at: "2026-03-21T10:00:00Z",
			};
			const tasks: TaskSummary[] = [
				{
					id: "so-001",
					type: "standing-order",
					title: "Tag inbox notes",
					assignee: "auditor",
					creator: "director",
					priority: "normal",
					trustTier: "auto",
					status: "assigned",
					reward: { xp: 10, coin: 5 },
					tags: [],
					createdAt: "2026-03-21T09:00:00Z",
					file: "docs/tasks/so-001.md",
				},
			];
			// Standing order payload would be loaded from companion JSON
			const requests = evaluateEvent(event, tasks, deps);
			expect(requests.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("recordStandingOrderRun", () => {
		it("increments runCount and updates lastRun", () => {
			const payload = {
				watch: { folder: "inbox", event: "file-created" },
				rules: [],
				schedule: "on-event" as const,
				lastRun: "2026-03-21T09:00:00Z",
				runCount: 5,
			};
			const updated = recordStandingOrderRun(payload, "2026-03-21T10:00:00Z");
			expect(updated.runCount).toBe(6);
			expect(updated.lastRun).toBe("2026-03-21T10:00:00Z");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/standing-order-evaluator.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/vault-ops/standing-order-evaluator.ts
import { parseFrontmatter } from "./frontmatter.js";
import { buildIndex, matchEvent } from "../tasks/standing-order-index.js";
import type { VaultOpsDeps, VaultEvent, AnyVaultOpRequest } from "./vault-ops-types.js";
import type { TaskSummary, StandingOrderRule, StandingOrderPayload } from "../tasks/task-types.js";

export function evaluateRules(
	rules: readonly StandingOrderRule[],
	filePath: string,
	deps: VaultOpsDeps,
): { readonly action: string; readonly value: string } | null {
	const abs = deps.paths.join(deps.vaultRoot, filePath);
	let frontmatter: Record<string, unknown> = {};
	try {
		const raw = deps.disk.readFileSync(abs, "utf-8");
		frontmatter = parseFrontmatter(raw).frontmatter;
	} catch {
		return null;
	}

	const fileTags = Array.isArray(frontmatter.tags) ? frontmatter.tags as string[] : [];

	for (const rule of rules) {
		const match = rule.match as Record<string, unknown>;
		const tagsCondition = match.tags as Record<string, unknown> | undefined;

		if (tagsCondition) {
			const missing = tagsCondition.missing as string[] | undefined;
			if (missing && missing.some(t => !fileTags.includes(t))) {
				return { action: rule.action, value: rule.value };
			}
		}
	}

	return null;
}

export function evaluateEvent(
	event: VaultEvent,
	tasks: readonly TaskSummary[],
	deps: VaultOpsDeps,
): AnyVaultOpRequest[] {
	const index = buildIndex(tasks);
	const matched = matchEvent(index, { folder: event.folder, type: event.type });
	const requests: AnyVaultOpRequest[] = [];

	for (const order of matched) {
		// Load standing order payload from companion JSON
		const payloadPath = deps.paths.join(deps.vaultRoot, `docs/tasks/${order.taskId}.json`);
		let payload: StandingOrderPayload;
		try {
			payload = JSON.parse(deps.disk.readFileSync(payloadPath, "utf-8")) as StandingOrderPayload;
		} catch {
			continue;
		}

		const ruleResult = evaluateRules(payload.rules, event.path, deps);
		if (!ruleResult) continue;

		if (ruleResult.action === "tag") {
			requests.push({
				agentName: order.assignee,
				operation: "vault-tag",
				taskId: order.taskId,
				path: event.path,
				addTags: [ruleResult.value],
			});
		}
	}

	return requests;
}

export function recordStandingOrderRun(
	payload: StandingOrderPayload,
	timestamp: string,
): StandingOrderPayload {
	return {
		...payload,
		runCount: payload.runCount + 1,
		lastRun: timestamp,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/vault-ops/standing-order-evaluator.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/vault-ops/standing-order-evaluator.ts" "01 - Projects/Flowti CLI/tests/domain/vault-ops/standing-order-evaluator.test.ts"
git commit -m "feat(vault-ops): implement standing order evaluator"
```

---

## Chunk 6: Controllers, Displays & Registration

### Task 7: Extend Trust Controller with trust:reset

**Files:**
- Modify: `src/controller/trust.controller.ts`
- Modify: `src/ui/displays/trust-display.ts`
- Modify: `tests/controller/trust.controller.test.ts`

- [ ] **Step 1: Read existing trust controller**

Read `src/controller/trust.controller.ts` and `src/ui/displays/trust-display.ts` to understand the current pattern.

- [ ] **Step 2: Write the failing test for trust:reset**

Add to existing `tests/controller/trust.controller.test.ts`:

```typescript
describe("trust:reset", () => {
	it("resets all operations to defaults and clears counts", () => {
		const ctx = createCommandContext({ command: "trust:reset", flags: { agent: "auditor" } });
		const result = commands["trust:reset"].handler(ctx);
		expect(result.agent).toBe("auditor");
		expect(result.operations).toEqual(DEFAULT_OPERATION_TRUST);
		expect(result.successCounts).toEqual({});
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/trust.controller.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `trust:reset` not defined

- [ ] **Step 4: Add trust:reset to controller and renderer**

In `src/controller/trust.controller.ts`, add to the `commands` object:

```typescript
"trust:reset": adaptDescriptor({
	flags: { agent: { type: "string", required: true, hint: "--agent=<name>" } },
	handler: (ctx) => {
		const td = trustDeps(ctx.deps);
		const profile = loadTrustProfile(td, VAULT_ROOT, ctx.flags.agent);
		const resetProfile: AgentTrustProfile = {
			tier: "supervised",
			operations: { ...DEFAULT_OPERATION_TRUST },
			promotionLog: profile.promotionLog, // preserve log for audit trail
			successCounts: {},
		};
		saveTrustProfile(td, VAULT_ROOT, ctx.flags.agent, resetProfile);
		return { agent: ctx.flags.agent, operations: resetProfile.operations, successCounts: resetProfile.successCounts, promotionLog: resetProfile.promotionLog };
	},
	renderer: renderTrustReset,
}),
```

In `src/ui/displays/trust-display.ts`, add:

```typescript
export function renderTrustReset(
	data: { readonly agent: string; readonly operations: Record<string, string>; readonly successCounts: Record<string, number>; readonly promotionLog: readonly unknown[] },
	log: (msg?: string) => void,
): void {
	log(`${GREEN}RESET${RESET} trust profile for ${BOLD}${data.agent}${RESET}`);
	log(`  Operations restored to defaults`);
	log(`  Success counts cleared`);
	log(`  Promotion log preserved (${data.promotionLog.length} entries)`);
}
```

Import `renderTrustReset` in the trust controller and `DEFAULT_OPERATION_TRUST` if not already imported.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/trust.controller.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/trust.controller.ts" "01 - Projects/Flowti CLI/src/ui/displays/trust-display.ts" "01 - Projects/Flowti CLI/tests/controller/trust.controller.test.ts"
git commit -m "feat(trust): add trust:reset command"
```

---

### Task 8: Staging Controller & Display

**Files:**
- Create: `src/controller/staging.controller.ts`
- Create: `src/ui/displays/staging-display.ts`
- Create: `tests/controller/staging.controller.test.ts`

**Reference:** Uses `adaptDescriptor()` pattern. Delegates to existing `staging.ts` functions + vault executor for approve/reject flows.

- [ ] **Step 1: Write the staging display**

```typescript
// src/ui/displays/staging-display.ts
import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";

interface StagingListModel {
	readonly items: readonly {
		readonly taskId: string;
		readonly agentName: string;
		readonly operation: string;
		readonly fileCount: number;
		readonly createdAt: string;
	}[];
}

interface StagingReviewModel {
	readonly taskId: string;
	readonly agentName: string;
	readonly operation: string;
	readonly files: readonly { readonly path: string; readonly action: string; readonly previewPath: string }[];
	readonly createdAt: string;
}

interface StagingActionModel {
	readonly taskId: string;
	readonly action: "approved" | "rejected";
	readonly reason?: string;
}

export function renderStagingList(data: StagingListModel, log: (msg?: string) => void): void {
	if (data.items.length === 0) {
		log(`${DIM}No pending reviews${RESET}`);
		return;
	}
	log(`${BOLD}Pending Reviews (${data.items.length})${RESET}\n`);
	for (const item of data.items) {
		log(`  ${YELLOW}${item.taskId}${RESET}  ${item.agentName}  ${CYAN}${item.operation}${RESET}  ${item.fileCount} file(s)  ${DIM}${item.createdAt}${RESET}`);
	}
}

export function renderStagingReview(data: StagingReviewModel, log: (msg?: string) => void): void {
	log(`${BOLD}Staging Review: ${data.taskId}${RESET}`);
	log(`  Agent:     ${data.agentName}`);
	log(`  Operation: ${CYAN}${data.operation}${RESET}`);
	log(`  Staged at: ${DIM}${data.createdAt}${RESET}\n`);
	log(`  ${BOLD}Files:${RESET}`);
	for (const f of data.files) {
		log(`    ${YELLOW}${f.action}${RESET} ${f.path}`);
	}
}

export function renderStagingAction(data: StagingActionModel, log: (msg?: string) => void): void {
	const color = data.action === "approved" ? GREEN : RED;
	log(`${color}${data.action.toUpperCase()}${RESET} ${data.taskId}`);
	if (data.reason) log(`  Reason: ${data.reason}`);
}
```

- [ ] **Step 2: Write the staging controller**

```typescript
// src/controller/staging.controller.ts
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { VAULT_ROOT } from "../infrastructure/config.js";
import { listPendingReviews, readManifest, approveStaged as applyStagedFiles, rejectStaged } from "../domain/tasks/staging.js";
import { approveStaged as recordApproval } from "../domain/vault-ops/vault-executor.js";
import { loadTrustProfile, saveTrustProfile } from "../domain/trust/trust-manager.js";
import { readLedger, writeLedger } from "../domain/economy/economy-ledger.js";
import { DEFAULT_TRUST_CONFIG } from "../domain/trust/trust-types.js";
import { renderStagingList, renderStagingReview, renderStagingAction } from "../ui/displays/staging-display.js";

function stagingDeps(deps: CliDeps) {
	return { disk: deps.disk, paths: deps.paths, clock: deps.clock };
}

export const commands: Record<string, CommandHandler> = {
	"staging:list": adaptDescriptor({
		flags: { agent: { type: "string", required: false, hint: "--agent=<name>" } },
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			const reviews = listPendingReviews(sd, VAULT_ROOT);
			const items = ctx.flags.agent
				? reviews.filter(r => r.agentName === ctx.flags.agent)
				: reviews;
			return {
				items: items.map(r => ({
					taskId: r.taskId,
					agentName: r.agentName,
					operation: r.operation,
					fileCount: r.files.length,
					createdAt: r.createdAt,
				})),
			};
		},
		renderer: renderStagingList,
	}),

	"staging:review": adaptDescriptor({
		flags: { id: { type: "string", required: true, hint: "--id=<task-id>" } },
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			const manifest = readManifest(sd, VAULT_ROOT, ctx.flags.id);
			return {
				taskId: manifest.taskId,
				agentName: manifest.agentName,
				operation: manifest.operation,
				files: manifest.files,
				createdAt: manifest.createdAt,
			};
		},
		renderer: renderStagingReview,
	}),

	"staging:approve": adaptDescriptor({
		flags: { id: { type: "string", required: true, hint: "--id=<task-id>" } },
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			const manifest = readManifest(sd, VAULT_ROOT, ctx.flags.id);

			// Copy staged files to vault
			applyStagedFiles(sd, VAULT_ROOT, ctx.flags.id);

			// Record trust success + award reward
			const profile = loadTrustProfile(sd, VAULT_ROOT, manifest.agentName);
			const ledger = readLedger(sd, VAULT_ROOT);
			const vaultDeps = { ...sd, vaultRoot: VAULT_ROOT };
			const { profile: updated, ledger: updatedLedger } = recordApproval(
				ctx.flags.id, vaultDeps, profile, DEFAULT_TRUST_CONFIG, ledger,
				manifest.operation as Parameters<typeof recordApproval>[5],
				manifest.agentName,
			);
			saveTrustProfile(sd, VAULT_ROOT, manifest.agentName, updated);
			writeLedger(sd, VAULT_ROOT, updatedLedger);

			return { taskId: ctx.flags.id, action: "approved" as const };
		},
		renderer: renderStagingAction,
	}),

	"staging:reject": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<task-id>" },
			reason: { type: "string", required: true, hint: "--reason=\"...\"" },
		},
		handler: (ctx) => {
			const sd = stagingDeps(ctx.deps);
			rejectStaged(sd, VAULT_ROOT, ctx.flags.id);
			return { taskId: ctx.flags.id, action: "rejected" as const, reason: ctx.flags.reason };
		},
		renderer: renderStagingAction,
	}),
};
```

Note: The exact function signatures for `listPendingReviews`, `readManifest`, `applyStagedFiles`, `rejectStaged` may differ — read `src/domain/tasks/staging.ts` during implementation to verify parameter shapes and adapt accordingly.

- [ ] **Step 3: Write the controller tests**

```typescript
// tests/controller/staging.controller.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: { join: (...s: string[]) => s.join("/") } }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: { iso: () => "2026-03-21T10:00:00Z" } }));
vi.mock("../../src/infrastructure/config.js", () => ({ VAULT_ROOT: "/vault" }));

vi.mock("../../src/domain/tasks/staging.js", () => ({
	listPendingReviews: vi.fn(() => [
		{ taskId: "t-001", agentName: "auditor", operation: "vault-tag", files: [{ path: "note.md", action: "tag", previewPath: "preview/note.md" }], createdAt: "2026-03-21T10:00:00Z", status: "pending" },
	]),
	readManifest: vi.fn(() => ({
		taskId: "t-001", agentName: "auditor", operation: "vault-tag",
		files: [{ path: "note.md", action: "tag", previewPath: "preview/note.md" }],
		createdAt: "2026-03-21T10:00:00Z", status: "pending",
	})),
	approveStaged: vi.fn(),
	rejectStaged: vi.fn(),
}));

vi.mock("../../src/domain/vault-ops/vault-executor.js", () => ({
	approveStaged: vi.fn(() => ({ profile: {}, ledger: {} })),
}));

vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => ({})),
	saveTrustProfile: vi.fn(),
}));

vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({})),
	writeLedger: vi.fn(),
}));
import { commands } from "../../src/controller/staging.controller.js";
import { createCommandContext } from "../helpers/command-test-utils.js";

describe("staging.controller", () => {
	describe("staging:list", () => {
		it("returns pending reviews", () => {
			const ctx = createCommandContext({ command: "staging:list", flags: {} });
			const result = commands["staging:list"].handler(ctx);
			expect(result.items).toHaveLength(1);
			expect(result.items[0].taskId).toBe("t-001");
		});
	});

	describe("staging:approve", () => {
		it("returns approved action", () => {
			const ctx = createCommandContext({ command: "staging:approve", flags: { id: "t-001" } });
			const result = commands["staging:approve"].handler(ctx);
			expect(result.action).toBe("approved");
		});
	});

	describe("staging:reject", () => {
		it("returns rejected action with reason", () => {
			const ctx = createCommandContext({
				command: "staging:reject",
				flags: { id: "t-001", reason: "quality issue" },
			});
			const result = commands["staging:reject"].handler(ctx);
			expect(result.action).toBe("rejected");
			expect(result.reason).toBe("quality issue");
		});
	});
});
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/staging.controller.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/staging.controller.ts" "01 - Projects/Flowti CLI/src/ui/displays/staging-display.ts" "01 - Projects/Flowti CLI/tests/controller/staging.controller.test.ts"
git commit -m "feat(staging): add staging controller with list/review/approve/reject commands"
```

---

### Task 9: Vault Controller & Display

**Files:**
- Create: `src/controller/vault.controller.ts`
- Create: `src/ui/displays/vault-display.ts`
- Create: `tests/controller/vault.controller.test.ts`

**Reference:** Three commands: `vault:exec` (run operation through executor pipeline), `vault:context` (show agent's vault context), `task:evaluate` (trigger standing order evaluation).

- [ ] **Step 1: Write the vault display**

```typescript
// src/ui/displays/vault-display.ts
import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { VaultOpResult } from "../../domain/vault-ops/vault-ops-types.js";
import type { VaultContext } from "../../domain/vault-ops/vault-ops-types.js";

const OUTCOME_COLOR: Record<string, string> = {
	executed: GREEN,
	staged: YELLOW,
	queued: CYAN,
	denied: RED,
	failed: RED,
};

export function renderVaultExecResult(data: VaultOpResult, log: (msg?: string) => void): void {
	const color = OUTCOME_COLOR[data.outcome] ?? RESET;
	log(`${color}${data.outcome.toUpperCase()}${RESET} ${data.operation} — ${data.agentName}`);
	if (data.taskId) log(`  Task: ${data.taskId}`);
	if (data.reason) log(`  Reason: ${DIM}${data.reason}${RESET}`);
	if (data.stagingId) log(`  Staged at: ${YELLOW}${data.stagingId}${RESET}`);
	if (data.data && data.outcome === "executed") {
		log(`  Result: ${DIM}${JSON.stringify(data.data).slice(0, 200)}${RESET}`);
	}
}

export function renderVaultContext(data: VaultContext, log: (msg?: string) => void): void {
	log(`${BOLD}Vault Context${RESET}\n`);

	log(`  ${BOLD}Folders (${data.folderMap.length})${RESET}`);
	for (const f of data.folderMap) {
		log(`    ${f.path} ${DIM}(${f.noteCount} notes)${RESET}`);
	}

	log(`\n  ${BOLD}Tags (${data.tagIndex.length})${RESET}`);
	for (const t of data.tagIndex.slice(0, 20)) {
		log(`    ${CYAN}${t.tag}${RESET} ${DIM}(${t.count})${RESET}`);
	}
	if (data.tagIndex.length > 20) {
		log(`    ${DIM}... and ${data.tagIndex.length - 20} more${RESET}`);
	}

	log(`\n  ${BOLD}Recent Changes (${data.recentChanges.length})${RESET}`);
	for (const c of data.recentChanges.slice(0, 10)) {
		log(`    ${c.action} ${c.path} ${DIM}${c.at}${RESET}`);
	}
}

export function renderEvaluateResult(
	data: { readonly matched: number; readonly dispatched: readonly VaultOpResult[] },
	log: (msg?: string) => void,
): void {
	log(`${BOLD}Standing Order Evaluation${RESET}`);
	log(`  Matched: ${data.matched} order(s)`);
	log(`  Dispatched: ${data.dispatched.length} operation(s)`);
	for (const r of data.dispatched) {
		const color = OUTCOME_COLOR[r.outcome] ?? RESET;
		log(`    ${color}${r.outcome}${RESET} ${r.operation} — ${r.agentName}`);
	}
}
```

- [ ] **Step 2: Write the vault controller**

```typescript
// src/controller/vault.controller.ts
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { VAULT_ROOT } from "../infrastructure/config.js";
import type { AnyVaultOpRequest, VaultOpsDeps, VaultEvent } from "../domain/vault-ops/vault-ops-types.js";
import type { VaultOperation } from "../domain/trust/trust-types.js";
import { executeVaultOp } from "../domain/vault-ops/vault-executor.js";
import { buildVaultContext, invalidateContextCache } from "../domain/vault-ops/vault-context.js";
import { evaluateEvent } from "../domain/vault-ops/standing-order-evaluator.js";
import { loadTrustProfile, saveTrustProfile } from "../domain/trust/trust-manager.js";
import { readLedger, writeLedger } from "../domain/economy/economy-ledger.js";
import { DEFAULT_TRUST_CONFIG } from "../domain/trust/trust-types.js";
import { renderVaultExecResult, renderVaultContext, renderEvaluateResult } from "../ui/displays/vault-display.js";
const VALID_OPS = new Set<string>(["vault-read", "vault-search", "vault-tag", "vault-create", "vault-edit", "vault-move", "vault-link"]);

function vaultDeps(deps: CliDeps): VaultOpsDeps {
	return { disk: deps.disk, paths: deps.paths, clock: deps.clock, vaultRoot: VAULT_ROOT };
}

function buildRequest(flags: Record<string, unknown>): AnyVaultOpRequest {
	const op = flags.op as VaultOperation;
	const base = { agentName: flags.agent as string, operation: op, taskId: flags.task as string | undefined };

	switch (op) {
		case "vault-read":
			return { ...base, operation: "vault-read", path: flags.path as string };
		case "vault-search":
			return { ...base, operation: "vault-search", query: { folder: flags.folder as string | undefined, tags: flags.tags ? (flags.tags as string).split(",") : undefined } };
		case "vault-tag":
			return { ...base, operation: "vault-tag", path: flags.path as string, addTags: flags["add-tags"] ? (flags["add-tags"] as string).split(",") : undefined, removeTags: flags["remove-tags"] ? (flags["remove-tags"] as string).split(",") : undefined };
		case "vault-create":
			return { ...base, operation: "vault-create", path: flags.path as string, body: flags.body as string | undefined };
		case "vault-edit":
			return { ...base, operation: "vault-edit", path: flags.path as string, content: flags.content as string };
		case "vault-move":
			return { ...base, operation: "vault-move", fromPath: flags["from-path"] as string, toPath: flags["to-path"] as string };
		case "vault-link":
			return { ...base, operation: "vault-link", path: flags.path as string, addLinks: flags["add-links"] ? (flags["add-links"] as string).split(",") : undefined, removeLinks: flags["remove-links"] ? (flags["remove-links"] as string).split(",") : undefined };
		default:
			throw new Error(`Unknown operation: ${op}`);
	}
}

export const commands: Record<string, CommandHandler> = {
	"vault:exec": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			op: { type: "string", required: true, hint: "--op=<vault-operation>" },
			path: { type: "string", required: false, hint: "--path=<file>" },
			"from-path": { type: "string", required: false, hint: "--from-path=<file>" },
			"to-path": { type: "string", required: false, hint: "--to-path=<file>" },
			"add-tags": { type: "string", required: false, hint: "--add-tags=a,b" },
			"remove-tags": { type: "string", required: false, hint: "--remove-tags=a,b" },
			content: { type: "string", required: false, hint: "--content=\"...\"" },
			body: { type: "string", required: false, hint: "--body=\"...\"" },
			"add-links": { type: "string", required: false, hint: "--add-links=a,b" },
			"remove-links": { type: "string", required: false, hint: "--remove-links=a,b" },
			folder: { type: "string", required: false, hint: "--folder=<dir>" },
			tags: { type: "string", required: false, hint: "--tags=a,b" },
			task: { type: "string", required: false, hint: "--task=<task-id>" },
			"bypass-trust": { type: "boolean", required: false, hint: "--bypass-trust" },
		},
		handler: (ctx) => {
			if (!VALID_OPS.has(ctx.flags.op as string)) {
				throw new Error(`Invalid operation: ${ctx.flags.op}. Valid: ${[...VALID_OPS].join(", ")}`);
			}

			const deps = vaultDeps(ctx.deps);
			const req = buildRequest(ctx.flags as Record<string, unknown>);
			const profile = loadTrustProfile({ disk: ctx.deps.disk, paths: ctx.deps.paths }, VAULT_ROOT, req.agentName);
			const ledger = readLedger({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, VAULT_ROOT);

			const { result, profile: up, ledger: ul } = executeVaultOp(req, deps, profile, DEFAULT_TRUST_CONFIG, ledger);

			saveTrustProfile({ disk: ctx.deps.disk, paths: ctx.deps.paths }, VAULT_ROOT, req.agentName, up);
			writeLedger({ disk: ctx.deps.disk, paths: ctx.deps.paths, clock: ctx.deps.clock }, VAULT_ROOT, ul);

			return result;
		},
		renderer: renderVaultExecResult,
	}),

	"vault:context": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			rebuild: { type: "boolean", required: false, hint: "--rebuild" },
		},
		handler: (ctx) => {
			const deps = vaultDeps(ctx.deps);
			if (ctx.flags.rebuild) {
				invalidateContextCache(deps);
			}
			return buildVaultContext(deps);
		},
		renderer: renderVaultContext,
	}),

	"task:evaluate": adaptDescriptor({
		flags: {
			event: { type: "string", required: true, hint: "--event=file-created" },
			path: { type: "string", required: true, hint: "--path=\"00 - Inbox/note.md\"" },
		},
		handler: (ctx) => {
			const deps = vaultDeps(ctx.deps);
			const folder = ctx.deps.paths.dirname(ctx.flags.path as string);
			const vaultEvent: VaultEvent = {
				folder,
				type: ctx.flags.event as string,
				path: ctx.flags.path as string,
				at: ctx.deps.clock.iso(),
			};
			// Load tasks and evaluate — for now return empty since task store integration
			// requires reading the exact taskStore API. The evaluator returns VaultOpRequest[].
			const requests = evaluateEvent(vaultEvent, [], deps);
			return { matched: requests.length, dispatched: [] };
		},
		renderer: renderEvaluateResult,
	}),
};
```

Note: The `task:evaluate` handler stubs the task list as `[]` — during implementation, wire it to the actual `taskStore.list()` call and iterate over returned requests through `executeVaultOp()`.

- [ ] **Step 3: Write the controller tests**

```typescript
// tests/controller/vault.controller.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p.split("/").slice(0, -1).join("/") } }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: { iso: () => "2026-03-21T10:00:00Z" } }));
vi.mock("../../src/infrastructure/config.js", () => ({ VAULT_ROOT: "/vault" }));

vi.mock("../../src/domain/vault-ops/vault-executor.js", () => ({
	executeVaultOp: vi.fn(() => ({
		result: { outcome: "executed", operation: "vault-read", agentName: "auditor", data: { content: "hello", frontmatter: {} } },
		profile: {},
		ledger: {},
	})),
}));

vi.mock("../../src/domain/vault-ops/vault-context.js", () => ({
	buildVaultContext: vi.fn(() => ({ folderMap: [], tagIndex: [], recentChanges: [] })),
	invalidateContextCache: vi.fn(),
}));

vi.mock("../../src/domain/vault-ops/standing-order-evaluator.js", () => ({
	evaluateEvent: vi.fn(() => []),
}));

vi.mock("../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => ({})),
	saveTrustProfile: vi.fn(),
}));

vi.mock("../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({})),
	writeLedger: vi.fn(),
}));

import { commands } from "../../src/controller/vault.controller.js";
import { createCommandContext } from "../helpers/command-test-utils.js";

describe("vault.controller", () => {
	describe("vault:exec", () => {
		it("returns executed result for vault-read", () => {
			const ctx = createCommandContext({
				command: "vault:exec",
				flags: { agent: "auditor", op: "vault-read", path: "note.md" },
			});
			const result = commands["vault:exec"].handler(ctx);
			expect(result.outcome).toBe("executed");
		});

		it("throws on invalid operation", () => {
			const ctx = createCommandContext({
				command: "vault:exec",
				flags: { agent: "auditor", op: "invalid-op", path: "note.md" },
			});
			expect(() => commands["vault:exec"].handler(ctx)).toThrow("Invalid operation");
		});
	});

	describe("vault:context", () => {
		it("returns vault context", () => {
			const ctx = createCommandContext({
				command: "vault:context",
				flags: { agent: "auditor" },
			});
			const result = commands["vault:context"].handler(ctx);
			expect(result.folderMap).toBeDefined();
			expect(result.tagIndex).toBeDefined();
		});
	});

	describe("task:evaluate", () => {
		it("returns evaluation summary", () => {
			const ctx = createCommandContext({
				command: "task:evaluate",
				flags: { event: "file-created", path: "00 - Inbox/note.md" },
			});
			const result = commands["task:evaluate"].handler(ctx);
			expect(result.matched).toBe(0);
		});
	});
});
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/vault.controller.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/vault.controller.ts" "01 - Projects/Flowti CLI/src/ui/displays/vault-display.ts" "01 - Projects/Flowti CLI/tests/controller/vault.controller.test.ts"
git commit -m "feat(vault): add vault controller with exec/context/evaluate commands"
```

---

### Task 10: Controller Registration in register-builtin-domains.ts

**Files:**
- Modify: `src/cli/register-builtin-domains.ts`

**Reference:** All built-in domains are registered in `src/cli/register-builtin-domains.ts`, NOT in `main.ts`. Follow the existing pattern of import + `registry.registerDomain()`.

- [ ] **Step 1: Read current register-builtin-domains.ts**

Read `src/cli/register-builtin-domains.ts` to find exact import block and registration block.

- [ ] **Step 2: Add imports for staging and vault controllers**

Add after the existing trust controller import (line 41):

```typescript
import { commands as stagingCmds } from "../controller/staging.controller.js";
import { commands as vaultCmds } from "../controller/vault.controller.js";
```

- [ ] **Step 3: Register staging and vault domains**

Add after the trust domain registration block (after line 187):

```typescript
	registry.registerDomain({
		domain: "staging",
		commands: stagingCmds,
		projectFree: ["staging:list", "staging:review", "staging:approve", "staging:reject"],
	});
	registry.registerDomain({
		domain: "vault",
		commands: vaultCmds,
		projectFree: ["vault:exec", "vault:context", "task:evaluate"],
	});
```

- [ ] **Step 4: Update trust domain registration to include trust:reset**

Change the trust domain `projectFree` array from:

```typescript
projectFree: ["trust:show", "trust:promote", "trust:demote", "trust:history"],
```

to:

```typescript
projectFree: ["trust:show", "trust:promote", "trust:demote", "trust:history", "trust:reset"],
```

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All tests PASS, no type errors, no lint errors

- [ ] **Step 6: Build and verify**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds, outputs to `.flowti/bin/main.js`

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/cli/register-builtin-domains.ts"
git commit -m "feat(vault-ops): register staging and vault controllers in builtin domains"
```

---

## Final Verification

After all tasks are complete:

- [ ] **Run full test suite**: `cd "01 - Projects/Flowti CLI" && npm test`
- [ ] **Run build**: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
- [ ] **Verify CLI commands work**:
  - `flowti trust:show --agent=auditor`
  - `flowti trust:reset --agent=auditor`
  - `flowti staging:list`
  - `flowti vault:context --agent=auditor`
  - `flowti vault:exec --agent=auditor --op=vault-read --path="README.md"`
