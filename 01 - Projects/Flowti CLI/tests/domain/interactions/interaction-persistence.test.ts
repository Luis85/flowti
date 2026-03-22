import { describe, it, expect, vi } from "vitest";
import {
	appendInteraction,
	loadHistory,
	restoreCooldowns,
} from "../../../src/domain/interactions/interaction-persistence.js";
import type { PersistenceDeps } from "../../../src/domain/interactions/interaction-persistence.js";
import { HISTORY_BUFFER_SIZE } from "../../../src/domain/interactions/interaction-types.js";
import type {
	Interaction,
	EntityRef,
	InteractionContext,
	InteractionEffect,
} from "../../../src/domain/interactions/interaction-types.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeDeps(files: Record<string, string> = {}): PersistenceDeps {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			appendFileSync: vi.fn((p: string, data: string) => {
				store[p] = (store[p] ?? "") + data;
			}),
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
	};
}

function makeInteraction(overrides: Partial<Interaction> = {}): Interaction {
	const initiator: EntityRef = { id: "agent-1", entityType: "agent" };
	const target: EntityRef = { id: "agent-2", entityType: "agent" };
	const context: InteractionContext = { topic: "greeting" };
	const effects: readonly InteractionEffect[] = [
		{ type: "affinity-change", target: "initiator", amount: 1 },
	];
	return {
		id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		initiator,
		targets: [target],
		cardinality: "one-to-one",
		category: "social",
		action: "greet",
		priority: 50,
		context,
		cooldownMs: 5000,
		effects,
		timestamp: Date.now(),
		...overrides,
	};
}

// ── appendInteraction ──────────────────────────────────────────────────

describe("appendInteraction", () => {
	it("appends JSONL line with v:1 prefix", () => {
		const deps = makeDeps();
		const interaction = makeInteraction({ id: "int-001", timestamp: 1000 });

		appendInteraction(deps, "/my/project", interaction);

		const filePath = "/my/project/.flowti/var/interaction-log.jsonl";
		expect(deps.disk.appendFileSync).toHaveBeenCalledOnce();
		const call = vi.mocked(deps.disk.appendFileSync).mock.calls[0];
		expect(call[0]).toBe(filePath);
		const written = call[1] as string;
		expect(written.endsWith("\n")).toBe(true);
		const parsed = JSON.parse(written.trim()) as Record<string, unknown>;
		expect(parsed.v).toBe(1);
		expect(parsed.id).toBe("int-001");
		expect(parsed.timestamp).toBe(1000);
	});

	it("creates directory before appending", () => {
		const deps = makeDeps();
		const interaction = makeInteraction();

		appendInteraction(deps, "/proj", interaction);

		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
			"/proj/.flowti/var",
			{ recursive: true },
		);
	});

	it("calls mkdirSync before appendFileSync", () => {
		const order: string[] = [];
		const deps = makeDeps();
		vi.mocked(deps.disk.mkdirSync).mockImplementation(() => {
			order.push("mkdir");
		});
		vi.mocked(deps.disk.appendFileSync).mockImplementation(() => {
			order.push("append");
		});

		appendInteraction(deps, "/proj", makeInteraction());

		expect(order).toEqual(["mkdir", "append"]);
	});
});

// ── loadHistory ────────────────────────────────────────────────────────

