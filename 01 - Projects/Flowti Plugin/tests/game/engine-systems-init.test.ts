import { describe, it, expect, vi } from "vitest";
import { createBtBridges } from "../../src/game/engine-systems-init.js";
import type { BrainSystem } from "../../src/game/systems/brain-system.js";
import type { NeedsSystem } from "../../src/game/systems/needs-system.js";

function makeMockBrain(): BrainSystem {
	return {
		applyEvent: vi.fn(),
		assignWork: vi.fn(),
		releaseWork: vi.fn(),
		getState: vi.fn(() => ({ state: "idle" })),
	} as unknown as BrainSystem;
}

function makeMockNeeds(): NeedsSystem {
	return {
		getNeeds: vi.fn(() => ({ energy: 50, social: 50, focus: 50, morale: 50, hunger: 50, thirst: 50 })),
	} as unknown as NeedsSystem;
}

function emitAction(
	bridges: ReturnType<typeof createBtBridges>,
	type: string,
	agentName = "Alice",
): void {
	bridges.btWorldState.emitAction({
		id: `test-${type}`,
		agentName,
		timestamp: new Date().toISOString(),
		type,
		data: {},
	});
}

describe("createBtBridges — bridge whitelist", () => {
	const INTENT_ACTIONS = ["thinking", "asking", "using-tool", "speaking", "error"];
	const SEEK_ACTIONS = [
		"seek-rest", "seek-food", "seek-drink", "seek-agent",
		"seek-quiet", "seek-merchant", "seek-preferred-food", "seek-preferred-drink",
	];
	const PASSIVE_ACTIONS = [
		"idle", "chatter", "wander", "wander-sad", "browsing-merchant",
		"goal-started", "goal-completed", "artifact-dropped",
		"interaction-evaluated", "interaction-submitted",
		"file-read", "file-written", "file-opened", "template-generated", "merchant-purchase",
	];

	for (const action of INTENT_ACTIONS) {
		it(`forwards intent action "${action}" to brainSystem.applyEvent`, () => {
			const brain = makeMockBrain();
			const bridges = createBtBridges(brain, makeMockNeeds());
			emitAction(bridges, action);
			expect(brain.applyEvent).toHaveBeenCalledWith("Alice", action);
		});
	}

	for (const action of SEEK_ACTIONS) {
		it(`does NOT forward seek action "${action}" through the bridge`, () => {
			const brain = makeMockBrain();
			const bridges = createBtBridges(brain, makeMockNeeds());
			emitAction(bridges, action);
			expect(brain.applyEvent).not.toHaveBeenCalled();
		});
	}

	for (const action of PASSIVE_ACTIONS) {
		it(`does NOT forward passive action "${action}" through the bridge`, () => {
			const brain = makeMockBrain();
			const bridges = createBtBridges(brain, makeMockNeeds());
			emitAction(bridges, action);
			expect(brain.applyEvent).not.toHaveBeenCalled();
		});
	}

	it("provides btDeps with brain bridge for direct seek calls", () => {
		const brain = makeMockBrain();
		const bridges = createBtBridges(brain, makeMockNeeds());
		expect(bridges.btDeps.brain).toBeDefined();
		bridges.btDeps.brain!.applyEvent("Alice", "seek-food");
		expect(brain.applyEvent).toHaveBeenCalledWith("Alice", "seek-food");
	});

	it("provides btDeps with needs bridge", () => {
		const needs = makeMockNeeds();
		const bridges = createBtBridges(makeMockBrain(), needs);
		expect(bridges.btDeps.needs).toBeDefined();
		bridges.btDeps.needs!.getNeeds("Alice");
		expect(needs.getNeeds).toHaveBeenCalledWith("Alice");
	});
});
