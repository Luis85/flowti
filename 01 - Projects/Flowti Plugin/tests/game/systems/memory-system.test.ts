import { describe, it, expect } from "vitest";
import { MemorySystem } from "../../../src/game/systems/memory-system.js";

describe("MemorySystem", () => {
	describe("registration", () => {
		it("initializes with default memory for new agent", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			const mem = sys.getMemory("Atlas");
			expect(mem.daysActive).toBe(0);
			expect(mem.workStreak).toBe(0);
			expect(mem.quirks).toEqual([]);
			expect(mem.milestones).toContain("first-day");
		});
	});

	describe("events", () => {
		it("records a recent event", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.recordEvent("Atlas", { cycle: 1, type: "conversation", with: "Rex", summary: "Chatted with Rex" });
			expect(sys.getMemory("Atlas").recentEvents).toHaveLength(1);
		});

		it("prunes to max 20 events", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 25; i++) {
				sys.recordEvent("Atlas", { cycle: 1, type: "test", summary: `Event ${i}` });
			}
			expect(sys.getMemory("Atlas").recentEvents).toHaveLength(20);
		});
	});

	describe("visit tracking", () => {
		it("increments visit count for an object", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.recordVisit("Atlas", "coffee-machine");
			sys.recordVisit("Atlas", "coffee-machine");
			expect(sys.getMemory("Atlas").visitCounts["coffee-machine"]).toBe(2);
		});

		it("updates preferred object when visit count is highest", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.recordVisit("Atlas", "coffee-machine");
			sys.recordVisit("Atlas", "coffee-machine");
			sys.recordVisit("Atlas", "whiteboard");
			expect(sys.getMemory("Atlas").preferredObject).toBe("coffee-machine");
		});
	});

	describe("streaks", () => {
		it("increments work streak on cycle end with task", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 2, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").workStreak).toBe(1);
		});

		it("resets work streak when no task completed", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 2, dominantMood: "neutral" });
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 1, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").workStreak).toBe(0);
		});

		it("tracks longest work streak", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 0, dominantMood: "neutral" });
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 0, dominantMood: "neutral" });
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").longestWorkStreak).toBe(2);
		});

		it("increments social streak when 3+ conversations", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 3, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").socialStreak).toBe(1);
		});
	});

	describe("milestones", () => {
		it("awards work-streak-5 at 5 consecutive completions", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 5; i++) {
				sys.onCycleEnd("Atlas", { completedTask: true, conversations: 0, dominantMood: "neutral" });
			}
			expect(sys.getMemory("Atlas").milestones).toContain("work-streak-5");
		});

		it("awards early-adopter at 25 days active", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 25; i++) {
				sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			}
			expect(sys.getMemory("Atlas").milestones).toContain("early-adopter");
		});

		it("does not duplicate milestones", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 30; i++) {
				sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			}
			const count = sys.getMemory("Atlas").milestones.filter((m) => m === "early-adopter").length;
			expect(count).toBe(1);
		});
	});

	describe("mood log", () => {
		it("logs dominant mood per cycle", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "frustrated" });
			expect(sys.getMemory("Atlas").moodLog[0].dominant).toBe("frustrated");
		});

		it("keeps max 10 mood entries", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 15; i++) {
				sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			}
			expect(sys.getMemory("Atlas").moodLog).toHaveLength(10);
		});
	});

	describe("persistence", () => {
		it("serialize returns all agent memories", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.register("Rex");
			const data = sys.serialize();
			expect(Object.keys(data)).toContain("Atlas");
			expect(Object.keys(data)).toContain("Rex");
		});

		it("restore loads saved memory", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 5, dominantMood: "excited" });
			const data = sys.serialize();

			const sys2 = new MemorySystem();
			sys2.restore(data);
			expect(sys2.getMemory("Atlas").workStreak).toBe(1);
			expect(sys2.getMemory("Atlas").socialStreak).toBe(1);
		});
	});
});
