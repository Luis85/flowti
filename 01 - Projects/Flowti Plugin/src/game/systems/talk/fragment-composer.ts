/**
 * fragment-composer.ts — Assembles ambient phrases from interchangeable fragment pools.
 *
 * Composition patterns (probability-weighted):
 *   1. Opener + Core          (40%)
 *   2. Core + Qualifier       (30%)
 *   3. Interjection + Core + Closer (25%)
 *   4. Opener + Core + Closer (5%)
 *
 * Fragments are filtered by mood, domain, tier, petVoice, and timeOfDay.
 * Unfiltered pools are always eligible; filtered pools match when any filter value matches.
 */

import type { PetVoice } from "./talk-types.js";
import type { AgentMood } from "./templates/mood-variants.js";
import type { RelationshipTier } from "../relationship-system.js";

// Re-export PetVoice for consumers that need it alongside FragmentPool
export type { PetVoice } from "./talk-types.js";

// ── Types ────────────────────────────────────────────────────────────

export type FragmentSlot = "opener" | "core" | "closer" | "interjection" | "qualifier";

export interface FragmentPool {
	readonly id: string;
	readonly slot: FragmentSlot;
	readonly filters: {
		readonly mood?: readonly AgentMood[];
		readonly domain?: readonly string[];
		readonly tier?: readonly RelationshipTier[];
		readonly petVoice?: readonly PetVoice[];
		readonly timeOfDay?: readonly string[];
	};
	readonly fragments: readonly string[];
}

export interface ComposeContext {
	readonly mood?: string;
	readonly domain?: string;
	readonly tier?: RelationshipTier;
	readonly petVoice?: PetVoice;
	readonly timeOfDay?: string;
}

// ── Pattern weights ──────────────────────────────────────────────────

interface Pattern {
	readonly slots: readonly FragmentSlot[];
	readonly weight: number;
	readonly join: string;
}

const PATTERNS: readonly Pattern[] = [
	{ slots: ["opener", "core"], weight: 40, join: " " },
	{ slots: ["core", "qualifier"], weight: 30, join: " " },
	{ slots: ["interjection", "core", "closer"], weight: 25, join: " " },
	{ slots: ["opener", "core", "closer"], weight: 5, join: " " },
];

// ── Composer ─────────────────────────────────────────────────────────

export class FragmentComposer {
	private readonly pools: readonly FragmentPool[];

	constructor(pools: readonly FragmentPool[]) {
		this.pools = pools;
	}

	compose(context: ComposeContext, avoid: readonly string[] = []): string {
		const pattern = this.pickPattern();
		const parts: string[] = [];
		for (const slot of pattern.slots) {
			const fragment = this.pickFragment(slot, context, avoid);
			if (fragment) parts.push(fragment);
		}
		return parts.join(pattern.join) || "...";
	}

	private pickPattern(): Pattern {
		const totalWeight = PATTERNS.reduce((sum, p) => sum + p.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const p of PATTERNS) {
			roll -= p.weight;
			if (roll <= 0) return p;
		}
		return PATTERNS[PATTERNS.length - 1];
	}

	private pickFragment(slot: FragmentSlot, context: ComposeContext, avoid: readonly string[]): string | null {
		const eligible = this.pools.filter((p) => p.slot === slot && this.matchesFilters(p, context));
		const allFragments = eligible.flatMap((p) => [...p.fragments]);
		if (allFragments.length === 0) return null;

		const avoidSet = new Set(avoid);
		const filtered = allFragments.filter((f) => !avoidSet.has(f));
		const pool = filtered.length > 0 ? filtered : allFragments;
		return pool[Math.floor(Math.random() * pool.length)];
	}

	private passesFilter<T>(allowed: readonly T[] | undefined, value: T | undefined): boolean {
		if (!allowed || !value) return true;
		return allowed.includes(value);
	}

	private matchesFilters(pool: FragmentPool, context: ComposeContext): boolean {
		const { filters } = pool;
		return this.passesFilter(filters.mood, context.mood as AgentMood | undefined)
			&& this.passesFilter(filters.domain, context.domain)
			&& this.passesFilter(filters.tier, context.tier)
			&& this.passesFilter(filters.petVoice, context.petVoice)
			&& this.passesFilter(filters.timeOfDay, context.timeOfDay);
	}
}
