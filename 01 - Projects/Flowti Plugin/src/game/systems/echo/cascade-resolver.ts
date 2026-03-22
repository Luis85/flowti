/**
 * cascade-resolver.ts — Evaluates whether echoes trigger chain reactions.
 *
 * When an echo crosses the cascade threshold, the resolver rolls probability,
 * selects a reaction type, and manages loop detection via a visited set.
 */

import type { CascadeChain, Echo, IEchoStore } from "./echo-types.js";

// ── Constants ───────────────────────────────────────────────────────

const CASCADE_WEIGHT_THRESHOLD = 15;
const MAX_CASCADE_DEPTH = 3;
const BASE_PROBABILITY = 0.3;
const MAX_PROBABILITY = 0.6;
const DAMPEN_FACTOR = 0.6;

// ── CascadeReaction ─────────────────────────────────────────────────

export interface CascadeReaction {
	readonly type: "vent" | "seek-proximity" | "force-break" | "avoid-room" | "adjust-opinion";
	readonly agent: string;
	readonly target?: string;
	readonly weight: number;
}

// ── CascadeResolver ─────────────────────────────────────────────────

export class CascadeResolver {
	private readonly store: IEchoStore;
	private readonly cooldowns = new Set<string>();

	constructor(store: IEchoStore) {
		this.store = store;
	}

	// ── Cascade Gate ────────────────────────────────────────────────

	shouldCascade(agent: string, echo: Echo, forceProbability?: number): boolean {
		if (this.store.getCascadeBudget() <= 0) return false;
		if (Math.abs(echo.weight) < CASCADE_WEIGHT_THRESHOLD) return false;
		if (this.cooldowns.has(agent)) return false;

		const probability = forceProbability ?? this.computeProbability(echo.weight);
		return Math.random() < probability;
	}

	// ── Probability ─────────────────────────────────────────────────

	computeProbability(weight: number): number {
		return Math.min(MAX_PROBABILITY, BASE_PROBABILITY + Math.abs(weight) / 100);
	}

	// ── Loop Detection ──────────────────────────────────────────────

	isLooping(echo: Echo, chain: CascadeChain): boolean {
		const key = `${echo.kind}:${echo.source}:${echo.target ?? ""}`;
		return chain.visited.has(key);
	}

	isAtMaxDepth(chain: CascadeChain): boolean {
		return chain.depth >= MAX_CASCADE_DEPTH;
	}

	// ── Dampening ───────────────────────────────────────────────────

	dampen(weight: number): number {
		return weight * DAMPEN_FACTOR;
	}

	// ── Reaction Selection ──────────────────────────────────────────

	selectReaction(agent: string, echo: Echo): CascadeReaction | undefined {
		if (echo.kind === "opinion" && echo.weight < -20) {
			return {
				type: "vent",
				agent,
				target: echo.target,
				weight: echo.weight,
			};
		}

		if (echo.kind === "bond" && echo.weight > 25) {
			return {
				type: "seek-proximity",
				agent,
				target: echo.target,
				weight: echo.weight,
			};
		}

		if (echo.kind === "mood-residue" && echo.weight < -15) {
			return {
				type: "force-break",
				agent,
				weight: echo.weight,
			};
		}

		if (echo.kind === "aversion" && Math.abs(echo.weight) > 15) {
			return {
				type: "avoid-room",
				agent,
				target: echo.target,
				weight: echo.weight,
			};
		}

		if (echo.kind === "reputation") {
			return {
				type: "adjust-opinion",
				agent,
				target: echo.target,
				weight: echo.weight * 0.5,
			};
		}

		return undefined;
	}

	// ── Cooldown Management ─────────────────────────────────────────

	recordAgentCascade(agent: string): void {
		this.cooldowns.add(agent);
	}

	resetCycle(): void {
		this.cooldowns.clear();
	}

	// ── Chain Management ────────────────────────────────────────────

	createChain(rootEchoId: string): CascadeChain {
		return { depth: 0, visited: new Set(), rootEchoId };
	}

	extendChain(chain: CascadeChain, echo: Echo): CascadeChain {
		const visited = new Set(chain.visited);
		const key = `${echo.kind}:${echo.source}:${echo.target ?? ""}`;
		visited.add(key);
		return { depth: chain.depth + 1, visited, rootEchoId: chain.rootEchoId };
	}
}
