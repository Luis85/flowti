import { describe, it, expect, vi } from "vitest";
import { VisualFeedbackSystem } from "../../../src/game/systems/visual-feedback-system.js";
import { createDefaultBlackboard } from "../../../src/game/systems/blackboard.js";

describe("VisualFeedbackSystem — integration", () => {
	it("full hunger cycle: idle → telegraph → walk → arrive → payoff", () => {
		const calls: string[] = [];
		const system = new VisualFeedbackSystem({
			onShowIntentIcon: () => calls.push("showIcon"),
			onHideIntentIcon: () => calls.push("hideIcon"),
			onItemPop: () => calls.push("itemPop"),
			onParticleBurst: (_name, preset) => calls.push(`particles:${preset}`),
			onEmoteFlash: () => calls.push("emote"),
			onThoughtBubble: () => calls.push("thought"),
			onFacingChange: () => calls.push("facing"),
		});

		system.register("Atlas", []);
		const bb = createDefaultBlackboard();

		// Frame 1: idle (no visuals)
		system.tick("Atlas", bb, 0, 16);
		expect(calls).toEqual([]);

		// Frame 2: hunger drops, BT sets seeking
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25; // low urgency
		bb.movementTarget = { x: 200, y: 100 };
		system.tick("Atlas", bb, 16, 16);

		// Should see: facing + thought bubble + intent icon
		expect(calls).toContain("facing");
		expect(calls).toContain("thought");
		expect(calls).toContain("showIcon");

		// Frame 3-N: walking (no new visuals, speed boost active)
		calls.length = 0;
		system.tick("Atlas", bb, 500, 16);
		expect(bb.urgencySpeedBoost).toBe(1.0); // low urgency = no boost

		// Frame N+1: arrived
		bb.arrived = true;
		calls.length = 0;
		system.tick("Atlas", bb, 5000, 16);

		// Should see: hideIcon + itemPop + emote + sparkle + heart
		expect(calls).toContain("hideIcon");
		expect(calls).toContain("itemPop");
		expect(calls).toContain("emote");
		expect(calls).toContain("particles:sprite-sparkle");
		expect(calls).toContain("particles:sprite-heart");
	});

	it("high urgency cycle shows distressed emote + smoke + speed boost", () => {
		const calls: string[] = [];
		const system = new VisualFeedbackSystem({
			onShowIntentIcon: () => calls.push("showIcon"),
			onHideIntentIcon: () => calls.push("hideIcon"),
			onItemPop: () => calls.push("itemPop"),
			onParticleBurst: (_name, preset) => calls.push(`particles:${preset}`),
			onEmoteFlash: () => calls.push("emote"),
			onThoughtBubble: () => calls.push("thought"),
			onFacingChange: () => calls.push("facing"),
		});

		system.register("Atlas", []);
		const bb = createDefaultBlackboard();
		system.tick("Atlas", bb, 0, 16);

		// Desperate hunger
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 5; // high urgency
		bb.movementTarget = { x: 200, y: 100 };
		system.tick("Atlas", bb, 16, 16);

		expect(calls).toContain("emote");
		expect(calls).toContain("particles:sprite-smoke");
		expect(calls).not.toContain("thought"); // no thought bubble at high urgency
		expect(bb.urgencySpeedBoost).toBe(1.4);
	});

	it("preferred drink variant triggers full payoff on arrival", () => {
		const calls: string[] = [];
		const system = new VisualFeedbackSystem({
			onShowIntentIcon: () => calls.push("showIcon"),
			onHideIntentIcon: () => calls.push("hideIcon"),
			onItemPop: () => calls.push("itemPop"),
			onParticleBurst: (_name, preset) => calls.push(`particles:${preset}`),
			onEmoteFlash: () => calls.push("emote"),
			onThoughtBubble: () => calls.push("thought"),
			onFacingChange: () => calls.push("facing"),
		});

		system.register("Atlas", ["coffee-addict"]);
		const bb = createDefaultBlackboard();
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-preferred-drink:CoffeeMachine";
		bb.needs.thirst = 20;
		bb.movementTarget = { x: 50, y: 50 };
		system.tick("Atlas", bb, 16, 16);

		bb.arrived = true;
		calls.length = 0;
		system.tick("Atlas", bb, 5000, 16);

		expect(calls).toContain("itemPop");
		expect(calls).toContain("emote");
	});

	it("room transition fires leaf particles", () => {
		const calls: string[] = [];
		const system = new VisualFeedbackSystem({
			onShowIntentIcon: vi.fn(),
			onHideIntentIcon: vi.fn(),
			onItemPop: vi.fn(),
			onParticleBurst: (_name, preset) => calls.push(`particles:${preset}`),
			onEmoteFlash: vi.fn(),
			onThoughtBubble: vi.fn(),
			onFacingChange: vi.fn(),
		});

		system.register("Atlas", []);
		const bb = createDefaultBlackboard();
		bb.currentRoom = "hub";
		system.tick("Atlas", bb, 0, 16);

		bb.currentRoom = "village";
		system.tick("Atlas", bb, 16, 16);

		expect(calls).toContain("particles:sprite-leaf");
	});
});
