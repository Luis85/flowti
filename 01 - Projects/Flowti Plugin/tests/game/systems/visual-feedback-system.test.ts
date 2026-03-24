import { describe, it, expect, vi, beforeEach } from "vitest";
import { VisualFeedbackSystem, type VisualFeedbackCallbacks } from "../../../src/game/systems/visual-feedback-system.js";
import { createDefaultBlackboard, type AgentBlackboard } from "../../../src/game/systems/blackboard.js";

function makeBB(overrides: Partial<AgentBlackboard> = {}): AgentBlackboard {
	return { ...createDefaultBlackboard(), ...overrides };
}

function makeCallbacks(): Record<keyof VisualFeedbackCallbacks, ReturnType<typeof vi.fn>> {
	return {
		onShowIntentIcon: vi.fn(),
		onHideIntentIcon: vi.fn(),
		onThoughtBubble: vi.fn(),
		onEmoteFlash: vi.fn(),
		onFacingChange: vi.fn(),
		onItemPop: vi.fn(),
		onParticleBurst: vi.fn(),
	};
}

describe("VisualFeedbackSystem — intent transitions", () => {
	let system: VisualFeedbackSystem;
	let callbacks: ReturnType<typeof makeCallbacks>;

	beforeEach(() => {
		callbacks = makeCallbacks();
		system = new VisualFeedbackSystem(callbacks);
	});

	it("detects idle-to-seeking transition", () => {
		const bb = makeBB({ intent: "idle", intentDetail: "" });
		system.register("Atlas", []);
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		bb.position = { x: 0, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(bb.lastIntentTransition).toEqual({
			from: "idle:",
			to: "seeking:seek-food",
			timestamp: 16,
		});
	});

	it("emits onFacingChange toward target on intent start (left)", () => {
		const bb = makeBB({ intent: "idle" });
		system.register("Atlas", []);
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: -50, y: 0 };
		bb.position = { x: 0, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onFacingChange).toHaveBeenCalledWith("Atlas", "left");
	});

	it("emits onFacingChange right when target is to the right", () => {
		const bb = makeBB({ intent: "idle" });
		system.register("Atlas", []);
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 0 };
		bb.position = { x: 0, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onFacingChange).toHaveBeenCalledWith("Atlas", "right");
	});

	it("does not emit visuals for unregistered agents", () => {
		const bb = makeBB({ intent: "seeking", intentDetail: "seek-food" });
		system.tick("Unknown", bb, 0, 16);
		expect(callbacks.onFacingChange).not.toHaveBeenCalled();
	});
});

describe("VisualFeedbackSystem — urgency", () => {
	let system: VisualFeedbackSystem;
	let callbacks: ReturnType<typeof makeCallbacks>;

	beforeEach(() => {
		callbacks = makeCallbacks();
		system = new VisualFeedbackSystem(callbacks);
	});

	it("low urgency (hunger 30) shows thought bubble", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 30;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onThoughtBubble).toHaveBeenCalled();
	});

	it("high urgency (hunger 5) shows distressed emote + smoke", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 5;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onEmoteFlash).toHaveBeenCalled();
		expect(callbacks.onParticleBurst).toHaveBeenCalledWith("Atlas", "sprite-smoke", expect.any(Object));
	});

	it("sets urgencySpeedBoost on blackboard based on urgency tier", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "seeking", intentDetail: "seek-food" });
		bb.needs.hunger = 5;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 0, 16);

		expect(bb.urgencySpeedBoost).toBe(1.4);
	});

	it("resets urgencySpeedBoost to 1.0 when not seeking", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		bb.urgencySpeedBoost = 1.4;
		system.tick("Atlas", bb, 0, 16);

		expect(bb.urgencySpeedBoost).toBe(1.0);
	});

	it("uses quirk-adjusted threshold for snacker agents", () => {
		system.register("Atlas", ["snacker"]);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		// hunger 30 with snacker threshold 50: urgency = 1 - 30/50 = 0.4 → medium
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 30;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		// Medium urgency: emote flash, no thought bubble
		expect(callbacks.onEmoteFlash).toHaveBeenCalled();
		expect(callbacks.onThoughtBubble).not.toHaveBeenCalled();
	});
});

describe("VisualFeedbackSystem — arrival payoff", () => {
	let system: VisualFeedbackSystem;
	let callbacks: ReturnType<typeof makeCallbacks>;

	beforeEach(() => {
		callbacks = makeCallbacks();
		system = new VisualFeedbackSystem(callbacks);
	});

	it("emits item pop and satisfaction emote on arrival at food station", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		system.tick("Atlas", bb, 16, 16);

		bb.arrived = true;
		system.tick("Atlas", bb, 1000, 16);

		expect(callbacks.onItemPop).toHaveBeenCalled();
		expect(callbacks.onEmoteFlash).toHaveBeenCalled();
		expect(callbacks.onParticleBurst).toHaveBeenCalledWith("Atlas", "sprite-sparkle", expect.any(Object));
	});

	it("fires payoff for seek-preferred-food variant", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-preferred-food:SnackTable";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		system.tick("Atlas", bb, 16, 16);

		bb.arrived = true;
		system.tick("Atlas", bb, 1000, 16);

		expect(callbacks.onItemPop).toHaveBeenCalled();
	});

	it("respects payoff cooldown (3s)", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		system.tick("Atlas", bb, 16, 16);
		bb.arrived = true;
		system.tick("Atlas", bb, 1000, 16);
		callbacks.onItemPop.mockClear();

		// Second arrival too soon (< 3s)
		bb.arrived = true;
		system.tick("Atlas", bb, 2000, 16);

		expect(callbacks.onItemPop).not.toHaveBeenCalled();
	});
});

describe("VisualFeedbackSystem — idle behavior", () => {
	let system: VisualFeedbackSystem;
	let callbacks: ReturnType<typeof makeCallbacks>;

	beforeEach(() => {
		callbacks = makeCallbacks();
		system = new VisualFeedbackSystem(callbacks);
	});

	it("emits sleep emote when idle for > 60s", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });

		system.tick("Atlas", bb, 0, 16);
		callbacks.onEmoteFlash.mockClear();

		system.tick("Atlas", bb, 61_000, 16);

		expect(callbacks.onEmoteFlash).toHaveBeenCalledWith("Atlas", 7);
	});

	it("emits low energy zzz when energy is low during idle", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		bb.needs.energy = 20;

		system.tick("Atlas", bb, 0, 16);
		// Wait past ambient cooldown (at least 15s)
		system.tick("Atlas", bb, 16_000, 16);

		expect(callbacks.onThoughtBubble).toHaveBeenCalledWith("Atlas", "zzz", undefined, 1500);
	});

	it("emits leaf particles on room transition", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle", currentRoom: "hub" });
		system.tick("Atlas", bb, 0, 16);

		bb.currentRoom = "village";
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onParticleBurst).toHaveBeenCalledWith("Atlas", "sprite-leaf", expect.any(Object));
	});

	it("does not fire room transition on first room assignment", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle", currentRoom: "hub" });
		system.tick("Atlas", bb, 0, 16);

		// previousRoom was "" initially, so first assignment should not trigger
		expect(callbacks.onParticleBurst).not.toHaveBeenCalled();
	});
});
