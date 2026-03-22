/**
 * relationship-system.ts — Tracks evolving pairwise relationships between agents.
 *
 * Affinity ranges from -100 (rival) to 100 (best friend). Changes accumulate
 * through conversations, clusters, bickering, and shared experiences. Affinity
 * decays toward 0 by 1 per cycle for inactive pairs.
 */

import { checkOpinionClash, type AgentOpinion } from "../data/opinion-topics.js";

// ── Types ────────────────────────────────────────────────────────────

export interface RelationshipEntry {
	agentA: string;
	agentB: string;
	affinity: number;
	interactionCount: number;
	lastInteraction: number;
	sharedMemories: string[];
	opinion: string | null;
	jokePlayCounts: Record<string, number>;
}

export type RelationshipTier = "rival" | "acquaintance" | "colleague" | "friend" | "best-friend";

interface PersistenceData {
	relationships: RelationshipEntry[];
	opinions: Record<string, AgentOpinion[]>;
	petAffinity: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────────

const MAX_SHARED_MEMORIES = 5;
const DEFAULT_BICKER_CHANCE = 0.3;

// ── System ───────────────────────────────────────────────────────────

export class RelationshipSystem {
	private readonly relationships = new Map<string, RelationshipEntry>();
	private readonly agentOpinions = new Map<string, AgentOpinion[]>();
	private readonly petAffinity = new Map<string, number>();
	private readonly bickerChance: number;
	private readonly tierCallbacks: Array<(agentA: string, agentB: string, tier: RelationshipTier) => void> = [];
	private interactedThisCycle = new Set<string>();

	constructor(bickerChance = DEFAULT_BICKER_CHANCE) {
		this.bickerChance = bickerChance;
	}

	// ── Registration ─────────────────────────────────────────────

	register(name: string, opinions: AgentOpinion[]): void {
		this.agentOpinions.set(name, opinions);
	}

	getOpinions(name: string): AgentOpinion[] {
		return this.agentOpinions.get(name) ?? [];
	}

	// ── Affinity queries ─────────────────────────────────────────

	getAffinity(a: string, b: string): number {
		return this.getOrCreate(a, b).affinity;
	}

	getTier(a: string, b: string): RelationshipTier {
		const affinity = this.getAffinity(a, b);
		if (affinity <= -30) return "rival";
		if (affinity <= 15) return "acquaintance";
		if (affinity <= 50) return "colleague";
		if (affinity <= 80) return "friend";
		return "best-friend";
	}

	getRelationship(a: string, b: string): RelationshipEntry | null {
		return this.relationships.get(this.pairKey(a, b)) ?? null;
	}

	onTierChange(cb: (agentA: string, agentB: string, tier: RelationshipTier) => void): void {
		this.tierCallbacks.push(cb);
	}

	// ── Affinity changes ─────────────────────────────────────────

	recordConversation(a: string, b: string): void {
		this.changeAffinity(a, b, 2);
		const entry = this.getOrCreate(a, b);
		entry.interactionCount++;
		entry.lastInteraction = Date.now();
		this.interactedThisCycle.add(this.pairKey(a, b));
	}

	recordCluster(members: string[]): void {
		for (let i = 0; i < members.length; i++) {
			for (let j = i + 1; j < members.length; j++) {
				this.changeAffinity(members[i], members[j], 1);
				this.interactedThisCycle.add(this.pairKey(members[i], members[j]));
			}
		}
	}

	recordBicker(a: string, b: string): void {
		this.changeAffinity(a, b, -3);
		this.interactedThisCycle.add(this.pairKey(a, b));
	}

	addSharedMemory(a: string, b: string, memory: string): void {
		const entry = this.getOrCreate(a, b);
		entry.sharedMemories.push(memory);
		if (entry.sharedMemories.length > MAX_SHARED_MEMORIES) {
			entry.sharedMemories.splice(0, entry.sharedMemories.length - MAX_SHARED_MEMORIES);
		}
	}

	// ── Opinion checks ───────────────────────────────────────────

	shouldBicker(a: string, b: string): boolean {
		const opsA = this.agentOpinions.get(a) ?? [];
		const opsB = this.agentOpinions.get(b) ?? [];
		if (!checkOpinionClash(opsA, opsB)) return false;
		return Math.random() < this.bickerChance;
	}

	// ── Pet affinity ────────────────────────────────────────────

	getPetAffinity(agentName: string): number {
		return this.petAffinity.get(agentName) ?? 50;
	}

