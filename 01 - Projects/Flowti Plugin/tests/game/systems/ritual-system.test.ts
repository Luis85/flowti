import { describe, it, expect, vi, beforeEach } from "vitest";
import { RitualSystem, parseRitualMarkdown, parseDurationMs } from "../../../src/game/systems/ritual-system.js";
import type { RitualDefinition, RitualPhase } from "../../../src/game/systems/ritual-system.js";
import type { BrainState } from "../../../src/game/brain/brain-types.js";

// ── Helpers ────────────────────────────────────────────────────────────

const IDLE: BrainState = "idle";
const getIdleState = (_name: string): BrainState => IDLE;

function makeRitual(overrides: Partial<RitualDefinition> = {}): RitualDefinition {
	return {
		name: "Morning Standup",
		trigger: "manual",
		participants: "all",
		duration: 30_000,
		cooldown: 60_000,
		gatherPoint: "center",
		settleMs: 2_000,
		lines: ["Hello, {name}!", "Let's go!"],
		reactionEmote: "random",
		disperse: true,
		...overrides,
	};
}

const SAMPLE_MARKDOWN = `---
name: Morning Standup
trigger: schedule
schedule: 09:00
participants: all
duration: 5m
cooldown: 24h
gather: center
settle: 2s
emote: random
disperse: true
---

- "Good morning, {name}!"
- "Let's kick off the day."
`;

// ── parseDurationMs ────────────────────────────────────────────────────

describe("parseDurationMs()", () => {
	it("parses seconds", () => {
		expect(parseDurationMs("30s")).toBe(30_000);
		expect(parseDurationMs("2s")).toBe(2_000);
	});

	it("parses minutes", () => {
		expect(parseDurationMs("2m")).toBe(120_000);
		expect(parseDurationMs("5m")).toBe(300_000);
	});

	it("parses hours", () => {
		expect(parseDurationMs("1h")).toBe(3_600_000);
		expect(parseDurationMs("24h")).toBe(86_400_000);
	});

	it("parses milliseconds", () => {
		expect(parseDurationMs("500ms")).toBe(500);
	});

	it("returns 0 for unknown format", () => {
		expect(parseDurationMs("bad")).toBe(0);
	});
});

// ── parseRitualMarkdown ────────────────────────────────────────────────

describe("parseRitualMarkdown()", () => {
	it("parses frontmatter and body from sample markdown", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.name).toBe("Morning Standup");
		expect(def.trigger).toBe("schedule");
		expect(def.schedule).toBe("09:00");
		expect(def.participants).toBe("all");
	});

	it("parses duration in minutes", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.duration).toBe(300_000);   // 5m
	});

	it("parses cooldown in hours", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.cooldown).toBe(86_400_000); // 24h
	});

	it("parses settle in seconds", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.settleMs).toBe(2_000);      // 2s
	});

	it("parses gather: center", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.gatherPoint).toBe("center");
	});

	it("parses emote: random", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.reactionEmote).toBe("random");
	});

	it("parses disperse: true", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.disperse).toBe(true);
	});

	it("parses lines from body", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.lines).toHaveLength(2);
		expect(def.lines[0]).toBe("Good morning, {name}!");
		expect(def.lines[1]).toBe("Let's kick off the day.");
	});

	it("parses schedule trigger with schedule field", () => {
		const def = parseRitualMarkdown(SAMPLE_MARKDOWN);
		expect(def.trigger).toBe("schedule");
		expect(def.schedule).toBe("09:00");
		expect(def.event).toBeUndefined();
	});

	it("parses event trigger with event field", () => {
		const md = `---
name: Test Ritual
trigger: event
event: test-pass
participants: all
duration: 1m
cooldown: 1h
gather: center
settle: 1s
emote: random
disperse: true
---
`;
		const def = parseRitualMarkdown(md);
		expect(def.trigger).toBe("event");
		expect(def.event).toBe("test-pass");
		expect(def.schedule).toBeUndefined();
	});

	it("parses numeric emote value", () => {
		const md = `---
name: Test
trigger: manual
participants: all
duration: 1m
cooldown: 1h
gather: center
settle: 1s
emote: 5
disperse: false
---
`;
		const def = parseRitualMarkdown(md);
		expect(def.reactionEmote).toBe(5);
	});
});

