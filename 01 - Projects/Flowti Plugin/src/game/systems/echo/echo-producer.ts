/**
 * echo-producer.ts — Translates game events into echoes.
 *
 * Subscribes to game events (conversations, task completions, morale changes,
 * pet interactions, etc.) and calls echoStore.addEcho() with appropriate
 * parameters. Enforces a cooldown per source — same event source can't produce
 * echoes on the same agent in the same cycle.
 */

import type { AddResult, EchoInput, IEchoStore } from "./echo-types.js";

// ── Friendship Tiers ───────────────────────────────────────────────

const FRIEND_TIERS = new Set(["friend", "best-friend"]);

// ── EchoProducer ───────────────────────────────────────────────────

export class EchoProducer {
	private readonly cooldowns = new Map<string, number>();
	private readonly store: IEchoStore;
	private readonly onCascade?: (agent: string, result: AddResult) => void;

	constructor(store: IEchoStore, onCascade?: (agent: string, result: AddResult) => void) {
		this.store = store;
		this.onCascade = onCascade;
	}

	// ── Cooldown Guard ─────────────────────────────────────────────

	private tryAdd(agent: string, echo: EchoInput, cycle: number): AddResult | null {
		const key = `${agent}:${echo.kind}:${echo.source}:${echo.target ?? ""}`;
		if (this.cooldowns.get(key) === cycle) return null;
		this.cooldowns.set(key, cycle);
		const result = this.store.addEcho(agent, echo, cycle);
		if (result.cascadeTriggered && this.onCascade) {
			this.onCascade(agent, result);
		}
		return result;
	}

	// ── Social Events ──────────────────────────────────────────────
	// onConversation, onRivalConversation, onDrama, onGossipHeard, onGossipOverheard, onRunningJoke

	onConversation(agentA: string, agentB: string, tier: string, cycle: number): void {
		if (!FRIEND_TIERS.has(tier)) return;

		this.tryAdd(agentA, {
			kind: "opinion",
			source: "conversation",
			target: agentB,
			weight: 5,
			decay: 3,
			tags: ["social"],
		}, cycle);

		this.tryAdd(agentB, {
			kind: "opinion",
			source: "conversation",
			target: agentA,
			weight: 5,
			decay: 3,
			tags: ["social"],
		}, cycle);
	}

	onRivalConversation(agentA: string, agentB: string, cycle: number): void {
		this.tryAdd(agentA, {
			kind: "opinion",
			source: "rival-conversation",
			target: agentB,
			weight: -6,
			decay: 2,
			tags: ["social", "rivalry"],
		}, cycle);

		this.tryAdd(agentB, {
			kind: "opinion",
			source: "rival-conversation",
			target: agentA,
			weight: -6,
			decay: 2,
			tags: ["social", "rivalry"],
		}, cycle);
	}

	onDrama(agentA: string, agentB: string, positive: boolean, cycle: number): void {
		const weight = positive ? 15 : -15;

		this.tryAdd(agentA, {
			kind: "opinion",
			source: "drama",
			target: agentB,
			weight,
			decay: 1,
			tags: ["social", "drama"],
		}, cycle);

		this.tryAdd(agentB, {
			kind: "opinion",
			source: "drama",
			target: agentA,
			weight,
			decay: 1,
			tags: ["social", "drama"],
		}, cycle);
	}

	onGossipHeard(listener: string, gossiper: string, subject: string, cycle: number): void {
		this.tryAdd(listener, {
			kind: "reputation",
			source: gossiper,
			target: subject,
			weight: -8,
			decay: 2,
			tags: ["social", "gossip"],
		}, cycle);
	}

	onGossipOverheard(subject: string, gossiper: string, cycle: number): void {
		this.tryAdd(subject, {
			kind: "opinion",
			source: "gossip-overheard",
			target: gossiper,
			weight: -12,
			decay: 1,
			tags: ["social", "gossip"],
		}, cycle);
	}

	onRunningJoke(agentA: string, agentB: string, jokeId: string, cycle: number): void {
		this.tryAdd(agentA, {
			kind: "memory",
			source: "running-joke",
			target: jokeId,
			weight: 4,
			decay: 5,
			tags: ["social", "joke"],
		}, cycle);

		this.tryAdd(agentB, {
			kind: "memory",
			source: "running-joke",
			target: jokeId,
			weight: 4,
			decay: 5,
			tags: ["social", "joke"],
		}, cycle);
	}

