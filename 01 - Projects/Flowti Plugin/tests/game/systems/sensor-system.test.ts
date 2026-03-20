import { describe, it, expect, vi, beforeEach } from "vitest";
import { SensorSystem } from "../../../src/game/systems/sensor-system.js";
import type { SensorEventData, SensorReaction, SensorRuleOverride } from "../../../src/game/data/sensor-rules.js";
import { DEFAULT_WORLD_CONFIG } from "../../../src/game/data/world-config.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeEvent(type: SensorEventData["type"], data: Record<string, unknown> = {}): SensorEventData {
	return { type, data };
}

// ── SensorSystem ───────────────────────────────────────────────────────

describe("SensorSystem", () => {
	let system: SensorSystem;
	let reactions: SensorReaction[];

	beforeEach(() => {
		system = new SensorSystem();
		reactions = [];
		system.onReaction((r) => reactions.push(r));
	});

	// ── register / unregister ─────────────────────────────────────────

	describe("register() / unregister()", () => {
		it("registers an agent without throwing", () => {
			expect(() => system.register("Alice", "engineering")).not.toThrow();
		});

		it("unregisters an agent without throwing", () => {
			system.register("Alice", "engineering");
			expect(() => system.unregister("Alice")).not.toThrow();
		});

		it("unregistering an unknown agent does not throw", () => {
			expect(() => system.unregister("nobody")).not.toThrow();
		});
	});

	// ── onReaction / pushEvent ────────────────────────────────────────

	describe("pushEvent() — fires reaction for matching rule", () => {
		it("fires a reaction when a matching rule exists", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(1);
			expect(reactions[0].agentName).toBe("Alice");
		});

		it("reaction includes bubble text for test-pass", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions[0].bubble).toBeDefined();
			expect(typeof reactions[0].bubble?.text).toBe("string");
		});

		it("does not fire when no agents are registered", () => {
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(0);
		});

		it("does not fire when event type has no matching rule", () => {
			system.register("Alice", "engineering");
			// @ts-expect-error — deliberately unknown event type
			system.pushEvent(makeEvent("unknown-event-type"));
			expect(reactions).toHaveLength(0);
		});
	});

	// ── Global cooldown ───────────────────────────────────────────────

	describe("global cooldown", () => {
		it("blocks a second reaction fired immediately after the first", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			system.pushEvent(makeEvent("build-success"));
			// Only the first event should have produced a reaction
			expect(reactions).toHaveLength(1);
		});

		it("allows a reaction after global cooldown expires", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(1);

			// Advance past global cooldown
			system.update(DEFAULT_WORLD_CONFIG.sensors.globalCooldown + 1);

			// Push another matching event (different rule to bypass rule cooldown)
			system.pushEvent(makeEvent("iteration-milestone"));
			expect(reactions).toHaveLength(2);
		});
	});

	// ── Per-rule cooldown ─────────────────────────────────────────────

	describe("per-rule cooldown", () => {
		it("blocks the same rule from firing again before its cooldown expires", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			// Advance past global cooldown but not the rule cooldown (30s)
			system.update(DEFAULT_WORLD_CONFIG.sensors.globalCooldown + 1);
			system.pushEvent(makeEvent("test-pass"));
			// Still only one reaction — rule is on cooldown
			expect(reactions).toHaveLength(1);
		});

		it("allows the same rule after its cooldown expires", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			// Advance past both global cooldown and rule cooldown (30s)
			system.update(31_000);
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(2);
		});
	});

	// ── Per-agent cooldown ────────────────────────────────────────────

	describe("per-agent cooldown", () => {
		it("per-agent cooldown is shorter than global cooldown — both expire together", () => {
			// globalCooldown (10s) > perAgentCooldown (5s): advancing past global also clears per-agent.
			// This test verifies that a second event fires correctly once both cooldowns are drained.
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			// Advance past both cooldowns (global=10s > per-agent=5s)
			system.update(DEFAULT_WORLD_CONFIG.sensors.globalCooldown + 1);
			system.pushEvent(makeEvent("health-improved"));
			expect(reactions).toHaveLength(2);
		});

		it("per-agent cooldown is tracked per agent — all-filter fires all agents, each gets their own CD", () => {
			system.register("Alice", "quality");
			system.register("Bob", "engineering");
			// iteration-milestone targets all agents
			system.pushEvent(makeEvent("iteration-milestone"));
			// Both Alice and Bob fire
			expect(reactions).toHaveLength(2);
			// Advance past global cooldown
			system.update(DEFAULT_WORLD_CONFIG.sensors.globalCooldown + 1);
			// Fire another all-target event — both per-agent CDs (5s) also expired by now
			system.pushEvent(makeEvent("iteration-milestone"));
			// Global CD reset by first fire, iteration-milestone rule also has 120s CD —
			// so second fire is blocked by rule CD
			expect(reactions).toHaveLength(2);
		});

		it("allows a bubble to the same agent after per-agent cooldown expires", () => {
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			// Advance past both global cooldown and per-agent cooldown (5s)
			system.update(Math.max(DEFAULT_WORLD_CONFIG.sensors.globalCooldown, DEFAULT_WORLD_CONFIG.sensors.perAgentCooldown) + 1);
			system.pushEvent(makeEvent("health-improved"));
			expect(reactions).toHaveLength(2);
		});
	});

	// ── Agent selection — domain matching ─────────────────────────────

	describe("agent selection", () => {
		it("selects quality domain agent for test-pass", () => {
			system.register("Alice", "engineering");
			system.register("Bob", "quality");
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions[0].agentName).toBe("Bob");
		});

		it("selects engineering domain agent for build-failure", () => {
			system.register("Alice", "engineering");
			system.register("Bob", "quality");
			system.pushEvent(makeEvent("build-failure"));
			expect(reactions[0].agentName).toBe("Alice");
		});

		it("falls back to first registered agent when no domain match", () => {
			system.register("Alice", "management");
			system.pushEvent(makeEvent("test-pass"));
			// Alice has no quality domain, but she's the only agent
			expect(reactions[0].agentName).toBe("Alice");
		});

		it("fires to all agents for iteration-milestone", () => {
			system.register("Alice", "engineering");
			system.register("Bob", "quality");
			system.register("Carol", "design");
			system.pushEvent(makeEvent("iteration-milestone"));
			const names = reactions.map((r) => r.agentName);
			expect(names).toContain("Alice");
			expect(names).toContain("Bob");
			expect(names).toContain("Carol");
		});
	});

	// ── Domain path matching for file events ──────────────────────────

	describe("domain-match filter for file events", () => {
		it("selects engineering agent for a file path starting with 'src/'", () => {
			system.register("Alice", "engineering");
			system.register("Bob", "quality");
			system.pushEvent(makeEvent("file-saved", { path: "src/game/systems/foo.ts" }));
			expect(reactions[0].agentName).toBe("Alice");
		});

		it("selects quality agent for a file path starting with 'tests/'", () => {
			system.register("Alice", "engineering");
			system.register("Bob", "quality");
			system.pushEvent(makeEvent("file-saved", { path: "tests/game/systems/foo.test.ts" }));
			expect(reactions[0].agentName).toBe("Bob");
		});

		it("falls back to first agent when path does not match any domain prefix", () => {
			system.register("Alice", "engineering");
			system.pushEvent(makeEvent("file-saved", { path: "unknown/path.ts" }));
			expect(reactions[0].agentName).toBe("Alice");
		});
	});

	// ── applyOverrides ────────────────────────────────────────────────

	describe("applyOverrides()", () => {
		it("disables a rule when override sets negative cooldown", () => {
			const overrides: SensorRuleOverride[] = [{ ruleId: "test-pass", cooldownMs: -1 }];
			system.applyOverrides(overrides);
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(0);
		});

		it("still fires other rules after disabling one", () => {
			const overrides: SensorRuleOverride[] = [{ ruleId: "test-pass", cooldownMs: -1 }];
			system.applyOverrides(overrides);
			system.register("Alice", "engineering");
			system.pushEvent(makeEvent("build-success"));
			expect(reactions).toHaveLength(1);
		});

		it("changed cooldown takes effect on next fire", () => {
			// Override test-pass to have a very short cooldown
			const overrides: SensorRuleOverride[] = [{ ruleId: "test-pass", cooldownMs: 1 }];
			system.applyOverrides(overrides);
			system.register("Alice", "quality");
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(1);
			// Advance past global cooldown + 1ms rule cooldown
			system.update(DEFAULT_WORLD_CONFIG.sensors.globalCooldown + 2);
			system.pushEvent(makeEvent("test-pass"));
			expect(reactions).toHaveLength(2);
		});
	});

	// ── pushFeedback — one-frame delay ────────────────────────────────

	describe("pushFeedback() — one-frame delay", () => {
		it("does not fire on the same frame", () => {
			system.register("Alice", "quality");
			system.pushFeedback(makeEvent("test-pass"));
			// Not yet processed
			expect(reactions).toHaveLength(0);
		});

		it("fires on the next update() call", () => {
			system.register("Alice", "quality");
			system.pushFeedback(makeEvent("test-pass"));
			system.update(0);
			expect(reactions).toHaveLength(1);
		});

		it("processes multiple queued feedback events on next frame", () => {
			system.register("Alice", "quality");
			system.pushFeedback(makeEvent("test-pass"));
			// Only one will get through due to global cooldown
			system.pushFeedback(makeEvent("build-success"));
			system.update(0);
			// Global cooldown blocks the second
			expect(reactions).toHaveLength(1);
		});
	});
});
