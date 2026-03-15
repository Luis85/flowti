import { describe, it, expect, vi } from "vitest";
import {
	readAgentState, writeAgentState,
	recordInteraction, addTask, completeTask, addBrief,
} from "../../../src/domain/agents/agent-state.js";
import type { AgentStateDeps, AgentState } from "../../../src/domain/agents/agent-state.js";

function makeDeps(): AgentStateDeps & { files: Record<string, string>; dirs: Set<string> } {
	const files: Record<string, string> = {};
	const dirs = new Set<string>();
	return {
		files, dirs,
		disk: {
			readFileSync: vi.fn((p: string) => {
				if (files[p] === undefined) throw new Error(`File not found: ${p}`);
				return files[p];
			}),
			writeFileSync: vi.fn((p: string, c: string) => { files[p] = c; }),
			existsSync: vi.fn((p: string) => files[p] !== undefined || dirs.has(p)),
			mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
		} as unknown as AgentStateDeps["disk"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
		} as unknown as AgentStateDeps["paths"],
	};
}

describe("readAgentState", () => {
	it("returns empty state when file does not exist", () => {
		const deps = makeDeps();
		const state = readAgentState(deps, "/var", "Dev");
		expect(state.name).toBe("Dev");
		expect(state.status).toBe("idle");
		expect(state.tasks).toEqual([]);
		expect(state.briefs).toEqual([]);
	});

	it("parses state from JSON file", () => {
		const deps = makeDeps();
		deps.files["/var/data-dev.json"] = JSON.stringify({
			name: "Dev", status: "active",
			lastInteraction: "2026-03-15T10:00:00Z",
			lastInteractionType: "task",
			tasks: [{ name: "Build it", assignedAt: "2026-03-15T10:00:00Z", status: "pending" }],
			briefs: [],
		});
		const state = readAgentState(deps, "/var", "Dev");
		expect(state.status).toBe("active");
		expect(state.tasks).toHaveLength(1);
		expect(state.lastInteractionType).toBe("task");
	});

	it("returns empty state on malformed JSON", () => {
		const deps = makeDeps();
		deps.files["/var/data-dev.json"] = "not json";
		const state = readAgentState(deps, "/var", "Dev");
		expect(state.status).toBe("idle");
	});

	it("slugifies agent name for file path", () => {
		const deps = makeDeps();
		deps.files["/var/data-software-architect.json"] = JSON.stringify({ name: "Software Architect", status: "idle", tasks: [], briefs: [] });
		const state = readAgentState(deps, "/var", "Software Architect");
		expect(state.name).toBe("Software Architect");
	});
});

describe("writeAgentState", () => {
	it("writes state as JSON to var directory", () => {
		const deps = makeDeps();
		deps.dirs.add("/var");
		const state: AgentState = { name: "Dev", status: "active", tasks: [], briefs: [] };
		writeAgentState(deps, "/var", "Dev", state);
		expect(deps.files["/var/data-dev.json"]).toBeDefined();
		const parsed = JSON.parse(deps.files["/var/data-dev.json"]);
		expect(parsed.name).toBe("Dev");
		expect(parsed.status).toBe("active");
	});

	it("creates var directory if missing", () => {
		const deps = makeDeps();
		const state: AgentState = { name: "Dev", status: "idle", tasks: [], briefs: [] };
		writeAgentState(deps, "/var", "Dev", state);
		expect(deps.dirs.has("/var")).toBe(true);
	});
});

describe("recordInteraction", () => {
	it("updates lastInteraction and sets status to active", () => {
		const state: AgentState = { name: "Dev", status: "idle", tasks: [], briefs: [] };
		const updated = recordInteraction(state, "talk", "2026-03-15T10:00:00Z");
		expect(updated.lastInteraction).toBe("2026-03-15T10:00:00Z");
		expect(updated.lastInteractionType).toBe("talk");
		expect(updated.status).toBe("active");
	});
});

describe("addTask", () => {
	it("appends task and sets status to busy", () => {
		const state: AgentState = { name: "Dev", status: "idle", tasks: [], briefs: [] };
		const updated = addTask(state, { name: "Build it", assignedAt: "2026-03-15T10:00:00Z", status: "pending" });
		expect(updated.tasks).toHaveLength(1);
		expect(updated.tasks[0].name).toBe("Build it");
		expect(updated.status).toBe("busy");
	});
});

describe("completeTask", () => {
	it("marks task as done and returns to idle when all done", () => {
		const state: AgentState = {
			name: "Dev", status: "busy",
			tasks: [{ name: "Build it", assignedAt: "2026-03-15T10:00:00Z", status: "pending" }],
			briefs: [],
		};
		const updated = completeTask(state, "Build it");
		expect(updated.tasks[0].status).toBe("done");
		expect(updated.status).toBe("idle");
	});

	it("keeps busy status when other tasks remain", () => {
		const state: AgentState = {
			name: "Dev", status: "busy",
			tasks: [
				{ name: "Build it", assignedAt: "2026-03-15", status: "pending" },
				{ name: "Test it", assignedAt: "2026-03-15", status: "pending" },
			],
			briefs: [],
		};
		const updated = completeTask(state, "Build it");
		expect(updated.tasks[0].status).toBe("done");
		expect(updated.tasks[1].status).toBe("pending");
		expect(updated.status).toBe("busy");
	});
});

describe("addBrief", () => {
	it("appends brief reference", () => {
		const state: AgentState = { name: "Dev", status: "active", tasks: [], briefs: [] };
		const updated = addBrief(state, { path: "/briefs/dev.md", generatedAt: "2026-03-15T10:00:00Z", autonomous: false });
		expect(updated.briefs).toHaveLength(1);
		expect(updated.briefs[0].path).toBe("/briefs/dev.md");
	});
});