describe("loadHistory", () => {
	it("returns empty array when file does not exist", () => {
		const deps = makeDeps();
		const result = loadHistory(deps, "/missing");
		expect(result).toEqual([]);
	});

	it("parses valid JSONL lines", () => {
		const interaction = makeInteraction({ id: "int-a", timestamp: 2000 });
		const line = JSON.stringify({ v: 1, ...interaction });
		const deps = makeDeps({
			"/proj/.flowti/var/interaction-log.jsonl": line + "\n",
		});

		const result = loadHistory(deps, "/proj");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("int-a");
		expect(result[0].timestamp).toBe(2000);
	});

	it("strips the v field from parsed objects", () => {
		const interaction = makeInteraction({ id: "int-b" });
		const line = JSON.stringify({ v: 1, ...interaction });
		const deps = makeDeps({
			"/proj/.flowti/var/interaction-log.jsonl": line + "\n",
		});

		const result = loadHistory(deps, "/proj");
		expect(result).toHaveLength(1);
		expect("v" in result[0]).toBe(false);
	});

	it("skips malformed lines", () => {
		const interaction = makeInteraction({ id: "int-good" });
		const goodLine = JSON.stringify({ v: 1, ...interaction });
		const content = [
			goodLine,
			"NOT VALID JSON",
			"{also bad",
			goodLine,
		].join("\n") + "\n";

		const deps = makeDeps({
			"/proj/.flowti/var/interaction-log.jsonl": content,
		});

		const result = loadHistory(deps, "/proj");
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("int-good");
		expect(result[1].id).toBe("int-good");
	});

	it("skips empty lines", () => {
		const interaction = makeInteraction({ id: "int-c" });
		const line = JSON.stringify({ v: 1, ...interaction });
		const content = "\n" + line + "\n\n";
		const deps = makeDeps({
			"/proj/.flowti/var/interaction-log.jsonl": content,
		});

		const result = loadHistory(deps, "/proj");
		expect(result).toHaveLength(1);
	});

	it("limits results to HISTORY_BUFFER_SIZE", () => {
		const lines: string[] = [];
		for (let i = 0; i < HISTORY_BUFFER_SIZE + 50; i++) {
			const interaction = makeInteraction({
				id: `int-${i}`,
				timestamp: 1000 + i,
			});
			lines.push(JSON.stringify({ v: 1, ...interaction }));
		}
		const deps = makeDeps({
			"/proj/.flowti/var/interaction-log.jsonl": lines.join("\n") + "\n",
		});

		const result = loadHistory(deps, "/proj");
		expect(result).toHaveLength(HISTORY_BUFFER_SIZE);
		// Should return the LAST entries, not the first
		expect(result[0].id).toBe(`int-50`);
		expect(result[HISTORY_BUFFER_SIZE - 1].id).toBe(
			`int-${HISTORY_BUFFER_SIZE + 49}`,
		);
	});
});

// ── restoreCooldowns ───────────────────────────────────────────────────

describe("restoreCooldowns", () => {
	it("extracts expiry timestamps from history", () => {
		const history = [
			makeInteraction({
				id: "int-1",
				initiator: { id: "agent-1", entityType: "agent" },
				action: "greet",
				timestamp: 1000,
				cooldownMs: 5000,
			}),
		];

		const cooldowns = restoreCooldowns(history);
		expect(cooldowns.get("agent:agent-1:greet")).toBe(6000);
	});

	it("later entries overwrite earlier ones", () => {
		const history = [
			makeInteraction({
				id: "int-1",
				initiator: { id: "npc-1", entityType: "npc" },
				action: "trade",
				timestamp: 1000,
				cooldownMs: 3000,
			}),
			makeInteraction({
				id: "int-2",
				initiator: { id: "npc-1", entityType: "npc" },
				action: "trade",
				timestamp: 5000,
				cooldownMs: 3000,
			}),
		];

		const cooldowns = restoreCooldowns(history);
		expect(cooldowns.get("npc:npc-1:trade")).toBe(8000);
	});

	it("handles multiple different keys", () => {
		const history = [
			makeInteraction({
				id: "int-1",
				initiator: { id: "agent-1", entityType: "agent" },
				action: "greet",
				timestamp: 1000,
				cooldownMs: 5000,
			}),
			makeInteraction({
				id: "int-2",
				initiator: { id: "pet-1", entityType: "pet" },
				action: "play",
				timestamp: 2000,
				cooldownMs: 10000,
			}),
		];

		const cooldowns = restoreCooldowns(history);
		expect(cooldowns.size).toBe(2);
		expect(cooldowns.get("agent:agent-1:greet")).toBe(6000);
		expect(cooldowns.get("pet:pet-1:play")).toBe(12000);
	});

	it("returns empty map for empty history", () => {
		const cooldowns = restoreCooldowns([]);
		expect(cooldowns.size).toBe(0);
	});
});