	// ── Work Events ────────────────────────────────────────────────
	// onTaskComplete, onPairedWork

	onTaskComplete(agent: string, taskType: string, success: boolean, cycle: number): void {
		if (success) {
			this.tryAdd(agent, {
				kind: "preference",
				source: "task-complete",
				target: taskType,
				weight: 10,
				decay: 2,
				tags: ["work"],
			}, cycle);
		} else {
			this.tryAdd(agent, {
				kind: "aversion",
				source: "task-complete",
				target: taskType,
				weight: -15,
				decay: 2,
				tags: ["work"],
			}, cycle);
		}
	}

	onPairedWork(agentA: string, agentB: string, cycle: number): void {
		this.tryAdd(agentA, {
			kind: "preference",
			source: "paired-work",
			target: agentB,
			weight: 5,
			decay: 2,
			tags: ["work"],
		}, cycle);

		this.tryAdd(agentB, {
			kind: "preference",
			source: "paired-work",
			target: agentA,
			weight: 5,
			decay: 2,
			tags: ["work"],
		}, cycle);
	}

	// ── Care & Needs Events ────────────────────────────────────────
	// onMorale, onFedByDirector, onNeedsNeglected, onPetComfort, onSnackStolen

	onMorale(agent: string, morale: number, cycle: number): void {
		if (morale < 20) {
			this.tryAdd(agent, {
				kind: "mood-residue",
				source: "morale",
				weight: -10,
				decay: 3,
				tags: ["mood"],
			}, cycle);
		} else if (morale > 80) {
			this.tryAdd(agent, {
				kind: "mood-residue",
				source: "morale",
				weight: 8,
				decay: 4,
				tags: ["mood"],
			}, cycle);
		}
	}

	onFedByDirector(agent: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "bond",
			source: "fed-by-director",
			target: "director",
			weight: 8,
			decay: 2,
			tags: ["care"],
		}, cycle);
	}

	onNeedsNeglected(agent: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "aversion",
			source: "needs-neglected",
			target: "needs",
			weight: -6,
			decay: 3,
			tags: ["care"],
		}, cycle);
	}

	onPetComfort(agent: string, petId: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "bond",
			source: "pet-comfort",
			target: petId,
			weight: 10,
			decay: 1,
			tags: ["pet"],
		}, cycle);
	}

	onPetNapNearby(agent: string, petId: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "bond",
			source: "pet-nap-nearby",
			target: petId,
			weight: 3,
			decay: 4,
			tags: ["pet"],
		}, cycle);
	}

	onPetWanderNearby(agent: string, petId: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "mood-residue",
			source: "pet-wander-nearby",
			target: petId,
			weight: 2,
			decay: 5,
			tags: ["pet"],
		}, cycle);
	}

	onSnackStolen(agent: string, petId: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "aversion",
			source: "snack-stolen",
			target: petId,
			weight: -8,
			decay: 4,
			tags: ["pet"],
		}, cycle);
	}

	// ── Economy & Progression Events ───────────────────────────────
	// onMerchantPurchase, onLevelUp, onRitual

	onMerchantPurchase(agent: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "opinion",
			source: "merchant-purchase",
			target: "director",
			weight: 6,
			decay: 3,
			tags: ["economy"],
		}, cycle);
	}

	onLevelUp(agent: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "mood-residue",
			source: "level-up",
			weight: 12,
			decay: 2,
			tags: ["economy", "milestone"],
		}, cycle);
	}

	onRitual(agent: string, ritualType: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "preference",
			source: "ritual",
			target: ritualType,
			weight: 3,
			decay: 4,
			tags: ["social", "ritual"],
		}, cycle);
	}

	// ── Offline Events ─────────────────────────────────────────────
	// onOfflineReturn

	onOfflineReturn(agent: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "mood-residue",
			source: "offline-return",
			weight: 5,
			decay: 4,
			tags: ["offline"],
		}, cycle);
	}

	onPreferredStation(agent: string, station: string, cycle: number): void {
		this.tryAdd(agent, {
			kind: "preference",
			source: "preferred-station",
			target: station,
			weight: 4,
			decay: 5,
			tags: ["needs", "quirk"],
		}, cycle);
	}
}
