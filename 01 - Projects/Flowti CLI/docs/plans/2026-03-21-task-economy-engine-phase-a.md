# Task & Economy Engine — Phase A Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Task Engine and Economy Core as CLI domains — task CRUD, lifecycle state machine, economy ledger, leveling, reward rules, and CLI commands.

**Architecture:** Two new CLI domains (`src/domain/tasks/`, `src/domain/economy/`) following the existing `createStore()` and `adaptDescriptor()` patterns. Tasks stored as markdown+JSON (like agents/sessions). Economy stored as JSON ledger in `.flowti/var/`. All domain code is pure — receives deps via injection, no infrastructure imports.

**Tech Stack:** TypeScript (ES2022, NodeNext), Vitest, tabs for indentation, `.js` extensions in imports.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-21-task-economy-engine-design.md`

**Test command:** `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
**Single file:** `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-types.test.ts --config configs/vitest.config.ts`
**Type check:** `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Task Engine Domain

### Task 1: Task Types

**Files:**
- Create: `src/domain/tasks/task-types.ts`
- Test: `tests/domain/tasks/task-types.test.ts`

- [ ] **Step 1: Write the type definition file**

```typescript
// src/domain/tasks/task-types.ts

export type TaskType = "one-off" | "standing-order" | "delegated" | "self-proposed";

export type TaskStatus =
	| "proposed"
	| "pending"
	| "assigned"
	| "in-progress"
	| "review"
	| "completed"
	| "failed";

export type TaskPriority = "normal" | "high" | "urgent";

export type TaskTrustTier = "auto" | "review" | "manual";

export interface TaskReward {
	readonly xp: number;
	readonly coin: number;
}

export interface TaskDefinition {
	readonly id: string;
	readonly type: TaskType;
	readonly title: string;
	readonly assignee?: string;
	readonly creator: string;
	readonly priority: TaskPriority;
	readonly trustTier: TaskTrustTier;
	readonly status: TaskStatus;
	readonly reward: TaskReward;
	readonly tags: readonly string[];
	readonly createdAt: string;
	readonly completedAt?: string;
	readonly journeyId?: string;
}

export interface TaskSummary extends TaskDefinition {
	readonly file: string;
}

export interface StandingOrderPayload {
	readonly watch: { readonly folder: string; readonly event: string };
	readonly rules: readonly StandingOrderRule[];
	readonly schedule: "on-event" | "interval";
	readonly lastRun?: string;
	readonly runCount: number;
}

export interface StandingOrderRule {
	readonly match: Record<string, unknown>;
	readonly action: string;
	readonly value: string;
}

export type StoreDeps = { readonly disk: import("../../infrastructure/types.js").IFileSystem; readonly paths: import("../../infrastructure/types.js").IPaths };
```

- [ ] **Step 2: Write a basic type-check test**

```typescript
// tests/domain/tasks/task-types.test.ts
import { describe, it, expect } from "vitest";
import type { TaskDefinition, TaskStatus, TaskType, StandingOrderPayload } from "../../../src/domain/tasks/task-types.js";

