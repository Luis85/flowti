import { describe, it, expect } from "vitest";
import { RelationshipSystem } from "../../../src/game/systems/relationship-system.js";

describe("RelationshipSystem", () => {
	describe("registration", () => {
		it("registers agents with opinions", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "B" }]);
			expect(sys.getOpinions("Atlas")).toHaveLength(1);
		});
	});

	describe("affinity", () => {
		it("starts at 0 for new pairs", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			expect(sys.getAffinity("Atlas", "Rex")).toBe(0);
		});

		it("recordConversation increases affinity by 2", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordConversation("Atlas", "Rex");
			expect(sys.getAffinity("Atlas", "Rex")).toBe(2);
		});

		it("recordCluster increases affinity by 1 for each pair", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.register("Sage", []);
			sys.recordCluster(["Atlas", "Rex", "Sage"]);
			expect(sys.getAffinity("Atlas", "Rex")).toBe(1);
			expect(sys.getAffinity("Atlas", "Sage")).toBe(1);
			expect(sys.getAffinity("Rex", "Sage")).toBe(1);
		});

		it("clamps affinity to -100..100", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			// Force high affinity
			for (let i = 0; i < 60; i++) sys.recordConversation("Atlas", "Rex");
			expect(sys.getAffinity("Atlas", "Rex")).toBeLessThanOrEqual(100);
		});

		it("is symmetric — A→B equals B→A", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordConversation("Atlas", "Rex");
			expect(sys.getAffinity("Rex", "Atlas")).toBe(2);
		});
	});

	describe("tiers", () => {
		it("returns acquaintance for affinity 0-15", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			expect(sys.getTier("Atlas", "Rex")).toBe("acquaintance");
		});

		it("returns colleague for affinity 16-50", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 9; i++) sys.recordConversation("Atlas", "Rex"); // 18
			expect(sys.getTier("Atlas", "Rex")).toBe("colleague");
		});

		it("returns friend for affinity 51-80", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 26; i++) sys.recordConversation("Atlas", "Rex"); // 52
			expect(sys.getTier("Atlas", "Rex")).toBe("friend");
		});

		it("returns best-friend for affinity 81+", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 41; i++) sys.recordConversation("Atlas", "Rex"); // 82
			expect(sys.getTier("Atlas", "Rex")).toBe("best-friend");
		});
	});

	describe("opinion clashes", () => {
		it("shouldBicker returns true when agents have opposing opinions", () => {
			const sys = new RelationshipSystem(1.0); // 100% bicker chance
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "B" }]);
			expect(sys.shouldBicker("Atlas", "Rex")).toBe(true);
		});

		it("shouldBicker returns false when no opinion clash", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "A" }]);
			expect(sys.shouldBicker("Atlas", "Rex")).toBe(false);
		});

		it("recordBicker decreases affinity by 3", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordBicker("Atlas", "Rex");
			expect(sys.getAffinity("Atlas", "Rex")).toBe(-3);
		});
	});

	describe("shared memories", () => {
		it("records shared memories up to max 5", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 7; i++) {
				sys.addSharedMemory("Atlas", "Rex", `Event ${i}`);
			}
			const entry = sys.getRelationship("Atlas", "Rex");
			expect(entry!.sharedMemories).toHaveLength(5);
			expect(entry!.sharedMemories[4]).toBe("Event 6");
		});
	});

	describe("cycle decay", () => {
		it("decays affinity toward 0 for inactive pairs", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			for (let i = 0; i < 5; i++) sys.recordConversation("Atlas", "Rex"); // 10
			sys.onCycleEnd(); // clears interacted set (pair was active, no decay)
			sys.onCycleEnd(); // now pair is inactive — decay by 1
			expect(sys.getAffinity("Atlas", "Rex")).toBe(9); // -1 decay
		});

		it("does not decay below 0 for positive affinity", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordConversation("Atlas", "Rex"); // 2
			sys.onCycleEnd(); // 1
			sys.onCycleEnd(); // 0
			sys.onCycleEnd(); // still 0
			expect(sys.getAffinity("Atlas", "Rex")).toBe(0);
		});

		it("does not decay above 0 for negative affinity", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.recordBicker("Atlas", "Rex"); // -3
			sys.onCycleEnd(); // -2
			sys.onCycleEnd(); // -1
			sys.onCycleEnd(); // 0
			sys.onCycleEnd(); // still 0
			expect(sys.getAffinity("Atlas", "Rex")).toBe(0);
		});
	});

	describe("persistence", () => {
		it("serialize and restore preserves state", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", [{ topic: "tabs-vs-spaces", side: "A" }]);
			sys.register("Rex", [{ topic: "tabs-vs-spaces", side: "B" }]);
			sys.recordConversation("Atlas", "Rex");
			sys.addSharedMemory("Atlas", "Rex", "Fixed a bug together");
			const data = sys.serialize();

			const sys2 = new RelationshipSystem();
			sys2.restore(data);
			expect(sys2.getAffinity("Atlas", "Rex")).toBe(2);
			expect(sys2.getRelationship("Atlas", "Rex")!.sharedMemories).toContain("Fixed a bug together");
			expect(sys2.getOpinions("Atlas")).toHaveLength(1);
		});
	});

	describe("petAffinity", () => {
		it("starts at 50 for unknown agents", () => {
			const sys = new RelationshipSystem();
			expect(sys.getPetAffinity("Atlas")).toBe(50);
		});

		it("changePetAffinity adjusts and clamps 0-100", () => {
			const sys = new RelationshipSystem();
			sys.changePetAffinity("Atlas", 30);
			expect(sys.getPetAffinity("Atlas")).toBe(80);
			sys.changePetAffinity("Atlas", 30);
			expect(sys.getPetAffinity("Atlas")).toBe(100);
			sys.changePetAffinity("Atlas", -150);
			expect(sys.getPetAffinity("Atlas")).toBe(0);
		});

		it("serializes and restores petAffinity", () => {
			const sys = new RelationshipSystem();
			sys.changePetAffinity("Atlas", 10);
			const data = sys.serialize();
			const sys2 = new RelationshipSystem();
			sys2.restore(data);
			expect(sys2.getPetAffinity("Atlas")).toBe(60);
		});
	});

	describe("jokePlayCounts", () => {
		it("getJokePlayCount returns 0 for unplayed jokes", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			expect(sys.getJokePlayCount("Atlas", "Rex", "joke:tabs")).toBe(0);
		});

		it("incrementJokePlayCount tracks per-pair per-joke", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.incrementJokePlayCount("Atlas", "Rex", "joke:tabs");
			sys.incrementJokePlayCount("Atlas", "Rex", "joke:tabs");
			expect(sys.getJokePlayCount("Atlas", "Rex", "joke:tabs")).toBe(2);
			expect(sys.getJokePlayCount("Atlas", "Rex", "joke:other")).toBe(0);
		});

		it("jokePlayCounts survive serialize/restore", () => {
			const sys = new RelationshipSystem();
			sys.register("Atlas", []);
			sys.register("Rex", []);
			sys.incrementJokePlayCount("Atlas", "Rex", "joke:tabs");
			const data = sys.serialize();
			const sys2 = new RelationshipSystem();
			sys2.restore(data);
			expect(sys2.getJokePlayCount("Atlas", "Rex", "joke:tabs")).toBe(1);
		});
	});
});
