import { describe, it, expect, vi } from "vitest";
import { NarrativeSystem } from "../../../src/game/systems/narrative-system.js";
import type { StoryBeat } from "../../../src/game/systems/narrative-system.js";

function makeBeat(overrides: Partial<StoryBeat> = {}): StoryBeat {
	return {
		timestamp: 1000,
		phase: "morning-arrival",
		category: "task",
		actors: ["Atlas"],
		event: "task-completed",
		detail: { agent: "Atlas", domain: "build", count: "3", plural: "s" },
		...overrides,
	};
}

function makeDeps(overrides: Partial<{
	writeFile: (path: string, content: string) => void;
	narrativeDir: string;
	currentDate: () => string;
}> = {}) {
	return {
		writeFile: overrides.writeFile ?? vi.fn(),
		narrativeDir: overrides.narrativeDir ?? "/vault/narratives",
		currentDate: overrides.currentDate ?? (() => "2026-03-22"),
	};
}

describe("NarrativeSystem", () => {
	describe("recordBeat", () => {
		it("accumulates beats during a cycle", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat({ timestamp: 100 }));
			sys.recordBeat(makeBeat({ timestamp: 200 }));
			sys.recordBeat(makeBeat({ timestamp: 300 }));
			expect(sys.getCurrentBeats()).toHaveLength(3);
		});

		it("returns beats via getCurrentBeats", () => {
			const sys = new NarrativeSystem(makeDeps());
			const beat = makeBeat({ event: "task-assigned" });
			sys.recordBeat(beat);
			const beats = sys.getCurrentBeats();
			expect(beats[0].event).toBe("task-assigned");
		});
	});

	describe("composeCycleNarrative", () => {
		it("groups beats by narrative phase", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat({ phase: "morning-arrival" }));
			sys.recordBeat(makeBeat({ phase: "afternoon" }));
			const md = sys.composeCycleNarrative(1);
			expect(md).toContain("## Morning");
			expect(md).toContain("## Afternoon");
		});

		it("puts headlines before details within a phase", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat({
				phase: "morning-arrival",
				category: "task",
				event: "task-completed",
				detail: { agent: "Atlas", domain: "build", count: "1", plural: "" },
			}));
			sys.recordBeat(makeBeat({
				phase: "morning-arrival",
				category: "economy",
				event: "level-up",
				detail: { agent: "Nova", level: "5", xp: "1200" },
				actors: ["Nova"],
			}));
			const md = sys.composeCycleNarrative(1);
			const morningStart = md.indexOf("## Morning");
			const body = md.slice(morningStart);
			const headlineIdx = body.indexOf("Nova");
			const detailIdx = body.indexOf("Atlas");
			expect(headlineIdx).toBeLessThan(detailIdx);
		});

		it("interpolates variables in templates", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat({
				phase: "morning-arrival",
				category: "economy",
				event: "level-up",
				detail: { agent: "Nova", level: "5", xp: "1200" },
				actors: ["Nova"],
			}));
			const md = sys.composeCycleNarrative(1);
			expect(md).toContain("Nova");
			expect(md).toContain("5");
			expect(md).not.toContain("${agent}");
			expect(md).not.toContain("${level}");
		});

		it("includes YAML frontmatter with correct fields", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat({
				phase: "morning-arrival",
				category: "economy",
				event: "level-up",
				detail: { agent: "Atlas", level: "3", xp: "500" },
			}));
			const md = sys.composeCycleNarrative(1);
			expect(md).toMatch(/^---\n/);
			expect(md).toContain("type: narrative");
			expect(md).toContain("date: 2026-03-22");
			expect(md).toContain("cycle: 1");
			expect(md).toContain("offline: false");
			expect(md).toContain("agents:");
			expect(md).toContain("highlights:");
		});

		it("includes summary footer with day number", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat());
			const md = sys.composeCycleNarrative(7);
			expect(md).toContain("Day 7");
		});
	});

	describe("flushToVault", () => {
		it("writes markdown file to correct path", () => {
			const writeFile = vi.fn();
			const sys = new NarrativeSystem(makeDeps({ writeFile }));
			sys.recordBeat(makeBeat());
			sys.flushToVault(3);
			expect(writeFile).toHaveBeenCalledWith(
				"/vault/narratives/2026-03-22-day-3.md",
				expect.any(String),
			);
		});

		it("clears beats after flush", () => {
			const sys = new NarrativeSystem(makeDeps());
			sys.recordBeat(makeBeat());
			sys.flushToVault(1);
			expect(sys.getCurrentBeats()).toHaveLength(0);
		});

		it("skips write when no beats collected", () => {
			const writeFile = vi.fn();
			const sys = new NarrativeSystem(makeDeps({ writeFile }));
			sys.flushToVault(1);
			expect(writeFile).not.toHaveBeenCalled();
		});
	});

	describe("composeOfflineNarrative", () => {
		it("produces condensed summary with task count", () => {
			const sys = new NarrativeSystem(makeDeps());
			const result = sys.composeOfflineNarrative({
				cyclesSimulated: 3,
				agentResults: [
					{ name: "Atlas", tasksCompleted: 5, xpEarned: 200, leveledUp: false, currentLevel: 2 },
				],
			});
			expect(result).toContain("3");
			expect(result).toContain("Atlas");
			expect(result).toContain("5");
		});

		it("includes agent highlights for level-ups", () => {
			const sys = new NarrativeSystem(makeDeps());
			const result = sys.composeOfflineNarrative({
				cyclesSimulated: 1,
				agentResults: [
					{ name: "Nova", tasksCompleted: 10, xpEarned: 500, leveledUp: true, currentLevel: 5 },
					{ name: "Atlas", tasksCompleted: 2, xpEarned: 100, leveledUp: false, currentLevel: 1 },
				],
			});
			expect(result).toContain("Nova");
			expect(result).toContain("level 5");
		});
	});
});
