import { describe, it, expect } from "vitest";
import { scoreAgents, computeAffinity, type AgentInfo } from "../../../src/domain/tasks/task-scorer.js";
import type { TaskHistoryEntry } from "../../../src/domain/tasks/task-dispatcher-types.js";
import { makeTask } from "./task-test-utils.js";

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
	return {
		name: "agent-a",
		capabilities: [],
		trustTier: "supervised",
		workerState: "idle",
		onCooldown: false,
		history: [],
		...overrides,
	};
}

describe("computeAffinity", () => {
	it("returns 0 for empty history", () => {
		expect(computeAffinity([], ["inbox"], "one-off")).toBe(0);
	});

	it("scores tag matches at weight 2 and type matches at weight 1", () => {
		const history: TaskHistoryEntry[] = [
			{ tags: ["inbox", "tagging"], type: "one-off", assignee: "a" },
			{ tags: ["inbox"], type: "standing-order", assignee: "a" },
		];
		// 2 tag matches for "inbox" × 2 = 4, 1 type match (standing-order) × 1 = 1, total = 5
		expect(computeAffinity(history, ["inbox"], "standing-order")).toBe(5);
	});

	it("scores type matches at weight 1", () => {
		const history: TaskHistoryEntry[] = [
			{ tags: [], type: "one-off", assignee: "a" },
			{ tags: [], type: "one-off", assignee: "a" },
		];
		expect(computeAffinity(history, [], "one-off")).toBe(2);
	});

	it("combines tag and type scores", () => {
		const history: TaskHistoryEntry[] = [
			{ tags: ["review"], type: "delegated", assignee: "a" },
		];
		// 1 tag match × 2 = 2, 1 type match × 1 = 1
		expect(computeAffinity(history, ["review"], "delegated")).toBe(3);
	});
});

describe("scoreAgents", () => {
	it("filters out agents missing required capabilities", () => {
		const agents = [makeAgent({ name: "a", capabilities: ["read"] })];
		const task = makeTask({ requiredCapabilities: ["read", "write"] });
		const result = scoreAgents(agents, task);
		expect(result).toBeNull();
	});

	it("passes agents with all required capabilities", () => {
		const agents = [makeAgent({ name: "a", capabilities: ["read", "write", "tag"] })];
		const task = makeTask({ requiredCapabilities: ["read", "write"] });
		const result = scoreAgents(agents, task);
		expect(result).not.toBeNull();
		expect(result!.name).toBe("a");
	});

	it("filters out agents below required trust tier", () => {
		const agents = [makeAgent({ name: "a", trustTier: "supervised" })];
		const task = makeTask({ requiredAgentTier: "trusted" });
		const result = scoreAgents(agents, task);
		expect(result).toBeNull();
	});

	it("accepts agents at or above required trust tier", () => {
		const agents = [makeAgent({ name: "a", trustTier: "autonomous" })];
		const task = makeTask({ requiredAgentTier: "trusted" });
		const result = scoreAgents(agents, task);
		expect(result!.name).toBe("a");
	});

	it("filters out agents on cooldown", () => {
		const agents = [makeAgent({ name: "a", onCooldown: true })];
		const result = scoreAgents(agents, makeTask());
		expect(result).toBeNull();
	});

	it("filters out busy agents", () => {
		const agents = [makeAgent({ name: "a", workerState: "working" })];
		const result = scoreAgents(agents, makeTask());
		expect(result).toBeNull();
	});

	it("picks agent with higher affinity score", () => {
		const agents = [
			makeAgent({
				name: "bob",
				history: [{ tags: ["inbox"], type: "one-off", assignee: "bob" }],
			}),
			makeAgent({
				name: "alice",
				history: [
					{ tags: ["inbox"], type: "one-off", assignee: "alice" },
					{ tags: ["inbox"], type: "one-off", assignee: "alice" },
				],
			}),
		];
		const task = makeTask({ tags: ["inbox"], type: "one-off" });
		const result = scoreAgents(agents, task);
		expect(result!.name).toBe("alice");
	});

	it("breaks ties alphabetically", () => {
		const agents = [
			makeAgent({ name: "bob" }),
			makeAgent({ name: "alice" }),
		];
		const result = scoreAgents(agents, makeTask());
		expect(result!.name).toBe("alice");
	});

	it("returns null when no agents qualify", () => {
		const result = scoreAgents([], makeTask());
		expect(result).toBeNull();
	});
});
