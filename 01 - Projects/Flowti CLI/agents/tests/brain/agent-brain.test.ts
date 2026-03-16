import { describe, it, expect } from "vitest";
import { transition, computeParams } from "../../src/brain/agent-brain.js";
import type { BrainState, BrainEvent } from "../../src/brain/brain-types.js";

describe("transition", () => {
	it("idle + task-started → walking-to workstation", () => {
		const result = transition("idle", { type: "task-started" });
		expect(result.state).toBe("walking-to");
		expect(result.target.kind).toBe("workstation");
	});
	it("working + task-completed → idle", () => {
		const result = transition("working", { type: "task-completed" });
		expect(result.state).toBe("idle");
	});
	it("any + speaking → talking", () => {
		const result = transition("working", { type: "speaking" });
		expect(result.state).toBe("talking");
	});
	it("any + thinking → working", () => {
		const result = transition("idle", { type: "thinking" });
		expect(result.state).toBe("working");
	});
	it("any + asking → waiting", () => {
		const result = transition("working", { type: "asking" });
		expect(result.state).toBe("waiting");
	});
	it("waiting + permission-granted → working", () => {
		const result = transition("waiting", { type: "permission-granted" });
		expect(result.state).toBe("working");
	});
	it("waiting + permission-denied → idle", () => {
		const result = transition("waiting", { type: "permission-denied" });
		expect(result.state).toBe("idle");
	});
	it("unknown event stays in current state", () => {
		const result = transition("working", { type: "tool-complete" });
		expect(result.state).toBe("working");
	});
	it("idle + idle → idle (no-op)", () => {
		const result = transition("idle", { type: "idle" });
		expect(result.state).toBe("idle");
	});
});

describe("computeParams", () => {
	it("high DEX gives faster speed", () => {
		const params = computeParams({ str: 10, int: 10, wis: 10, cha: 10, dex: 20, con: 10 });
		expect(params.speedMultiplier).toBeGreaterThan(1.0);
	});
	it("low DEX gives slower speed", () => {
		const params = computeParams({ str: 10, int: 10, wis: 10, cha: 10, dex: 1, con: 10 });
		expect(params.speedMultiplier).toBeLessThan(1.0);
	});
	it("default attributes (dex=10) give mid-range speed", () => {
		const params = computeParams({});
		expect(params.speedMultiplier).toBeGreaterThan(0.9);
		expect(params.speedMultiplier).toBeLessThan(1.1);
	});
});
