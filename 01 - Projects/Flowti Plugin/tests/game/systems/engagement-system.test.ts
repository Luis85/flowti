import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngagementSystem } from "../../../src/game/systems/engagement-system.js";
import type { EngagementEvent } from "../../../src/game/systems/engagement-system.js";
import type { DirectorPresence } from "../../../src/game/systems/director-system.js";
import type { AgentNeeds } from "../../../src/game/systems/needs-system.js";
import type { BrainState } from "../../../src/game/brain/brain-types.js";
import { DEFAULT_WORLD_CONFIG } from "../../../src/game/data/world-config.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makePresence(idleMs: number): DirectorPresence {
	return { idleMs, present: false };
}

function makeNeeds(_name: string): AgentNeeds {
	return { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 };
}

function makeNeedsFrom(overrides: Partial<AgentNeeds>): AgentNeeds {
	return { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80, ...overrides };
}

function alwaysIdle(_name: string): BrainState {
	return "idle";
}

function alwaysBusy(_name: string): BrainState {
	return "working";
}

function noSensor(_name: string): boolean {
	return false;
}

const TIER1_MS = DEFAULT_WORLD_CONFIG.engagement.tiers.ambient.idleThresholdMs;
const TIER2_MS = DEFAULT_WORLD_CONFIG.engagement.tiers.nudge.idleThresholdMs;
const TIER3_MS = DEFAULT_WORLD_CONFIG.engagement.tiers.offer.idleThresholdMs;

const FREQ1_MS = DEFAULT_WORLD_CONFIG.engagement.tiers.ambient.durationMs;
const FREQ2_MS = DEFAULT_WORLD_CONFIG.engagement.tiers.nudge.durationMs;
const FREQ3_MS = DEFAULT_WORLD_CONFIG.engagement.tiers.offer.durationMs;

// ── Tests ──────────────────────────────────────────────────────────────