describe("task-types", () => {
	it("TaskDefinition accepts valid task", () => {
		const task: TaskDefinition = {
			id: "task-001",
			type: "one-off",
			title: "Tag inbox notes",
			creator: "director",
			priority: "normal",
			trustTier: "review",
			status: "pending",
			reward: { xp: 50, coin: 25 },
			tags: ["inbox"],
			createdAt: "2026-03-21T10:00:00Z",
		};
		expect(task.id).toBe("task-001");
		expect(task.type).toBe("one-off");
	});

	it("StandingOrderPayload accepts valid payload", () => {
		const payload: StandingOrderPayload = {
			watch: { folder: "00 - Inbox", event: "file-created" },
			rules: [{ match: { tags: { missing: ["project"] } }, action: "tag", value: "needs-triage" }],
			schedule: "on-event",
			runCount: 0,
		};
		expect(payload.watch.folder).toBe("00 - Inbox");
		expect(payload.runCount).toBe(0);
	});

	it("TaskStatus includes all lifecycle states", () => {
		const states: TaskStatus[] = ["proposed", "pending", "assigned", "in-progress", "review", "completed", "failed"];
		expect(states).toHaveLength(7);
	});

	it("TaskType includes all task types", () => {
		const types: TaskType[] = ["one-off", "standing-order", "delegated", "self-proposed"];
		expect(types).toHaveLength(4);
	});
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-types.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/tasks/task-types.ts" "01 - Projects/Flowti CLI/tests/domain/tasks/task-types.test.ts"
git commit -m "feat(tasks): add task type definitions"
```

---

### Task 2: Task Lifecycle State Machine

**Files:**
- Create: `src/domain/tasks/task-lifecycle.ts`
- Test: `tests/domain/tasks/task-lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/tasks/task-lifecycle.test.ts
import { describe, it, expect } from "vitest";
import { canTransition, transition, VALID_TRANSITIONS } from "../../../src/domain/tasks/task-lifecycle.js";
import type { TaskStatus } from "../../../src/domain/tasks/task-types.js";

describe("task-lifecycle", () => {
	describe("canTransition", () => {
		it("allows proposed -> pending", () => {
			expect(canTransition("proposed", "pending")).toBe(true);
		});

		it("allows pending -> assigned", () => {
			expect(canTransition("pending", "assigned")).toBe(true);
		});

		it("allows assigned -> in-progress", () => {
			expect(canTransition("assigned", "in-progress")).toBe(true);
		});

		it("allows in-progress -> review", () => {
			expect(canTransition("in-progress", "review")).toBe(true);
		});

		it("allows in-progress -> completed", () => {
			expect(canTransition("in-progress", "completed")).toBe(true);
		});

		it("allows in-progress -> failed", () => {
			expect(canTransition("in-progress", "failed")).toBe(true);
		});

		it("allows review -> completed", () => {
			expect(canTransition("review", "completed")).toBe(true);
		});

		it("allows review -> pending (rejection)", () => {
			expect(canTransition("review", "pending")).toBe(true);
		});

		it("rejects invalid transition proposed -> completed", () => {
			expect(canTransition("proposed", "completed")).toBe(false);
		});

		it("rejects invalid transition completed -> pending", () => {
			expect(canTransition("completed", "pending")).toBe(false);
		});

		it("rejects same-state transition", () => {
			expect(canTransition("pending", "pending")).toBe(false);
		});
	});

	describe("transition", () => {
		it("returns new status on valid transition", () => {
			expect(transition("proposed", "pending")).toBe("pending");
		});

		it("returns null on invalid transition", () => {
			expect(transition("proposed", "completed")).toBeNull();
		});

		it("allows failed -> pending (retry)", () => {
			expect(transition("failed", "pending")).toBe("pending");
		});
	});

	describe("VALID_TRANSITIONS", () => {
		it("exports transition map", () => {
			expect(VALID_TRANSITIONS).toBeDefined();
			expect(VALID_TRANSITIONS.proposed).toContain("pending");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-lifecycle.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/tasks/task-lifecycle.ts
import type { TaskStatus } from "./task-types.js";

export const VALID_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
	"proposed": ["pending"],
	"pending": ["assigned"],
	"assigned": ["in-progress"],
	"in-progress": ["review", "completed", "failed"],
	"review": ["completed", "pending"],
	"completed": [],
	"failed": ["pending"],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
	return VALID_TRANSITIONS[from].includes(to);
}

export function transition(from: TaskStatus, to: TaskStatus): TaskStatus | null {
	return canTransition(from, to) ? to : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-lifecycle.test.ts --config configs/vitest.config.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/tasks/task-lifecycle.ts" "01 - Projects/Flowti CLI/tests/domain/tasks/task-lifecycle.test.ts"
git commit -m "feat(tasks): add task lifecycle state machine"
```

---

### Task 3: Task Store

**Files:**
- Create: `src/domain/tasks/task-store.ts`
- Test: `tests/domain/tasks/task-store.test.ts`
- Reference: `src/infrastructure/store-engine.ts` for `createStore()` pattern, `src/domain/agents/agent-store.ts` for companion JSON usage

The task store follows the `createStore()` pattern. Tasks are markdown files with YAML frontmatter. Standing orders have a companion JSON file for their rules/watch config.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/tasks/task-store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", BG_RED: "", BG_GREEN: "", BG_YELLOW: "" }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { taskStore } from "../../../src/domain/tasks/task-store.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	const dirs = new Set<string>();
	for (const key of Object.keys(files)) {
		const parts = key.split("/");
		for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
	}
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn((dir: string) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				return Object.keys(store)
					.filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
					.map(k => k.slice(prefix.length));
			}),
			unlinkSync: vi.fn((p: string) => { delete store[p]; }),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			resolve: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string, ext?: string) => {
				const b = p.split("/").pop()!;
				return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
			},
			relative: (from: string, to: string) => to,
			extname: (p: string) => {
				const dot = p.lastIndexOf(".");
				return dot >= 0 ? p.slice(dot) : "";
			},
		},
		clock: { now: () => Date.now(), iso: () => "2026-03-21T10:00:00Z", ms: () => Date.now(), safeIso: () => "2026-03-21T10-00-00" },
	} as unknown as Parameters<typeof taskStore.list>[0];
}

const TASK_MD = `---
type: Task
id: task-001
taskType: one-off
title: Tag inbox notes
assignee: auditor
creator: director
priority: normal
trustTier: review
status: pending
rewardXp: 50
rewardCoin: 25
tags: [inbox, tagging]
createdAt: 2026-03-21T10:00:00Z
---

# Tag inbox notes

Review all notes in the inbox and apply project labels.
`;

describe("taskStore", () => {
	describe("list", () => {
		it("returns empty array when dir missing", () => {
			const deps = makeDeps();
			expect(taskStore.list(deps, "/proj")).toEqual([]);
		});

		it("parses task from markdown file", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const tasks = taskStore.list(deps, "/proj");
			expect(tasks).toHaveLength(1);
			expect(tasks[0].id).toBe("task-001");
			expect(tasks[0].title).toBe("Tag inbox notes");
			expect(tasks[0].type).toBe("one-off");
			expect(tasks[0].assignee).toBe("auditor");
			expect(tasks[0].status).toBe("pending");
			expect(tasks[0].reward).toEqual({ xp: 50, coin: 25 });
		});
	});

	describe("create", () => {
		it("writes task markdown file", () => {
			const deps = makeDeps();
			const path = taskStore.create(deps, "/proj", {
				id: "task-002",
				type: "one-off",
				title: "Create project notes",
				creator: "director",
				priority: "normal",
				trustTier: "auto",
				status: "pending",
				reward: { xp: 30, coin: 15 },
				tags: ["project"],
				createdAt: "2026-03-21T11:00:00Z",
			});
			expect(path).toContain("task-002");
			expect(deps.disk.writeFileSync).toHaveBeenCalled();
		});
	});

	describe("updateField", () => {
		it("updates task status field", () => {
			const deps = makeDeps({ "/proj/docs/tasks/task-001.md": TASK_MD });
			const result = taskStore.updateField(deps, "/proj", "task-001", "status", "assigned");
			expect(result).toBe(true);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-store.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the task store implementation**

Follow the `createStore()` pattern from `src/infrastructure/store-engine.ts`. The task store uses frontmatter fields for flat data and companion JSON for standing order payloads. Reference `src/domain/agents/agent-store.ts` for companion JSON handling.

Key implementation details:
- `typeTag: "Task"` — YAML frontmatter `type: Task`
- `defaultDir: "docs/tasks"` — relative to project root
- `fields` map: id, taskType, title, assignee, creator, priority, trustTier, status, rewardXp, rewardCoin, tags, createdAt, completedAt, journeyId
- `companion: { extension: ".json", fields: ["standingOrder"] }` — standing order payload in JSON
- `buildBody`: generates markdown body from title and description
- `sort`: by createdAt descending (newest first)
- The `reward` field in `TaskSummary` is composed from `rewardXp` + `rewardCoin` frontmatter fields during parsing

Use a **manual store implementation** (like `agent-store.ts`) rather than `createStore()`, because the task store needs to compose the `reward` object from two frontmatter fields (`rewardXp`, `rewardCoin`) and alias `taskType` → `type`. The manual approach gives full control over frontmatter parsing.

```typescript
// src/domain/tasks/task-store.ts
import type { TaskDefinition, TaskSummary, TaskType, TaskStatus, TaskPriority, TaskTrustTier, StandingOrderPayload } from "./task-types.js";

type TaskStoreDeps = {
	readonly disk: { existsSync(p: string): boolean; readFileSync(p: string, enc?: string): string; writeFileSync(p: string, c: string): void; mkdirSync(p: string, opts?: { recursive?: boolean }): void; readdirSync(p: string): string[]; unlinkSync(p: string): void };
	readonly paths: { join(...segs: string[]): string; basename(p: string, ext?: string): string; dirname(p: string): string };
};

const DIR = "docs/tasks";
const MD = ".md";

function parseFrontmatter(raw: string): Record<string, string> {
	const m = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!m) return {};
	const fm: Record<string, string> = {};
	for (const line of m[1].split("\n")) {
		const idx = line.indexOf(":");
		if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
	}
	return fm;
}

function parseArrayField(raw: string): string[] {
	const trimmed = raw.replace(/^\[/, "").replace(/\]$/, "");
	if (!trimmed) return [];
	return trimmed.split(",").map(s => s.trim());
}

function toSummary(fm: Record<string, string>, file: string): TaskSummary {
	return {
		id: fm.id ?? "",
		type: (fm.taskType ?? "one-off") as TaskType,
		title: fm.title ?? "",
		assignee: fm.assignee ?? "",
		creator: fm.creator ?? "",
		priority: (fm.priority ?? "normal") as TaskPriority,
		trustTier: (fm.trustTier ?? "review") as TaskTrustTier,
		status: (fm.status ?? "pending") as TaskStatus,
		reward: { xp: Number(fm.rewardXp) || 0, coin: Number(fm.rewardCoin) || 0 },
		tags: parseArrayField(fm.tags ?? ""),
		createdAt: fm.createdAt ?? "",
		completedAt: fm.completedAt ?? "",
		journeyId: fm.journeyId ?? "",
		file,
	};
}

function buildMd(def: TaskDefinition): string {
	const lines = [
		"---",
		"type: Task",
		`id: ${def.id}`,
		`taskType: ${def.type}`,
		`title: ${def.title}`,
		def.assignee ? `assignee: ${def.assignee}` : "",
		`creator: ${def.creator}`,
		`priority: ${def.priority}`,
		`trustTier: ${def.trustTier}`,
		`status: ${def.status}`,
		`rewardXp: ${def.reward.xp}`,
		`rewardCoin: ${def.reward.coin}`,
		`tags: [${def.tags.join(", ")}]`,
		`createdAt: ${def.createdAt}`,
		def.completedAt ? `completedAt: ${def.completedAt}` : "",
		def.journeyId ? `journeyId: ${def.journeyId}` : "",
		"---",
		"",
		`# ${def.title}`,
		"",
	];
	return lines.filter(Boolean).join("\n");
}

export const taskStore = {
	list(deps: TaskStoreDeps, projectPath: string): TaskSummary[] {
		const dir = deps.paths.join(projectPath, DIR);
		if (!deps.disk.existsSync(dir)) return [];
		const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(MD));
		const results: TaskSummary[] = [];
		for (const f of files) {
			const path = deps.paths.join(dir, f);
			const raw = deps.disk.readFileSync(path, "utf-8");
			const fm = parseFrontmatter(raw);
			if (fm.type !== "Task") continue;
			results.push(toSummary(fm, path));
		}
		return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	},

	read(deps: TaskStoreDeps, projectPath: string, id: string): TaskSummary | undefined {
		return this.list(deps, projectPath).find(t => t.id === id);
	},

	create(deps: TaskStoreDeps, projectPath: string, def: TaskDefinition): string {
		const dir = deps.paths.join(projectPath, DIR);
		deps.disk.mkdirSync(dir, { recursive: true });
		const filename = `${def.id}${MD}`;
		const path = deps.paths.join(dir, filename);
		deps.disk.writeFileSync(path, buildMd(def));
		return path;
	},

	updateField(deps: TaskStoreDeps, projectPath: string, id: string, field: string, value: string): boolean {
		const dir = deps.paths.join(projectPath, DIR);
		const path = deps.paths.join(dir, `${id}${MD}`);
		if (!deps.disk.existsSync(path)) return false;
		const raw = deps.disk.readFileSync(path, "utf-8");
		const fm = parseFrontmatter(raw);
		fm[field] = value;
		const updated = raw.replace(/^---\n[\s\S]*?\n---/, "---\n" + Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n---");
		deps.disk.writeFileSync(path, updated);
		return true;
	},

	remove(deps: TaskStoreDeps, projectPath: string, id: string): void {
		const dir = deps.paths.join(projectPath, DIR);
		const path = deps.paths.join(dir, `${id}${MD}`);
		if (deps.disk.existsSync(path)) deps.disk.unlinkSync(path);
	},
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-store.test.ts --config configs/vitest.config.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/tasks/task-store.ts" "01 - Projects/Flowti CLI/tests/domain/tasks/task-store.test.ts"
git commit -m "feat(tasks): add task store with CRUD operations"
```

---

## Chunk 2: Economy Domain

### Task 4: Economy Types

**Files:**
- Create: `src/domain/economy/economy-types.ts`
- Test: `tests/domain/economy/economy-types.test.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
// src/domain/economy/economy-types.ts

export interface AgentAccount {
	readonly xp: number;
	readonly level: number;
	readonly coin: number;
	readonly tokens: number;
	readonly totalEarned: { readonly xp: number; readonly coin: number };
	readonly totalSpent: { readonly coin: number; readonly tokens: number };
}

export interface EconomyLedger {
	readonly version: number;
	readonly updatedAt: string;
	readonly accounts: Record<string, AgentAccount>;
}

export type TransactionType =
	| "task-reward"
	| "standing-order-reward"
	| "delegation-fee"
	| "delegation-cut"
	| "spend"
	| "llm-spend"
	| "grant"
	| "purchase"
	| "debug";

export interface Transaction {
	readonly ts: string;
	readonly agent: string;
	readonly type: TransactionType;
	readonly taskId?: string;
	readonly item?: string;
	readonly to?: string;
	readonly xp?: number;
	readonly coin?: number;
	readonly tokens?: number;
}

export interface RewardResult {
	readonly xp: number;
	readonly coin: number;
	readonly leveledUp: boolean;
	readonly newLevel?: number;
}

export type EconomyDeps = {
	readonly disk: import("../../infrastructure/types.js").IFileSystem;
	readonly paths: import("../../infrastructure/types.js").IPaths;
	readonly clock: import("../../infrastructure/types.js").IClock;
};
```

- [ ] **Step 2: Write type-check test**

```typescript
// tests/domain/economy/economy-types.test.ts
import { describe, it, expect } from "vitest";
import type { AgentAccount, EconomyLedger, Transaction, TransactionType } from "../../../src/domain/economy/economy-types.js";

describe("economy-types", () => {
	it("AgentAccount accepts valid account", () => {
		const account: AgentAccount = {
			xp: 1250, level: 5, coin: 340, tokens: 5000,
			totalEarned: { xp: 1250, coin: 780 },
			totalSpent: { coin: 440, tokens: 32000 },
		};
		expect(account.level).toBe(5);
	});

	it("EconomyLedger accepts valid ledger", () => {
		const ledger: EconomyLedger = {
			version: 1, updatedAt: "2026-03-21T10:00:00Z",
			accounts: { auditor: { xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
		};
		expect(ledger.version).toBe(1);
	});

	it("Transaction accepts valid entry", () => {
		const tx: Transaction = { ts: "2026-03-21T10:30:00Z", agent: "auditor", type: "task-reward", taskId: "task-001", xp: 50, coin: 25 };
		expect(tx.type).toBe("task-reward");
	});

	it("TransactionType includes all types", () => {
		const types: TransactionType[] = ["task-reward", "standing-order-reward", "delegation-fee", "delegation-cut", "spend", "llm-spend", "grant", "purchase", "debug"];
		expect(types).toHaveLength(9);
	});
});
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/economy-types.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/economy/economy-types.ts" "01 - Projects/Flowti CLI/tests/domain/economy/economy-types.test.ts"
git commit -m "feat(economy): add economy type definitions"
```

---

### Task 5: Leveling System

**Files:**
- Create: `src/domain/economy/leveling.ts`
- Test: `tests/domain/economy/leveling.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/economy/leveling.test.ts
import { describe, it, expect } from "vitest";
import { levelForXp, xpForLevel, titleForLevel, isEligible, LEVEL_TABLE } from "../../../src/domain/economy/leveling.js";

describe("leveling", () => {
	describe("levelForXp", () => {
		it("returns level 1 for 0 XP", () => {
			expect(levelForXp(0)).toBe(1);
		});

		it("returns level 2 for 100 XP", () => {
			expect(levelForXp(100)).toBe(2);
		});

		it("returns level 2 for 299 XP", () => {
			expect(levelForXp(299)).toBe(2);
		});

		it("returns level 3 for 300 XP", () => {
			expect(levelForXp(300)).toBe(3);
		});

		it("returns level 5 for 1000 XP", () => {
			expect(levelForXp(1000)).toBe(5);
		});

		it("returns level 8 for 3000+ XP", () => {
			expect(levelForXp(5000)).toBe(8);
		});
	});

	describe("xpForLevel", () => {
		it("returns 0 for level 1", () => {
			expect(xpForLevel(1)).toBe(0);
		});

		it("returns 300 for level 3", () => {
			expect(xpForLevel(3)).toBe(300);
		});

		it("returns 3000 for level 8", () => {
			expect(xpForLevel(8)).toBe(3000);
		});
	});

	describe("titleForLevel", () => {
		it("returns Novice for level 1", () => {
			expect(titleForLevel(1)).toBe("Novice");
		});

		it("returns Grandmaster for level 8", () => {
			expect(titleForLevel(8)).toBe("Grandmaster");
		});
	});

	describe("isEligible", () => {
		it("level 3 is eligible for vault-write purchase", () => {
			expect(isEligible(3, "vault-write")).toBe(true);
		});

		it("level 2 is not eligible for vault-write purchase", () => {
			expect(isEligible(2, "vault-write")).toBe(false);
		});

		it("level 4 is eligible for delegation", () => {
			expect(isEligible(4, "delegation")).toBe(true);
		});
	});

	describe("LEVEL_TABLE", () => {
		it("has 8 levels", () => {
			expect(LEVEL_TABLE).toHaveLength(8);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/leveling.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domain/economy/leveling.ts

export interface LevelEntry {
	readonly level: number;
	readonly xpRequired: number;
	readonly title: string;
	readonly unlocks: readonly string[];
}

export const LEVEL_TABLE: readonly LevelEntry[] = [
	{ level: 1, xpRequired: 0,    title: "Novice",      unlocks: ["vault-read", "simple-tasks"] },
	{ level: 2, xpRequired: 100,  title: "Apprentice",  unlocks: ["standing-orders"] },
	{ level: 3, xpRequired: 300,  title: "Journeyman",  unlocks: ["vault-write", "self-proposed"] },
	{ level: 4, xpRequired: 600,  title: "Artisan",     unlocks: ["delegation", "journey"] },
	{ level: 5, xpRequired: 1000, title: "Senior",      unlocks: ["auto-trust", "higher-token-budget"] },
	{ level: 6, xpRequired: 1500, title: "Expert",      unlocks: ["cross-domain"] },
	{ level: 7, xpRequired: 2200, title: "Master",      unlocks: ["mentoring"] },
	{ level: 8, xpRequired: 3000, title: "Grandmaster",  unlocks: ["full-autonomy", "economy-influence"] },
];

const CAPABILITY_MIN_LEVEL: Readonly<Record<string, number>> = {
	"vault-read": 1,
	"simple-tasks": 1,
	"standing-orders": 2,
	"vault-write": 3,
	"self-proposed": 3,
	"delegation": 4,
	"journey": 4,
	"auto-trust": 5,
	"higher-token-budget": 5,
	"cross-domain": 6,
	"mentoring": 7,
	"full-autonomy": 8,
	"economy-influence": 8,
};

export function levelForXp(xp: number): number {
	let result = 1;
	for (const entry of LEVEL_TABLE) {
		if (xp >= entry.xpRequired) result = entry.level;
	}
	return result;
}

export function xpForLevel(level: number): number {
	const entry = LEVEL_TABLE.find(e => e.level === level);
	return entry?.xpRequired ?? 0;
}

export function titleForLevel(level: number): string {
	const entry = LEVEL_TABLE.find(e => e.level === level);
	return entry?.title ?? "Unknown";
}

export function isEligible(level: number, capability: string): boolean {
	const minLevel = CAPABILITY_MIN_LEVEL[capability];
	return minLevel !== undefined && level >= minLevel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/leveling.test.ts --config configs/vitest.config.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/economy/leveling.ts" "01 - Projects/Flowti CLI/tests/domain/economy/leveling.test.ts"
git commit -m "feat(economy): add leveling system with 8 tiers"
```

---

### Task 6: Economy Ledger

**Files:**
- Create: `src/domain/economy/economy-ledger.ts`
- Test: `tests/domain/economy/economy-ledger.test.ts`

The ledger manages `.flowti/var/economy.json` (balances) and `.flowti/var/economy-log.jsonl` (append-only transactions). All operations receive deps via injection.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/economy/economy-ledger.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readLedger, writeLedger, getAccount, creditReward, debitCoin, debitTokens, grantResources, appendTransaction } from "../../../src/domain/economy/economy-ledger.js";
import type { EconomyLedger } from "../../../src/domain/economy/economy-types.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
		clock: { iso: () => "2026-03-21T10:00:00Z" },
	};
}

const EMPTY_LEDGER: EconomyLedger = { version: 1, updatedAt: "", accounts: {} };

describe("economy-ledger", () => {
	describe("readLedger", () => {
		it("returns empty ledger when file missing", () => {
			const deps = makeDeps();
			const ledger = readLedger(deps, "/vault");
			expect(ledger.accounts).toEqual({});
			expect(ledger.version).toBe(1);
		});

		it("parses existing ledger", () => {
			const existing: EconomyLedger = {
				version: 1, updatedAt: "2026-03-21T09:00:00Z",
				accounts: { auditor: { xp: 100, level: 2, coin: 50, tokens: 1000, totalEarned: { xp: 100, coin: 50 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const deps = makeDeps({ "/vault/.flowti/var/economy.json": JSON.stringify(existing) });
			const ledger = readLedger(deps, "/vault");
			expect(ledger.accounts.auditor.xp).toBe(100);
		});
	});

	describe("getAccount", () => {
		it("returns default account for unknown agent", () => {
			const account = getAccount(EMPTY_LEDGER, "newbie");
			expect(account.xp).toBe(0);
			expect(account.level).toBe(1);
			expect(account.coin).toBe(0);
			expect(account.tokens).toBe(0);
		});

		it("returns existing account", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 500, level: 3, coin: 200, tokens: 3000, totalEarned: { xp: 500, coin: 300 }, totalSpent: { coin: 100, tokens: 1000 } } },
			};
			const account = getAccount(ledger, "auditor");
			expect(account.xp).toBe(500);
			expect(account.level).toBe(3);
		});
	});

	describe("creditReward", () => {
		it("adds XP and Coin to agent account", () => {
			const result = creditReward(EMPTY_LEDGER, "auditor", { xp: 50, coin: 25 });
			expect(result.ledger.accounts.auditor.xp).toBe(50);
			expect(result.ledger.accounts.auditor.coin).toBe(25);
			expect(result.reward.xp).toBe(50);
			expect(result.reward.coin).toBe(25);
		});

		it("triggers level-up when XP crosses threshold", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 90, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 90, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = creditReward(ledger, "auditor", { xp: 20, coin: 0 });
			expect(result.ledger.accounts.auditor.level).toBe(2);
			expect(result.reward.leveledUp).toBe(true);
			expect(result.reward.newLevel).toBe(2);
		});

		it("accumulates totalEarned", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 50, level: 1, coin: 20, tokens: 0, totalEarned: { xp: 50, coin: 20 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = creditReward(ledger, "auditor", { xp: 30, coin: 10 });
			expect(result.ledger.accounts.auditor.totalEarned).toEqual({ xp: 80, coin: 30 });
		});
	});

	describe("debitCoin", () => {
		it("deducts Coin from account", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 100, tokens: 0, totalEarned: { xp: 0, coin: 100 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = debitCoin(ledger, "auditor", 30);
			expect(result).not.toBeNull();
			expect(result!.accounts.auditor.coin).toBe(70);
			expect(result!.accounts.auditor.totalSpent.coin).toBe(30);
		});

		it("returns null if insufficient balance", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 10, tokens: 0, totalEarned: { xp: 0, coin: 10 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			expect(debitCoin(ledger, "auditor", 20)).toBeNull();
		});
	});

	describe("debitTokens", () => {
		it("deducts Tokens from account", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 0, tokens: 5000, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			const result = debitTokens(ledger, "auditor", 1200);
			expect(result).not.toBeNull();
			expect(result!.accounts.auditor.tokens).toBe(3800);
		});

		it("returns null if insufficient tokens", () => {
			const ledger: EconomyLedger = {
				...EMPTY_LEDGER,
				accounts: { auditor: { xp: 0, level: 1, coin: 0, tokens: 100, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } } },
			};
			expect(debitTokens(ledger, "auditor", 200)).toBeNull();
		});
	});

	describe("grantResources", () => {
		it("adds Coin and Tokens to account", () => {
			const result = grantResources(EMPTY_LEDGER, "auditor", { coin: 100, tokens: 5000 });
			expect(result.accounts.auditor.coin).toBe(100);
			expect(result.accounts.auditor.tokens).toBe(5000);
		});
	});

	describe("writeLedger", () => {
		it("writes ledger to disk", () => {
			const deps = makeDeps();
			writeLedger(deps, "/vault", EMPTY_LEDGER);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/economy.json",
				expect.any(String),
			);
		});
	});

	describe("appendTransaction", () => {
		it("appends JSONL line to transaction log", () => {
			const deps = makeDeps();
			appendTransaction(deps, "/vault", { ts: "2026-03-21T10:00:00Z", agent: "auditor", type: "task-reward", xp: 50, coin: 25 });
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/economy-log.jsonl",
				expect.stringContaining('"task-reward"'),
			);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/economy-ledger.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/domain/economy/economy-ledger.ts
import type { AgentAccount, EconomyLedger, Transaction, RewardResult } from "./economy-types.js";
import { levelForXp } from "./leveling.js";

const LEDGER_PATH = ".flowti/var/economy.json";
const LOG_PATH = ".flowti/var/economy-log.jsonl";

type LedgerDeps = {
	readonly disk: { existsSync(p: string): boolean; readFileSync(p: string, enc?: string): string; writeFileSync(p: string, c: string): void; mkdirSync(p: string, opts?: { recursive?: boolean }): void };
	readonly paths: { join(...segs: string[]): string; dirname(p: string): string };
	readonly clock?: { iso(): string };
};

const DEFAULT_ACCOUNT: AgentAccount = {
	xp: 0, level: 1, coin: 0, tokens: 0,
	totalEarned: { xp: 0, coin: 0 },
	totalSpent: { coin: 0, tokens: 0 },
};

export function readLedger(deps: LedgerDeps, vaultRoot: string): EconomyLedger {
	const path = deps.paths.join(vaultRoot, LEDGER_PATH);
	if (!deps.disk.existsSync(path)) return { version: 1, updatedAt: "", accounts: {} };
	const raw = deps.disk.readFileSync(path, "utf-8");
	return JSON.parse(raw) as EconomyLedger;
}

export function writeLedger(deps: LedgerDeps, vaultRoot: string, ledger: EconomyLedger): void {
	const path = deps.paths.join(vaultRoot, LEDGER_PATH);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	const updated: EconomyLedger = { ...ledger, updatedAt: deps.clock?.iso() ?? new Date().toISOString() };
	deps.disk.writeFileSync(path, JSON.stringify(updated, null, "\t"));
}

export function getAccount(ledger: EconomyLedger, agent: string): AgentAccount {
	return ledger.accounts[agent] ?? { ...DEFAULT_ACCOUNT };
}

export function creditReward(
	ledger: EconomyLedger,
	agent: string,
	reward: { readonly xp: number; readonly coin: number },
): { readonly ledger: EconomyLedger; readonly reward: RewardResult } {
	const prev = getAccount(ledger, agent);
	const newXp = prev.xp + reward.xp;
	const newLevel = levelForXp(newXp);
	const leveledUp = newLevel > prev.level;

	const updated: AgentAccount = {
		...prev,
		xp: newXp,
		level: newLevel,
		coin: prev.coin + reward.coin,
		totalEarned: { xp: prev.totalEarned.xp + reward.xp, coin: prev.totalEarned.coin + reward.coin },
	};

	return {
		ledger: { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } },
		reward: { xp: reward.xp, coin: reward.coin, leveledUp, newLevel: leveledUp ? newLevel : undefined },
	};
}

export function debitCoin(ledger: EconomyLedger, agent: string, amount: number): EconomyLedger | null {
	const prev = getAccount(ledger, agent);
	if (prev.coin < amount) return null;
	const updated: AgentAccount = {
		...prev,
		coin: prev.coin - amount,
		totalSpent: { ...prev.totalSpent, coin: prev.totalSpent.coin + amount },
	};
	return { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } };
}

export function debitTokens(ledger: EconomyLedger, agent: string, amount: number): EconomyLedger | null {
	const prev = getAccount(ledger, agent);
	if (prev.tokens < amount) return null;
	const updated: AgentAccount = {
		...prev,
		tokens: prev.tokens - amount,
		totalSpent: { ...prev.totalSpent, tokens: prev.totalSpent.tokens + amount },
	};
	return { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } };
}

export function grantResources(ledger: EconomyLedger, agent: string, grant: { readonly coin?: number; readonly tokens?: number }): EconomyLedger {
	const prev = getAccount(ledger, agent);
	const updated: AgentAccount = {
		...prev,
		coin: prev.coin + (grant.coin ?? 0),
		tokens: prev.tokens + (grant.tokens ?? 0),
		totalEarned: { ...prev.totalEarned, coin: prev.totalEarned.coin + (grant.coin ?? 0) },
	};
	return { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } };
}

export function appendTransaction(deps: LedgerDeps, vaultRoot: string, tx: Transaction): void {
	const path = deps.paths.join(vaultRoot, LOG_PATH);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	const existing = deps.disk.existsSync(path) ? deps.disk.readFileSync(path, "utf-8") : "";
	deps.disk.writeFileSync(path, existing + JSON.stringify(tx) + "\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/economy-ledger.test.ts --config configs/vitest.config.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/economy/economy-ledger.ts" "01 - Projects/Flowti CLI/tests/domain/economy/economy-ledger.test.ts"
git commit -m "feat(economy): add economy ledger with credit/debit operations"
```

---

### Task 7: Reward Rules

**Files:**
- Create: `src/domain/economy/economy-rules.ts`
- Test: `tests/domain/economy/economy-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/economy/economy-rules.test.ts
import { describe, it, expect } from "vitest";
import { calculateReward } from "../../../src/domain/economy/economy-rules.js";

describe("economy-rules", () => {
	describe("calculateReward", () => {
		it("returns base reward for auto trust tier", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: false, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 50, coin: 25 });
		});

		it("applies 1.2x multiplier for review trust tier", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "review", isFirstCompletion: false, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 60, coin: 30 });
		});

		it("applies 1.5x multiplier for first completion", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: true, isStandingOrder: false, isDelegation: false });
			expect(result).toEqual({ xp: 75, coin: 37 });
		});

		it("applies 0.3x multiplier for standing orders", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: false, isStandingOrder: true, isDelegation: false });
			expect(result).toEqual({ xp: 15, coin: 8 });
		});

		it("applies 0.2x multiplier for delegation cut", () => {
			const result = calculateReward({ xp: 50, coin: 25 }, { trustTier: "auto", isFirstCompletion: false, isStandingOrder: false, isDelegation: true });
			expect(result).toEqual({ xp: 10, coin: 5 });
		});

		it("multipliers stack: review + first completion", () => {
			const result = calculateReward({ xp: 100, coin: 50 }, { trustTier: "review", isFirstCompletion: true, isStandingOrder: false, isDelegation: false });
			// 100 * 1.2 * 1.5 = 180, 50 * 1.2 * 1.5 = 90
			expect(result).toEqual({ xp: 180, coin: 90 });
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/economy-rules.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/domain/economy/economy-rules.ts
import type { TaskTrustTier } from "../tasks/task-types.js";

interface RewardContext {
	readonly trustTier: TaskTrustTier;
	readonly isFirstCompletion: boolean;
	readonly isStandingOrder: boolean;
	readonly isDelegation: boolean;
}

const TRUST_MULTIPLIER: Readonly<Record<TaskTrustTier, number>> = {
	auto: 1.0,
	review: 1.2,
	manual: 1.0,
};

export function calculateReward(
	base: { readonly xp: number; readonly coin: number },
	ctx: RewardContext,
): { readonly xp: number; readonly coin: number } {
	let multiplier = TRUST_MULTIPLIER[ctx.trustTier];
	if (ctx.isFirstCompletion) multiplier *= 1.5;
	if (ctx.isStandingOrder) multiplier *= 0.3;
	if (ctx.isDelegation) multiplier *= 0.2;

	return {
		xp: Math.round(base.xp * multiplier),
		coin: Math.round(base.coin * multiplier),
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/economy-rules.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/economy/economy-rules.ts" "01 - Projects/Flowti CLI/tests/domain/economy/economy-rules.test.ts"
git commit -m "feat(economy): add reward calculation rules with multipliers"
```

---

## Chunk 3: CLI Commands & Renderers

### Task 8: Task Controller

**Files:**
- Create: `src/controller/task.controller.ts`
- Create: `src/ui/task-display.ts`
- Test: `tests/controller/task.controller.test.ts`
- Reference: `src/infrastructure/command-engine.ts` for `adaptDescriptor()`, `src/controller/agent.controller.ts` for pattern

- [ ] **Step 1: Write the renderer**

```typescript
// src/ui/task-display.ts
import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../infrastructure/ui.js";

interface TaskListEntry {
	readonly id: string;
	readonly title: string;
	readonly type: string;
	readonly status: string;
	readonly assignee: string;
	readonly priority: string;
	readonly reward: { readonly xp: number; readonly coin: number };
}

const STATUS_COLOR: Record<string, string> = {
	proposed: YELLOW,
	pending: DIM,
	assigned: CYAN,
	"in-progress": BOLD,
	review: YELLOW,
	completed: GREEN,
	failed: RED,
};

export function renderTaskList(data: { readonly tasks: readonly TaskListEntry[] }, log: (msg?: string) => void): void {
	if (data.tasks.length === 0) {
		log(`${DIM}No tasks found.${RESET}`);
		return;
	}
	log(`${BOLD}Tasks (${data.tasks.length})${RESET}\n`);
	for (const t of data.tasks) {
		const color = STATUS_COLOR[t.status] ?? "";
		log(`  ${DIM}${t.id}${RESET}  ${color}${t.status}${RESET}  ${t.title}  ${DIM}[${t.type}]${RESET}  ${t.assignee ? `-> ${t.assignee}` : ""}  ${DIM}+${t.reward.xp}xp +${t.reward.coin}c${RESET}`);
	}
}

export function renderTaskCreated(data: { readonly id: string; readonly title: string }, log: (msg?: string) => void): void {
	log(`${GREEN}Created${RESET} task ${BOLD}${data.id}${RESET}: ${data.title}`);
}

export function renderTaskUpdated(data: { readonly id: string; readonly field: string; readonly value: string }, log: (msg?: string) => void): void {
	log(`${GREEN}Updated${RESET} task ${BOLD}${data.id}${RESET}: ${data.field} -> ${data.value}`);
}
```

- [ ] **Step 2: Write the controller**

```typescript
// src/controller/task.controller.ts
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { taskStore } from "../domain/tasks/task-store.js";
import { canTransition } from "../domain/tasks/task-lifecycle.js";
import { renderTaskList, renderTaskCreated, renderTaskUpdated } from "../ui/task-display.js";

import { VAULT_ROOT } from "../infrastructure/config.js";

export const commands: Record<string, CommandHandler> = {
	"task:list": adaptDescriptor({
		flags: {
			status: { type: "string", default: "", hint: "--status=<status>" },
			assignee: { type: "string", default: "", hint: "--assignee=<name>" },
		},
		handler: (ctx) => {
			const all = taskStore.list(ctx.deps, VAULT_ROOT);
			const filtered = all.filter(t => {
				if (ctx.flags.status && t.status !== ctx.flags.status) return false;
				if (ctx.flags.assignee && t.assignee !== ctx.flags.assignee) return false;
				return true;
			});
			return { tasks: filtered };
		},
		renderer: renderTaskList,
	}),

	"task:create": adaptDescriptor({
		flags: {
			title: { type: "string", required: true, hint: "--title=<text>" },
			type: { type: "string", default: "one-off", choices: ["one-off", "standing-order", "delegated", "self-proposed"], hint: "--type=<type>" },
			assignee: { type: "string", default: "", hint: "--assignee=<name>" },
			priority: { type: "string", default: "normal", choices: ["normal", "high", "urgent"], hint: "--priority=<level>" },
			trustTier: { type: "string", default: "review", choices: ["auto", "review", "manual"], hint: "--trust=<tier>" },
			xp: { type: "number", default: 50, hint: "--xp=<amount>" },
			coin: { type: "number", default: 25, hint: "--coin=<amount>" },
		},
		handler: (ctx) => {
			const id = taskStore.nextId?.(ctx.deps, VAULT_ROOT) ?? `task-${Date.now()}`;
			const def = {
				id,
				type: ctx.flags.type as "one-off",
				title: ctx.flags.title as string,
				assignee: ctx.flags.assignee as string,
				creator: "director",
				priority: ctx.flags.priority as "normal",
				trustTier: ctx.flags.trustTier as "review",
				status: "pending" as const,
				reward: { xp: ctx.flags.xp as number, coin: ctx.flags.coin as number },
				tags: [],
				createdAt: ctx.deps.clock.iso(),
			};
			taskStore.create(ctx.deps, VAULT_ROOT, def);
			return { id, title: def.title };
		},
		renderer: renderTaskCreated,
	}),

	"task:assign": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<task-id>" },
			to: { type: "string", required: true, hint: "--to=<agent-name>" },
		},
		handler: (ctx) => {
			const task = taskStore.read(ctx.deps, VAULT_ROOT, ctx.flags.id as string);
			if (!task) return { id: ctx.flags.id as string, field: "error", value: "task not found" };
			if (!canTransition(task.status, "assigned")) return { id: task.id, field: "error", value: `cannot assign from status ${task.status}` };
			taskStore.updateField(ctx.deps, VAULT_ROOT, task.id, "assignee", ctx.flags.to as string);
			taskStore.updateField(ctx.deps, VAULT_ROOT, task.id, "status", "assigned");
			return { id: task.id, field: "assignee", value: ctx.flags.to as string };
		},
		renderer: renderTaskUpdated,
	}),
};
```

- [ ] **Step 3: Write controller tests**

```typescript
// tests/controller/task.controller.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", BG_RED: "", BG_GREEN: "", BG_YELLOW: "" }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { commands } from "../../src/controller/task.controller.js";

describe("task.controller", () => {
	it("exports task:list command", () => {
		expect(commands["task:list"]).toBeDefined();
	});

	it("exports task:create command", () => {
		expect(commands["task:create"]).toBeDefined();
	});

	it("exports task:assign command", () => {
		expect(commands["task:assign"]).toBeDefined();
	});
});
```

Note: Full handler testing requires `createProjectContext()` from `tests/helpers/command-test-utils.ts`. Extend tests with integration-style tests once the store is wired.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/task.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/task.controller.ts" "01 - Projects/Flowti CLI/src/ui/task-display.ts" "01 - Projects/Flowti CLI/tests/controller/task.controller.test.ts"
git commit -m "feat(tasks): add task CLI commands and renderers"
```

---

### Task 9: Economy Controller

**Files:**
- Create: `src/controller/economy.controller.ts`
- Create: `src/ui/economy-display.ts`
- Test: `tests/controller/economy.controller.test.ts`

- [ ] **Step 1: Write the renderer**

```typescript
// src/ui/economy-display.ts
import { BOLD, RESET, DIM, GREEN, YELLOW, CYAN } from "../infrastructure/ui.js";
import { titleForLevel } from "../domain/economy/leveling.js";

interface BalanceModel {
	readonly agent: string;
	readonly xp: number;
	readonly level: number;
	readonly title: string;
	readonly coin: number;
	readonly tokens: number;
}

interface LedgerModel {
	readonly agent: string;
	readonly entries: readonly { readonly ts: string; readonly type: string; readonly xp?: number; readonly coin?: number; readonly tokens?: number }[];
}

interface GrantModel {
	readonly agent: string;
	readonly coin: number;
	readonly tokens: number;
}

export function renderBalance(data: BalanceModel, log: (msg?: string) => void): void {
	log(`${BOLD}${data.agent}${RESET} — Level ${data.level} ${DIM}(${data.title})${RESET}`);
	log(`  XP:     ${CYAN}${data.xp}${RESET}`);
	log(`  Coin:   ${YELLOW}${data.coin}${RESET}`);
	log(`  Tokens: ${DIM}${data.tokens}${RESET}`);
}

export function renderLedger(data: LedgerModel, log: (msg?: string) => void): void {
	log(`${BOLD}Transaction log for ${data.agent}${RESET} (${data.entries.length} entries)\n`);
	for (const e of data.entries) {
		const parts = [e.ts, e.type];
		if (e.xp) parts.push(`+${e.xp}xp`);
		if (e.coin) parts.push(`${e.coin > 0 ? "+" : ""}${e.coin}c`);
		if (e.tokens) parts.push(`${e.tokens}t`);
		log(`  ${DIM}${parts.join("  ")}${RESET}`);
	}
}

export function renderGrant(data: GrantModel, log: (msg?: string) => void): void {
	log(`${GREEN}Granted${RESET} to ${BOLD}${data.agent}${RESET}: +${data.coin} Coin, +${data.tokens} Tokens`);
}
```

- [ ] **Step 2: Write the controller**

```typescript
// src/controller/economy.controller.ts
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { readLedger, writeLedger, getAccount, grantResources, appendTransaction } from "../domain/economy/economy-ledger.js";
import { titleForLevel } from "../domain/economy/leveling.js";
import { renderBalance, renderLedger, renderGrant } from "../ui/economy-display.js";

import { VAULT_ROOT } from "../infrastructure/config.js";

export const commands: Record<string, CommandHandler> = {
	"economy:balance": adaptDescriptor({
		flags: { agent: { type: "string", required: true, hint: "--agent=<name>" } },
		handler: (ctx) => {
			const ledger = readLedger(ctx.deps, VAULT_ROOT);
			const account = getAccount(ledger, ctx.flags.agent as string);
			return {
				agent: ctx.flags.agent as string,
				xp: account.xp,
				level: account.level,
				title: titleForLevel(account.level),
				coin: account.coin,
				tokens: account.tokens,
			};
		},
		renderer: renderBalance,
	}),

	"economy:ledger": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			last: { type: "number", default: 20, hint: "--last=<count>" },
		},
		handler: (ctx) => {
			const logPath = ctx.deps.paths.join(VAULT_ROOT, ".flowti/var/economy-log.jsonl");
			if (!ctx.deps.disk.existsSync(logPath)) return { agent: ctx.flags.agent as string, entries: [] };
			const raw = ctx.deps.disk.readFileSync(logPath, "utf-8");
			const lines = raw.trim().split("\n").filter(Boolean);
			const all = lines.map(l => JSON.parse(l)).filter((e: { agent: string }) => e.agent === ctx.flags.agent);
			const last = ctx.flags.last as number;
			return { agent: ctx.flags.agent as string, entries: all.slice(-last) };
		},
		renderer: renderLedger,
	}),

	"economy:grant": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			coin: { type: "number", default: 0, hint: "--coin=<amount>" },
			tokens: { type: "number", default: 0, hint: "--tokens=<amount>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const coin = ctx.flags.coin as number;
			const tokens = ctx.flags.tokens as number;
			let ledger = readLedger(ctx.deps, VAULT_ROOT);
			ledger = grantResources(ledger, agent, { coin, tokens });
			writeLedger(ctx.deps, VAULT_ROOT, ledger);
			appendTransaction(ctx.deps, VAULT_ROOT, {
				ts: ctx.deps.clock.iso(), agent, type: "grant", coin, tokens,
			});
			return { agent, coin, tokens };
		},
		renderer: renderGrant,
	}),
};
```

- [ ] **Step 3: Write controller tests**

```typescript
// tests/controller/economy.controller.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", BG_RED: "", BG_GREEN: "", BG_YELLOW: "" }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { commands } from "../../src/controller/economy.controller.js";

describe("economy.controller", () => {
	it("exports economy:balance command", () => {
		expect(commands["economy:balance"]).toBeDefined();
	});

	it("exports economy:ledger command", () => {
		expect(commands["economy:ledger"]).toBeDefined();
	});

	it("exports economy:grant command", () => {
		expect(commands["economy:grant"]).toBeDefined();
	});
});
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/economy.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite + type check**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts && npx tsc --noEmit --project configs/tsconfig.json`
Expected: All existing tests still pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/economy.controller.ts" "01 - Projects/Flowti CLI/src/ui/economy-display.ts" "01 - Projects/Flowti CLI/tests/controller/economy.controller.test.ts"
git commit -m "feat(economy): add economy CLI commands and renderers"
```

---

### Task 10: Register Commands & Wire to Main

**Files:**
- Modify: `src/main.ts` — register new controllers in CommandRegistry
- Test: verify CLI commands are callable

- [ ] **Step 1: Read current main.ts to find the registration pattern**

Check how existing controllers are imported and registered. Look for the `CommandRegistry` or similar registration point.

- [ ] **Step 2: Add task and economy controller imports**

Add to the imports section:
```typescript
import { commands as taskCommands } from "./controller/task.controller.js";
import { commands as economyCommands } from "./controller/economy.controller.js";
```

Add to the registration section (follow the existing pattern for registering command records):
```typescript
Object.entries(taskCommands).forEach(([name, handler]) => registry.register(name, handler));
Object.entries(economyCommands).forEach(([name, handler]) => registry.register(name, handler));
```

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass (existing + new)

- [ ] **Step 4: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Build and verify**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat: register task and economy commands in CLI"
```

---

## Phase A Complete

After all 10 tasks, Phase A delivers:

| Domain | Files | What it does |
|--------|-------|-------------|
| `src/domain/tasks/` | 3 files | Task types, lifecycle state machine, CRUD store |
| `src/domain/economy/` | 4 files | Economy types, leveling (8 tiers), ledger (credit/debit/grant), reward rules |
| `src/controller/` | 2 files | `task:list/create/assign`, `economy:balance/ledger/grant` |
| `src/ui/` | 2 files | Task and economy renderers |
| `tests/` | 7 files | Full test coverage for all domain and controller code |

**Next phases** (separate plans after Phase A ships):
- **Phase B:** Trust manager, vault operations, staging area, standing orders, journey checkpoint format
- **Phase C:** NPC agent type (CLI+Plugin), merchant catalog, shop interaction, delegation
- **Phase D:** WorkerManager routing, journey integration, pet utility, visuals, debug panel