// ── RitualSystem ───────────────────────────────────────────────────────

describe("RitualSystem", () => {
	let system: RitualSystem;
	let phases: RitualPhase[];

	beforeEach(() => {
		system = new RitualSystem();
		phases = [];
		system.onPhase((p) => phases.push(p));
	});

	// ── No-op with no rituals ─────────────────────────────────────────

	describe("with no rituals loaded", () => {
		it("does nothing on update", () => {
			system.register("Alice", { domain: "engineering" });
			system.update(1000, getIdleState);
			expect(phases).toHaveLength(0);
		});

		it("triggerManual does nothing when ritual not loaded", () => {
			system.register("Alice", { domain: "engineering" });
			system.triggerManual("Morning Standup");
			system.update(1000, getIdleState);
			expect(phases).toHaveLength(0);
		});
	});

	// ── register / unregister ─────────────────────────────────────────

	describe("register() / unregister()", () => {
		it("registers without throwing", () => {
			expect(() => system.register("Alice", { domain: "engineering" })).not.toThrow();
		});

		it("unregisters without throwing", () => {
			system.register("Alice", { domain: "engineering" });
			expect(() => system.unregister("Alice")).not.toThrow();
		});
	});

	// ── Manual trigger ────────────────────────────────────────────────

	describe("triggerManual()", () => {
		it("fires gather phase with participant names", () => {
			system.register("Alice", { domain: "engineering" });
			system.register("Bob", { domain: "quality" });
			system.loadRitual(makeRitual());

			system.triggerManual("Morning Standup");

			const gather = phases.find((p) => p.kind === "gather");
			expect(gather).toBeDefined();
			expect((gather as Extract<RitualPhase, { kind: "gather" }>).participants).toContain("Alice");
			expect((gather as Extract<RitualPhase, { kind: "gather" }>).participants).toContain("Bob");
		});

		it("fires settle phase after update", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({ settleMs: 1000 }));

			system.triggerManual("Morning Standup");
			system.update(100, getIdleState);

			const settle = phases.find((p) => p.kind === "settle");
			expect(settle).toBeDefined();
		});

		it("fires line phases after settle completes", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({ settleMs: 0, lines: ["Hello, {name}!"] }));

			system.triggerManual("Morning Standup");
			system.update(100, getIdleState);   // gather → settle
			system.update(100, getIdleState);   // settle completes (settleMs=0), fires line

			const line = phases.find((p) => p.kind === "line");
			expect(line).toBeDefined();
			expect((line as Extract<RitualPhase, { kind: "line" }>).agentName).toBe("Alice");
			expect((line as Extract<RitualPhase, { kind: "line" }>).text).toContain("Alice");
		});

		it("does not start a second ritual while one is already running", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual());

			system.triggerManual("Morning Standup");
			system.triggerManual("Morning Standup");

			const gatherPhases = phases.filter((p) => p.kind === "gather");
			expect(gatherPhases).toHaveLength(1);
		});
	});

	// ── Event trigger ─────────────────────────────────────────────────

	describe("triggerEvent()", () => {
		it("triggers a ritual by event key", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({ trigger: "event", event: "test-pass" }));

			system.triggerEvent("test-pass");

			const gather = phases.find((p) => p.kind === "gather");
			expect(gather).toBeDefined();
		});

		it("does not trigger for unknown event key", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({ trigger: "event", event: "test-pass" }));

			system.triggerEvent("build-failure");

			expect(phases).toHaveLength(0);
		});
	});

	// ── Cooldown ──────────────────────────────────────────────────────

	describe("cooldown", () => {
		it("blocks re-trigger immediately after completion", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({
				settleMs: 0,
				lines: [],
				cooldown: 60_000,
				// Very short duration to force-complete quickly
				duration: 1,
			}));

			system.triggerManual("Morning Standup");
			// Duration exceeded on first update → forced disperse → cooldown set
			system.update(100, getIdleState);

			// Clear phases and try to re-trigger
			phases.length = 0;
			system.triggerManual("Morning Standup");

			const gather = phases.find((p) => p.kind === "gather");
			expect(gather).toBeUndefined();
		});

		it("allows re-trigger after cooldown expires", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({
				settleMs: 0,
				lines: [],
				cooldown: 1_000,
				duration: 1,
			}));

			system.triggerManual("Morning Standup");
			system.update(100, getIdleState);   // completes, sets cooldown

			// Advance past cooldown
			system.update(2_000, getIdleState);

			phases.length = 0;
			system.triggerManual("Morning Standup");

			const gather = phases.find((p) => p.kind === "gather");
			expect(gather).toBeDefined();
		});
	});

	// ── Duration limit ────────────────────────────────────────────────

	describe("duration limit", () => {
		it("force-disperses when total elapsed exceeds duration", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({ duration: 500, settleMs: 5_000, disperse: true }));

			system.triggerManual("Morning Standup");
			// Advance past duration limit
			system.update(600, getIdleState);

			const disperse = phases.find((p) => p.kind === "disperse");
			expect(disperse).toBeDefined();
		});
	});

	// ── Template substitution ─────────────────────────────────────────

	describe("line template substitution", () => {
		it("substitutes {name} with agent name", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({
				settleMs: 0,
				lines: ["Hello, {name}!"],
			}));

			system.triggerManual("Morning Standup");
			system.update(100, getIdleState);  // gather → settle
			system.update(100, getIdleState);  // settle → line

			const line = phases.find((p) => p.kind === "line") as Extract<RitualPhase, { kind: "line" }> | undefined;
			expect(line?.text).toContain("Alice");
		});

		it("substitutes {domain} with agent domain", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({
				settleMs: 0,
				lines: ["Domain: {domain}"],
			}));

			system.triggerManual("Morning Standup");
			system.update(100, getIdleState);
			system.update(100, getIdleState);

			const line = phases.find((p) => p.kind === "line") as Extract<RitualPhase, { kind: "line" }> | undefined;
			expect(line?.text).toContain("engineering");
		});
	});

	// ── Participant selection ─────────────────────────────────────────

	describe("participant selection", () => {
		it("selects all registered agents when participants=all", () => {
			system.register("Alice", { domain: "engineering" });
			system.register("Bob", { domain: "quality" });
			system.register("Carol", { domain: "design" });
			system.loadRitual(makeRitual({ participants: "all" }));

			system.triggerManual("Morning Standup");

			const gather = phases.find((p) => p.kind === "gather") as Extract<RitualPhase, { kind: "gather" }>;
			expect(gather.participants).toHaveLength(3);
		});

		it("selects agents by domain when participants=domain:X", () => {
			system.register("Alice", { domain: "engineering" });
			system.register("Bob", { domain: "quality" });
			system.loadRitual(makeRitual({ participants: "domain:engineering" }));

			system.triggerManual("Morning Standup");

			const gather = phases.find((p) => p.kind === "gather") as Extract<RitualPhase, { kind: "gather" }>;
			expect(gather.participants).toContain("Alice");
			expect(gather.participants).not.toContain("Bob");
		});

		it("does not start ritual when no participants match domain filter", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({ participants: "domain:nonexistent" }));

			system.triggerManual("Morning Standup");

			expect(phases).toHaveLength(0);
		});
	});

	// ── Full phase sequence ───────────────────────────────────────────

	describe("full phase sequence", () => {
		it("runs gather → settle → line → reaction → disperse", () => {
			system.register("Alice", { domain: "engineering" });
			system.loadRitual(makeRitual({
				settleMs: 0,
				lines: ["Hello!"],
				reactionEmote: "random",
				disperse: true,
				duration: 60_000,
			}));

			system.triggerManual("Morning Standup");
			system.update(100, getIdleState);    // gather → settle
			system.update(100, getIdleState);    // settle → line (settleMs=0)
			system.update(2_100, getIdleState);  // line gap passes → reaction
			system.update(1_100, getIdleState);  // reaction completes → disperse

			const kinds = phases.map((p) => p.kind);
			expect(kinds).toContain("gather");
			expect(kinds).toContain("settle");
			expect(kinds).toContain("line");
			expect(kinds).toContain("reaction");
			expect(kinds).toContain("disperse");
		});
	});
});