describe("EngagementSystem", () => {
	let system: EngagementSystem;
	let events: EngagementEvent[];

	beforeEach(() => {
		system = new EngagementSystem();
		events = [];
		system.onEngagement((e) => events.push(e));
	});

	// ── register / unregister ─────────────────────────────────────────

	describe("register() / unregister()", () => {
		it("registers an agent without throwing", () => {
			expect(() => system.register("Alice", { domain: "engineering", cha: 10 })).not.toThrow();
		});

		it("unregisters an agent without throwing", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			expect(() => system.unregister("Alice")).not.toThrow();
		});
	});

	// ── Tier 0 — stays passive when director is active ────────────────

	describe("tier 0 — director active", () => {
		it("stays at tier 0 when idleMs is 0 (director just acted)", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(0), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(0);
		});

		it("stays at tier 0 when idleMs is below the tier 1 threshold", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS - 1), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(0);
		});
	});

	// ── Tier 1 — ambient ──────────────────────────────────────────────

	describe("tier 1 — ambient", () => {
		it("escalates to tier 1 when idleMs >= 30 s and frequency has elapsed", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);
			expect(events[0].tier).toBe(1);
		});

		it("uses thought bubble at tier 1", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].bubbleKind).toBe("thought");
		});

		it("does not fire before frequency elapses at tier 1", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS - 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(0);
		});
	});

	// ── Tier 2 — nudge ────────────────────────────────────────────────

	describe("tier 2 — nudge", () => {
		it("escalates to tier 2 when idleMs >= 90 s and frequency has elapsed", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ2_MS + 1, () => makePresence(TIER2_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);
			expect(events[0].tier).toBe(2);
		});

		it("uses speech bubble at tier 2", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ2_MS + 1, () => makePresence(TIER2_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].bubbleKind).toBe("speech");
		});
	});

	// ── Tier 3 — offer ────────────────────────────────────────────────

	describe("tier 3 — offer", () => {
		it("escalates to tier 3 when idleMs >= 180 s and frequency has elapsed", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ3_MS + 1, () => makePresence(TIER3_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);
			expect(events[0].tier).toBe(3);
		});

		it("includes a toolOfferId at tier 3", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ3_MS + 1, () => makePresence(TIER3_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].toolOfferId).toBeDefined();
		});

		it("never exceeds tier 3 even with very long idle time", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			// 10 minutes idle — still tier 3
			system.update(FREQ3_MS + 1, () => makePresence(600_000), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].tier).toBe(3);
		});
	});

	// ── Frequency limits ──────────────────────────────────────────────

	describe("frequency limits", () => {
		it("fires only once per tier-frequency window", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			// First fire
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);

			// Engagement auto-dismisses after engagementDuration
			system.dismissEngagement();

			// Not enough time has passed for the next fire
			system.update(100, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);
		});

		it("fires again after the frequency window has elapsed", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			// First fire
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);

			system.dismissEngagement();

			// Advance past tier-1 frequency window — keep idleMs at tier 1 level to avoid tier escalation
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(2);
		});
	});

	// ── Director interaction resets ───────────────────────────────────

	describe("dismissEngagement() / director reset", () => {
		it("blocks engagement while director is active (idleMs=0)", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			// Director has been interacting the whole time — idle=0
			system.update(FREQ1_MS + 1, () => makePresence(0), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(0);
		});

		it("resets timer when director acts — requires full frequency window before next fire", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			// First fire
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);

			// Director acts — idleMs becomes 0, timer resets
			system.dismissEngagement();
			system.update(1, () => makePresence(0), makeNeeds, alwaysIdle, noSensor);

			// Not enough time has passed since reset — below frequency window
			system.update(100, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);
		});
	});

	// ── Agent selection ───────────────────────────────────────────────

	describe("agent selection — priority order", () => {
		it("selects highest-CHA idle agent as fallback", () => {
			system.register("Alice", { domain: "engineering", cha: 5 });
			system.register("Bob", { domain: "engineering", cha: 15 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].agentName).toBe("Bob");
		});

		it("prefers low-morale agent over highest CHA", () => {
			system.register("Alice", { domain: "engineering", cha: 5 });
			system.register("Bob", { domain: "engineering", cha: 15 });

			const getNeedsWithLowMorale = (name: string): AgentNeeds => {
				if (name === "Alice") return makeNeedsFrom({ morale: 20 }); // low morale
				return makeNeedsFrom({});
			};

			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), getNeedsWithLowMorale, alwaysIdle, noSensor);
			expect(events[0].agentName).toBe("Alice");
		});

		it("prefers sensor-pending agent over low-morale agent", () => {
			system.register("Alice", { domain: "engineering", cha: 5 });
			system.register("Bob", { domain: "engineering", cha: 15 });

			const getNeedsWithLowMorale = (name: string): AgentNeeds => {
				if (name === "Alice") return makeNeedsFrom({ morale: 20 }); // low morale
				return makeNeedsFrom({});
			};

			const hasSensorForBob = (name: string): boolean => name === "Bob";

			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), getNeedsWithLowMorale, alwaysIdle, hasSensorForBob);
			// Bob has pending sensor — takes priority over Alice's low morale
			expect(events[0].agentName).toBe("Bob");
		});

		it("prefers task-completed agent over highest-CHA fallback", () => {
			system.register("Alice", { domain: "engineering", cha: 5 });
			system.register("Bob", { domain: "engineering", cha: 15 });

			system.markTaskCompleted("Alice");

			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].agentName).toBe("Alice");
		});
	});

	// ── Skips busy agents ─────────────────────────────────────────────

	describe("skips busy agents", () => {
		it("does not engage a working agent", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysBusy, noSensor);
			// Alice is busy — no eligible agents
			expect(events).toHaveLength(0);
		});

		it("engages an idle agent when another is busy", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.register("Bob", { domain: "engineering", cha: 8 });

			const getState = (name: string): BrainState => name === "Alice" ? "working" : "idle";

			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, getState, noSensor);
			expect(events).toHaveLength(1);
			expect(events[0].agentName).toBe("Bob");
		});
	});

	// ── markTaskCompleted / clearTaskCompleted ────────────────────────

	describe("markTaskCompleted() / clearTaskCompleted()", () => {
		it("clearTaskCompleted removes the agent from pending completions", () => {
			system.register("Alice", { domain: "engineering", cha: 5 });
			system.register("Bob", { domain: "engineering", cha: 15 });

			system.markTaskCompleted("Alice");
			system.clearTaskCompleted("Alice");

			// Alice no longer pending — Bob should win as highest CHA
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events[0].agentName).toBe("Bob");
		});
	});

	// ── One engagement at a time ──────────────────────────────────────

	describe("one engagement at a time", () => {
		it("does not fire a second engagement while one is active", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);

			// Try to fire again before dismissal
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS + FREQ1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);
		});

		it("auto-dismisses after engagementDuration and allows next fire", () => {
			system.register("Alice", { domain: "engineering", cha: 10 });
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(1);

			// Auto-dismiss after engagementDuration passes — keep idleMs at tier 1 to avoid tier escalation
			const engDuration = DEFAULT_WORLD_CONFIG.engagement.engagementDuration;
			system.update(engDuration + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			// timeSinceLastEngagement accumulated during active window — advance past full frequency window
			system.update(FREQ1_MS + 1, () => makePresence(TIER1_MS), makeNeeds, alwaysIdle, noSensor);
			expect(events).toHaveLength(2);
		});
	});
});
