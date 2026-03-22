import { describe, it, expect } from "vitest";
import {
	evaluateRules,
	evaluateEvent,
	recordStandingOrderRun,
} from "../../../src/domain/vault-ops/standing-order-evaluator.js";
import type { VaultOpsDeps, VaultEvent, VaultTagRequest } from "../../../src/domain/vault-ops/vault-ops-types.js";
import type { StandingOrderRule, StandingOrderPayload } from "../../../src/domain/tasks/task-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function makeDeps(files: Record<string, string> = {}): VaultOpsDeps {
	return {
		disk: {
			existsSync: (p: string) => p in files,
			readFileSync: (p: string) => {
				if (!(p in files)) throw new Error(`ENOENT: ${p}`);
				return files[p];
			},
			writeFileSync: () => undefined,
			mkdirSync: () => undefined,
			renameSync: () => undefined,
			readdirSync: () => [],
			statSync: () => ({ mtimeMs: 0 }),
			rmSync: () => undefined,
		},
		clock: { iso: () => "2026-03-22T12:00:00Z" },
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (_from: string, to: string) => to,
		},
		vaultRoot: "/vault",
	};
}

function makeMarkdown(tags: string[]): string {
	if (tags.length === 0) return "# No tags\n\nBody text.";
	const tagLines = tags.map((t) => `  - ${t}`).join("\n");
	return `---\ntags:\n${tagLines}\n---\n\n# Note\n\nBody text.`;
}

function makeRule(missing: string[], action = "tag", value = "reviewed"): StandingOrderRule {
	return {
		match: { tags: { missing } },
		action,
		value,
	};
}

function makePayload(
	rules: StandingOrderRule[],
	overrides: Partial<StandingOrderPayload> = {},
): StandingOrderPayload {
	return {
		watch: { folder: "03 - Resources", event: "vault-create" },
		rules,
		schedule: "on-event",
		runCount: 0,
		...overrides,
	};
}

// ── evaluateRules ────────────────────────────────────────────────────

describe("evaluateRules", () => {
	it("matches when file is missing a required tag", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": makeMarkdown(["project"]),
		});
		const rules = [makeRule(["reviewed"], "tag", "reviewed")];

		const result = evaluateRules(rules, "notes/hello.md", deps);

		expect(result).toEqual({ action: "tag", value: "reviewed" });
	});

	it("returns null when no rules match (file has the tag)", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": makeMarkdown(["reviewed", "project"]),
		});
		const rules = [makeRule(["reviewed"], "tag", "reviewed")];

		const result = evaluateRules(rules, "notes/hello.md", deps);

		expect(result).toBeNull();
	});

	it("returns first matching rule when multiple match", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": makeMarkdown([]),
		});
		const rules = [
			makeRule(["alpha"], "tag", "first-match"),
			makeRule(["beta"], "tag", "second-match"),
		];

		const result = evaluateRules(rules, "notes/hello.md", deps);

		expect(result).toEqual({ action: "tag", value: "first-match" });
	});

	it("returns null when file cannot be read", () => {
		const deps = makeDeps({});
		const rules = [makeRule(["reviewed"])];

		const result = evaluateRules(rules, "notes/missing.md", deps);

		expect(result).toBeNull();
	});
});

// ── evaluateEvent ────────────────────────────────────────────────────

describe("evaluateEvent", () => {
	it("returns vault-tag request for matching standing order", () => {
		const noteContent = makeMarkdown(["project"]);
		const payload = makePayload([makeRule(["reviewed"], "tag", "reviewed")]);
		const deps = makeDeps({
			"/vault/notes/new-note.md": noteContent,
			"/vault/docs/tasks/task-001.json": JSON.stringify(payload),
		});

		const tasks = [
			{
				id: "task-001",
				type: "standing-order",
				status: "assigned",
				assignee: "bob",
				standingOrder: {
					watch: { folder: "notes", event: "vault-create" },
					rules: payload.rules,
					schedule: "on-event" as const,
					runCount: 0,
				},
			},
		];

		const event: VaultEvent = {
			folder: "notes",
			type: "vault-create",
			path: "notes/new-note.md",
			at: "2026-03-22T12:00:00Z",
		};

		const result = evaluateEvent(event, tasks, deps);

		expect(result).toHaveLength(1);
		const req = result[0] as VaultTagRequest;
		expect(req.operation).toBe("vault-tag");
		expect(req.agentName).toBe("bob");
		expect(req.taskId).toBe("task-001");
		expect(req.path).toBe("notes/new-note.md");
		expect(req.addTags).toEqual(["reviewed"]);
	});

	it("returns empty array when no orders match", () => {
		const deps = makeDeps({});
		const tasks = [
			{
				id: "task-002",
				type: "standing-order",
				status: "assigned",
				assignee: "alice",
				standingOrder: {
					watch: { folder: "archive", event: "vault-create" },
					rules: [],
					schedule: "on-event" as const,
					runCount: 0,
				},
			},
		];

		const event: VaultEvent = {
			folder: "notes",
			type: "vault-create",
			path: "notes/unrelated.md",
			at: "2026-03-22T12:00:00Z",
		};

		const result = evaluateEvent(event, tasks, deps);

		expect(result).toEqual([]);
	});

	it("handles missing payload JSON gracefully", () => {
		const deps = makeDeps({});

		const tasks = [
			{
				id: "task-003",
				type: "standing-order",
				status: "assigned",
				assignee: "bob",
				standingOrder: {
					watch: { folder: "notes", event: "vault-create" },
					rules: [makeRule(["reviewed"])],
					schedule: "on-event" as const,
					runCount: 0,
				},
			},
		];

		const event: VaultEvent = {
			folder: "notes",
			type: "vault-create",
			path: "notes/test.md",
			at: "2026-03-22T12:00:00Z",
		};

		const result = evaluateEvent(event, tasks, deps);

		expect(result).toEqual([]);
	});
});

// ── recordStandingOrderRun ───────────────────────────────────────────

describe("recordStandingOrderRun", () => {
	it("increments runCount and updates lastRun", () => {
		const payload = makePayload([makeRule(["reviewed"])], { runCount: 3 });

		const result = recordStandingOrderRun(payload, "2026-03-22T15:00:00Z");

		expect(result.runCount).toBe(4);
		expect(result.lastRun).toBe("2026-03-22T15:00:00Z");
	});

	it("preserves all other payload fields", () => {
		const rules = [makeRule(["alpha"]), makeRule(["beta"])];
		const payload = makePayload(rules, {
			runCount: 7,
			lastRun: "2026-03-20T10:00:00Z",
			schedule: "interval",
		});

		const result = recordStandingOrderRun(payload, "2026-03-22T18:00:00Z");

		expect(result.watch).toEqual(payload.watch);
		expect(result.rules).toEqual(payload.rules);
		expect(result.schedule).toBe("interval");
		expect(result.runCount).toBe(8);
		expect(result.lastRun).toBe("2026-03-22T18:00:00Z");
	});
});
