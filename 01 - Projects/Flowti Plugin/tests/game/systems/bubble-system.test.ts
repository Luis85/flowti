// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

// BubbleActor calls document.createElement, mock it so we stay in happy-dom
vi.mock("../../../src/game/actors/bubble-actor.js", () => {
	function MockBubbleActor(this: Record<string, unknown>) {
		this.text = "";
		this.kind = "speech";
		this.duration = 5000;
		this.kill = vi.fn();
		this.isKilled = vi.fn(() => false);
	}
	return { BubbleActor: MockBubbleActor };
});

import { BubbleSystem } from "../../../src/game/systems/bubble-system.js";
import type { BrainParams } from "../../../src/game/brain/brain-types.js";

function makeParams(overrides: Partial<BrainParams> = {}): BrainParams {
	return {
		speedMultiplier: 1,
		socialRadius: 80,
		focusDuration: 10000,
		idleResistance: 5000,
		quoteFrequency: 30000,
		...overrides,
	};
}

describe("BubbleSystem", () => {
	let system: BubbleSystem;

	beforeEach(() => {
		system = new BubbleSystem();
	});

	describe("register()", () => {
		it("adds agent to the system (does not throw)", () => {
			expect(() => system.register("Alice", ["curious", "bold"], makeParams())).not.toThrow();
		});

		it("is idempotent — second call does not throw", () => {
			system.register("Alice", [], makeParams());
			expect(() => system.register("Alice", [], makeParams())).not.toThrow();
		});
	});

	describe("showBubble()", () => {
		it("does nothing when the agent is not registered (no crash)", () => {
			expect(() =>
				system.showBubble("nobody", "speech", "hello", null, () => undefined),
			).not.toThrow();
		});

		it("does nothing when getActor() returns undefined (no crash)", () => {
			system.register("Alice", [], makeParams());
			expect(() =>
				system.showBubble("Alice", "speech", "hello", null, () => undefined),
			).not.toThrow();
		});

		it("adds a bubble child to the actor when actor is found", () => {
			system.register("Alice", [], makeParams());
			const mockActor = {
				addChild: vi.fn(),
			};
			system.showBubble("Alice", "speech", "hello", null, () => mockActor as never);
			expect(mockActor.addChild).toHaveBeenCalled();
		});

		it("non-priority bubble is throttled within 500ms", () => {
			system.register("Alice", [], makeParams());
			const mockActor = { addChild: vi.fn() };
			const getActor = () => mockActor as never;
			// First call sets lastBubbleTime
			system.showBubble("Alice", "speech", "first", null, getActor);
			const callsAfterFirst = mockActor.addChild.mock.calls.length;
			// Second call within 500ms — should be throttled
			system.showBubble("Alice", "speech", "second", null, getActor);
			expect(mockActor.addChild.mock.calls.length).toBe(callsAfterFirst);
		});

		it("priority bubble bypasses throttle", () => {
			system.register("Alice", [], makeParams());
			const mockActor = { addChild: vi.fn() };
			const getActor = () => mockActor as never;
			// First call sets lastBubbleTime
			system.showBubble("Alice", "speech", "first", null, getActor);
			const callsAfterFirst = mockActor.addChild.mock.calls.length;
			// Second call immediately with priority=true — should NOT be throttled
			system.showBubble("Alice", "speech", "second", null, getActor, 5000, true);
			expect(mockActor.addChild.mock.calls.length).toBe(callsAfterFirst + 1);
		});
	});

	describe("unregister()", () => {
		it("removes the agent (no throw)", () => {
			system.register("Alice", [], makeParams());
			expect(() => system.unregister("Alice")).not.toThrow();
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => system.unregister("nobody")).not.toThrow();
		});
	});

	describe("update()", () => {
		it("does not throw when called with no registered agents", () => {
			expect(() =>
				system.update(16, () => false, null, () => undefined),
			).not.toThrow();
		});

		it("does not throw when called with registered agents", () => {
			system.register("Alice", [], makeParams());
			expect(() =>
				system.update(16, () => false, null, () => undefined),
			).not.toThrow();
		});
	});
});
