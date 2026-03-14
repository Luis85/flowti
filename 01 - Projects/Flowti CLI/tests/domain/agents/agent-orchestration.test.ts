import { describe, it, expect } from "vitest";
import { getActiveAgent, listPhaseAgents } from "../../../src/domain/agents/agent-orchestration.js";
import type { OrchestrationConfig } from "../../../src/infrastructure/types.js";

const config: OrchestrationConfig = {
	phases: {
		"new": { agent: "Product Owner", role: "refiner", instruction: "Refine the goal" },
		"planned": { agent: "Software Architect", role: "planner", instruction: "Break into tasks" },
		"in-progress": { agent: "Software Developer" },
	},
};

describe("getActiveAgent", () => {
	it("returns the agent bound to the current state", () => {
		const result = getActiveAgent(config, "new");
		expect(result).toEqual({
			name: "Product Owner",
			role: "refiner",
			instruction: "Refine the goal",
			state: "new",
		});
	});

	it("returns null for unbound state", () => {
		expect(getActiveAgent(config, "in-review")).toBeNull();
	});

	it("returns null when config is undefined", () => {
		expect(getActiveAgent(undefined, "new")).toBeNull();
	});

	it("returns null when phases is undefined", () => {
		expect(getActiveAgent({}, "new")).toBeNull();
	});

	it("defaults role to 'contributor' when not specified", () => {
		const result = getActiveAgent(config, "in-progress");
		expect(result!.role).toBe("contributor");
	});

	it("defaults instruction to empty string when not specified", () => {
		const result = getActiveAgent(config, "in-progress");
		expect(result!.instruction).toBe("");
	});
});

describe("listPhaseAgents", () => {
	it("returns all bound agents", () => {
		const result = listPhaseAgents(config);
		expect(result).toHaveLength(3);
		expect(result.map((a) => a.name)).toEqual(["Product Owner", "Software Architect", "Software Developer"]);
	});

	it("returns empty array when config is undefined", () => {
		expect(listPhaseAgents(undefined)).toEqual([]);
	});

	it("returns empty array when phases is undefined", () => {
		expect(listPhaseAgents({})).toEqual([]);
	});
});