	changePetAffinity(agentName: string, delta: number): void {
		const current = this.getPetAffinity(agentName);
		this.petAffinity.set(agentName, Math.max(0, Math.min(100, current + delta)));
	}

	// ── Joke play counts ────────────────────────────────────────

	getJokePlayCount(a: string, b: string, jokeId: string): number {
		const entry = this.getOrCreate(a, b);
		return entry.jokePlayCounts[jokeId] ?? 0;
	}

	incrementJokePlayCount(a: string, b: string, jokeId: string): void {
		const entry = this.getOrCreate(a, b);
		entry.jokePlayCounts[jokeId] = (entry.jokePlayCounts[jokeId] ?? 0) + 1;
	}

	// ── Cycle end ────────────────────────────────────────────────

	onCycleEnd(): void {
		for (const [key, entry] of this.relationships) {
			if (this.interactedThisCycle.has(key)) continue;
			// Decay toward 0
			if (entry.affinity > 0) {
				entry.affinity = Math.max(0, entry.affinity - 1);
			} else if (entry.affinity < 0) {
				entry.affinity = Math.min(0, entry.affinity + 1);
			}
		}
		this.interactedThisCycle.clear();
	}

	// ── Persistence ──────────────────────────────────────────────

	serialize(): PersistenceData {
		const relationships: RelationshipEntry[] = [];
		for (const entry of this.relationships.values()) {
			relationships.push({ ...entry, sharedMemories: [...entry.sharedMemories], jokePlayCounts: { ...entry.jokePlayCounts } });
		}
		const opinions: Record<string, AgentOpinion[]> = {};
		for (const [name, ops] of this.agentOpinions) {
			opinions[name] = [...ops];
		}
		const petAffinity: Record<string, number> = {};
		for (const [name, val] of this.petAffinity) {
			petAffinity[name] = val;
		}
		return { relationships, opinions, petAffinity };
	}

	restore(data: PersistenceData): void {
		for (const entry of data.relationships) {
			this.relationships.set(this.pairKey(entry.agentA, entry.agentB), { ...entry, jokePlayCounts: entry.jokePlayCounts ?? {} });
		}
		for (const [name, ops] of Object.entries(data.opinions)) {
			this.agentOpinions.set(name, ops);
		}
		if (data.petAffinity) {
			for (const [name, val] of Object.entries(data.petAffinity)) {
				this.petAffinity.set(name, val);
			}
		}
	}

	// ── Private ──────────────────────────────────────────────────

	private pairKey(a: string, b: string): string {
		return a < b ? `${a}::${b}` : `${b}::${a}`;
	}

	private getOrCreate(a: string, b: string): RelationshipEntry {
		const key = this.pairKey(a, b);
		let entry = this.relationships.get(key);
		if (!entry) {
			entry = {
				agentA: a < b ? a : b,
				agentB: a < b ? b : a,
				affinity: 0,
				interactionCount: 0,
				lastInteraction: 0,
				sharedMemories: [],
				opinion: null,
				jokePlayCounts: {},
			};
			this.relationships.set(key, entry);
		}
		return entry;
	}

	private changeAffinity(a: string, b: string, delta: number): void {
		const entry = this.getOrCreate(a, b);
		const prevTier = this.tierFromAffinity(entry.affinity);
		entry.affinity = Math.max(-100, Math.min(100, entry.affinity + delta));
		const newTier = this.tierFromAffinity(entry.affinity);
		if (newTier !== prevTier) {
			this.updateOpinion(entry, newTier);
			for (const cb of this.tierCallbacks) cb(entry.agentA, entry.agentB, newTier);
		}
	}

	private tierFromAffinity(affinity: number): RelationshipTier {
		if (affinity <= -30) return "rival";
		if (affinity <= 15) return "acquaintance";
		if (affinity <= 50) return "colleague";
		if (affinity <= 80) return "friend";
		return "best-friend";
	}

	private updateOpinion(entry: RelationshipEntry, tier: RelationshipTier): void {
		const templates: Record<RelationshipTier, string | null> = {
			"rival": `can't stand ${entry.agentB}'s taste`,
			"acquaintance": null,
			"colleague": `respects ${entry.agentB}'s work`,
			"friend": `thinks ${entry.agentB} is great to work with`,
			"best-friend": `considers ${entry.agentB} their closest ally`,
		};
		entry.opinion = templates[tier] ?? null;
	}
}
