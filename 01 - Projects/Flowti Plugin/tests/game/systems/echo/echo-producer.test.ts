import { describe, it, expect, beforeEach } from "vitest";
import { EchoProducer } from "../../../../src/game/systems/echo/echo-producer.js";
import { EchoStore } from "../../../../src/game/systems/echo/echo-store.js";
import type { AddResult } from "../../../../src/game/systems/echo/echo-types.js";

// ── Tests ───────────────────────────────────────────────────────────

describe("EchoProducer", () => {
	let store: EchoStore;
	let producer: EchoProducer;

	beforeEach(() => {
		store = new EchoStore();
		producer = new EchoProducer(store);
	});

	// ── onConversation ──────────────────────────────────────────────

	describe("onConversation", () => {
		it("creates opinion echoes for both agents at friend tier", () => {
			producer.onConversation("Atlas", "Rex", "friend", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(5);
			expect(store.queryWeight("Rex", "opinion", "Atlas")).toBe(5);
		});

		it("creates opinion echoes at best-friend tier", () => {
			producer.onConversation("Atlas", "Rex", "best-friend", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(5);
			expect(store.queryWeight("Rex", "opinion", "Atlas")).toBe(5);
		});

		it("ignores acquaintance tier", () => {
			producer.onConversation("Atlas", "Rex", "acquaintance", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(0);
			expect(store.queryWeight("Rex", "opinion", "Atlas")).toBe(0);
		});

		it("ignores colleague tier", () => {
			producer.onConversation("Atlas", "Rex", "colleague", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(0);
		});

		it("ignores rival tier", () => {
			producer.onConversation("Atlas", "Rex", "rival", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(0);
		});
	});

	// ── onTaskComplete ──────────────────────────────────────────────

	describe("onTaskComplete", () => {
		it("creates preference on success", () => {
			producer.onTaskComplete("Atlas", "coding", true, 1);

			expect(store.queryWeight("Atlas", "preference", "coding")).toBe(10);
		});

		it("creates aversion on failure", () => {
			producer.onTaskComplete("Atlas", "coding", false, 1);

			expect(store.queryWeight("Atlas", "aversion", "coding")).toBe(-15);
		});
	});

	// ── onMorale ────────────────────────────────────────────────────

	describe("onMorale", () => {
		it("creates negative residue below 20", () => {
			producer.onMorale("Atlas", 10, 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(-10);
		});

		it("creates positive residue above 80", () => {
			producer.onMorale("Atlas", 90, 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(8);
		});

		it("ignores normal morale range (20-80)", () => {
			producer.onMorale("Atlas", 50, 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(0);
		});

		it("ignores morale at boundary 20", () => {
			producer.onMorale("Atlas", 20, 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(0);
		});

		it("ignores morale at boundary 80", () => {
			producer.onMorale("Atlas", 80, 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(0);
		});
	});

	// ── Cooldown ────────────────────────────────────────────────────

	describe("cooldown", () => {
		it("prevents same source twice in one cycle", () => {
			producer.onConversation("Atlas", "Rex", "friend", 1);
			producer.onConversation("Atlas", "Rex", "friend", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(5);
		});

		it("allows echo in next cycle", () => {
			producer.onConversation("Atlas", "Rex", "friend", 1);
			producer.onConversation("Atlas", "Rex", "friend", 2);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(10);
		});
	});

	// ── onGossipHeard ───────────────────────────────────────────────

	describe("onGossipHeard", () => {
		it("creates reputation echo on listener about subject", () => {
			producer.onGossipHeard("Atlas", "Rex", "Chip", 1);

			expect(store.queryWeight("Atlas", "reputation", "Chip")).toBe(-8);
		});
	});

	// ── onPetComfort ────────────────────────────────────────────────

	describe("onPetComfort", () => {
		it("creates bond echo", () => {
			producer.onPetComfort("Atlas", "cat-01", 1);

			expect(store.queryWeight("Atlas", "bond", "cat-01")).toBe(10);
		});
	});

	// ── onSnackStolen ───────────────────────────────────────────────

	describe("onSnackStolen", () => {
		it("creates aversion echo", () => {
			producer.onSnackStolen("Atlas", "cat-01", 1);

			expect(store.queryWeight("Atlas", "aversion", "cat-01")).toBe(-8);
		});
	});

	// ── onPairedWork ────────────────────────────────────────────────

	describe("onPairedWork", () => {
		it("creates preference on both agents", () => {
			producer.onPairedWork("Atlas", "Rex", 1);

			expect(store.queryWeight("Atlas", "preference", "Rex")).toBe(5);
			expect(store.queryWeight("Rex", "preference", "Atlas")).toBe(5);
		});
	});

	// ── onRivalConversation ─────────────────────────────────────────

	describe("onRivalConversation", () => {
		it("creates negative opinion on both agents", () => {
			producer.onRivalConversation("Atlas", "Rex", 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(-6);
			expect(store.queryWeight("Rex", "opinion", "Atlas")).toBe(-6);
		});
	});

	// ── onDrama ─────────────────────────────────────────────────────

	describe("onDrama", () => {
		it("creates positive opinion when positive", () => {
			producer.onDrama("Atlas", "Rex", true, 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(15);
			expect(store.queryWeight("Rex", "opinion", "Atlas")).toBe(15);
		});

		it("creates negative opinion when negative", () => {
			producer.onDrama("Atlas", "Rex", false, 1);

			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(-15);
			expect(store.queryWeight("Rex", "opinion", "Atlas")).toBe(-15);
		});
	});

	// ── onGossipOverheard ───────────────────────────────────────────

	describe("onGossipOverheard", () => {
		it("creates negative opinion on subject about gossiper", () => {
			producer.onGossipOverheard("Chip", "Rex", 1);

			expect(store.queryWeight("Chip", "opinion", "Rex")).toBe(-12);
		});
	});

	// ── onFedByDirector ─────────────────────────────────────────────

	describe("onFedByDirector", () => {
		it("creates bond to director", () => {
			producer.onFedByDirector("Atlas", 1);

			expect(store.queryWeight("Atlas", "bond", "director")).toBe(8);
		});
	});

	// ── onRunningJoke ───────────────────────────────────────────────

	describe("onRunningJoke", () => {
		it("creates memory on both agents", () => {
			producer.onRunningJoke("Atlas", "Rex", "joke-01", 1);

			expect(store.queryWeight("Atlas", "memory", "joke-01")).toBe(4);
			expect(store.queryWeight("Rex", "memory", "joke-01")).toBe(4);
		});
	});

	// ── onRitual ────────────────────────────────────────────────────

	describe("onRitual", () => {
		it("creates preference echo", () => {
			producer.onRitual("Atlas", "morning-coffee", 1);

			expect(store.queryWeight("Atlas", "preference", "morning-coffee")).toBe(3);
		});
	});

	// ── onMerchantPurchase ──────────────────────────────────────────

	describe("onMerchantPurchase", () => {
		it("creates opinion about director", () => {
			producer.onMerchantPurchase("Atlas", 1);

			expect(store.queryWeight("Atlas", "opinion", "director")).toBe(6);
		});
	});

	// ── onNeedsNeglected ────────────────────────────────────────────

	describe("onNeedsNeglected", () => {
		it("creates aversion to needs", () => {
			producer.onNeedsNeglected("Atlas", 1);

			expect(store.queryWeight("Atlas", "aversion", "needs")).toBe(-6);
		});
	});

	// ── onLevelUp ───────────────────────────────────────────────────

	describe("onLevelUp", () => {
		it("creates positive mood residue", () => {
			producer.onLevelUp("Atlas", 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(12);
		});
	});

	// ── onOfflineReturn ─────────────────────────────────────────────

	describe("onOfflineReturn", () => {
		it("creates positive mood residue", () => {
			producer.onOfflineReturn("Atlas", 1);

			expect(store.queryWeight("Atlas", "mood-residue")).toBe(5);
		});
	});

	// ── Cooldown key includes kind ─────────────────────────────────

	describe("cooldown key includes kind", () => {
		it("allows different echo kinds with same source/target in same cycle", () => {
			// onTaskComplete(success) produces kind=preference, source=task-complete
			// onTaskComplete(failure) produces kind=aversion, source=task-complete
			// Different kinds should both fire in the same cycle
			producer.onTaskComplete("Atlas", "coding", true, 1);
			producer.onTaskComplete("Atlas", "coding", false, 1);

			// Both echoes should have been added (preference + aversion)
			expect(store.queryWeight("Atlas", "preference", "coding")).toBe(10);
			expect(store.queryWeight("Atlas", "aversion", "coding")).toBe(-15);
		});
	});

	// ── Cascade callback ───────────────────────────────────────────

	describe("cascade callback", () => {
		it("fires when echo crosses cascade threshold", () => {
			const cascades: Array<{ agent: string; result: AddResult }> = [];
			const callbackProducer = new EchoProducer(store, (agent, result) => {
				cascades.push({ agent, result });
			});

			// Drama creates weight 15 which equals CASCADE_THRESHOLD (15)
			callbackProducer.onDrama("Atlas", "Rex", true, 1);

			// Both agents get weight 15 echoes — both should trigger cascade
			expect(cascades.length).toBe(2);
			expect(cascades[0].agent).toBe("Atlas");
			expect(cascades[0].result.cascadeTriggered).toBe(true);
			expect(cascades[1].agent).toBe("Rex");
		});

		it("does not fire for sub-threshold echoes", () => {
			const cascades: Array<{ agent: string; result: AddResult }> = [];
			const callbackProducer = new EchoProducer(store, (agent, result) => {
				cascades.push({ agent, result });
			});

			// Conversation creates weight 5 which is below threshold
			callbackProducer.onConversation("Atlas", "Rex", "friend", 1);

			expect(cascades.length).toBe(0);
		});

		it("does not fire when cooldown blocks the echo", () => {
			const cascades: Array<{ agent: string; result: AddResult }> = [];
			const callbackProducer = new EchoProducer(store, (agent, result) => {
				cascades.push({ agent, result });
			});

			callbackProducer.onDrama("Atlas", "Rex", true, 1);
			const firstCount = cascades.length;

			// Same cycle — cooldown blocks
			callbackProducer.onDrama("Atlas", "Rex", true, 1);
			expect(cascades.length).toBe(firstCount);
		});

		it("works without callback (backward compatible)", () => {
			const noCallbackProducer = new EchoProducer(store);
			// Should not throw
			noCallbackProducer.onDrama("Atlas", "Rex", true, 1);
			expect(store.queryWeight("Atlas", "opinion", "Rex")).toBe(15);
		});
	});
});
