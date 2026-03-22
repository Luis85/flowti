/**
 * echo-store.ts — EchoStore implementation.
 *
 * Manages per-agent echo collections with add/merge, decay, eviction,
 * cascade detection, dialogue bias aggregation, and serialization.
 */

import type {
	AddResult,
	DecayResult,
	DialogueBias,
	Echo,
	EchoInput,
	EchoKind,
	EchoSummary,
	IEchoStore,
} from "./echo-types.js";

// ── Constants ───────────────────────────────────────────────────────

export const MAX_ECHOES = 20;
export const MAX_WEIGHT = 100;
export const CASCADE_THRESHOLD = 15;
export const EVICTION_THRESHOLD = 2;
export const DISPLAY_THRESHOLD = 5;
export const MAX_CASCADE_BUDGET = 5;

// ── Helpers ─────────────────────────────────────────────────────────

function clampWeight(w: number): number {
	return Math.max(-MAX_WEIGHT, Math.min(MAX_WEIGHT, w));
}

function computeDirection(
	echo: Echo,
	cycle: number,
): "warming" | "cooling" | "stable" | "fading" | "strong" {
	const absW = Math.abs(echo.weight);
	if (absW > 50) return "strong";
	if (absW < 10) return "fading";
	if (echo.lastReinforcedCycle >= cycle - 1) return "warming";
	if (echo.lastReinforcedCycle < cycle - 3) return "cooling";
	return "stable";
}

function echoLabel(echo: Echo): string {
	const sign = echo.weight >= 0 ? "+" : "";
	const tgt = echo.target ? ` → ${echo.target}` : "";
	return `${echo.kind}${tgt} (${sign}${echo.weight})`;
}

// ── EchoStore ───────────────────────────────────────────────────────

export class EchoStore implements IEchoStore {
	private readonly agents = new Map<string, Echo[]>();
	private readonly pendingHabits: Echo[] = [];
	private cascadeBudget = MAX_CASCADE_BUDGET;
	private nextId = 1;

	// ── Add / Merge ─────────────────────────────────────────────────

	addEcho(agent: string, input: EchoInput, cycle: number): AddResult {
		if (!this.agents.has(agent)) {
			this.agents.set(agent, []);
		}
		const echoes = this.agents.get(agent)!;

		const existing = echoes.find(
			(e) =>
				e.kind === input.kind &&
				e.source === input.source &&
				e.target === input.target,
		);

		if (existing) {
			return this.mergeEcho(echoes, existing, input, cycle);
		}

		return this.createEcho(echoes, input, cycle);
	}

	// Merge: same kind+source+target → add weights (cap ±100),
	// increment reinforcements, reset decay to incoming value,
	// update lastReinforcedCycle. This models repeated experiences
	// reinforcing preferences rather than creating duplicates.
	private mergeEcho(
		echoes: Echo[],
		existing: Echo,
		input: EchoInput,
		cycle: number,
	): AddResult {
		const prevAbs = Math.abs(existing.weight);
		const newWeight = clampWeight(existing.weight + input.weight);
		const newAbs = Math.abs(newWeight);
		const newReinforcements = existing.reinforcements + 1;

		const merged: Echo = {
			...existing,
			weight: newWeight,
			reinforcements: newReinforcements,
			lastReinforcedCycle: cycle,
			decay: input.decay,
		};

		const idx = echoes.indexOf(existing);
		echoes[idx] = merged;

		if (newReinforcements === 3) {
			this.pendingHabits.push(merged);
		}

		const cascadeTriggered =
			prevAbs < CASCADE_THRESHOLD && newAbs >= CASCADE_THRESHOLD;

		return { merged: true, echo: merged, cascadeTriggered };
	}

	private createEcho(
		echoes: Echo[],
		input: EchoInput,
		cycle: number,
	): AddResult {
		const weight = clampWeight(input.weight);
		const echo: Echo = {
			id: `echo-${this.nextId++}`,
			kind: input.kind,
			source: input.source,
			target: input.target,
			weight,
			decay: input.decay,
			reinforcements: 1,
			lastReinforcedCycle: cycle,
			tags: input.tags,
			cycleCreated: cycle,
		};

		if (echoes.length >= MAX_ECHOES) {
			this.evictWeakest(echoes);
		}

		echoes.push(echo);

		const cascadeTriggered = Math.abs(weight) >= CASCADE_THRESHOLD;

		return { merged: false, echo, cascadeTriggered };
	}

	private evictWeakest(echoes: Echo[]): void {
		let weakestIdx = 0;
		let weakestAbs = Math.abs(echoes[0].weight);

		for (let i = 1; i < echoes.length; i++) {
			const absW = Math.abs(echoes[i].weight);
			if (absW < weakestAbs) {
				weakestAbs = absW;
				weakestIdx = i;
			}
		}

		echoes.splice(weakestIdx, 1);
	}

	// ── Query ───────────────────────────────────────────────────────

	queryWeight(agent: string, kind: EchoKind, target?: string): number {
		const echoes = this.agents.get(agent);
		if (!echoes) return 0;

		let total = 0;
		for (const e of echoes) {
			if (e.kind !== kind) continue;
			if (target !== undefined && e.target !== target) continue;
			total += e.weight;
		}
		return total;
	}

	// ── Dialogue Bias ───────────────────────────────────────────────

	getDialogueBias(agent: string): DialogueBias {
		const echoes = this.agents.get(agent);
		if (!echoes) {
			return {
				targetOpinions: new Map(),
				moodResidueWeight: 0,
				memoryBoosts: new Map(),
			};
		}

		const targetOpinions = new Map<string, number>();
		let moodResidueWeight = 0;
		const memoryBoosts = new Map<string, number>();
		let moodOverride: string | undefined;

		for (const e of echoes) {
			if (e.kind === "opinion" && e.target) {
				const prev = targetOpinions.get(e.target) ?? 0;
				targetOpinions.set(e.target, prev + e.weight);
			}
			if (e.kind === "mood-residue") {
				moodResidueWeight += e.weight;
			}
			if (e.kind === "memory" && e.target) {
				const prev = memoryBoosts.get(e.target) ?? 0;
				memoryBoosts.set(e.target, prev + e.weight);
			}
		}

		if (moodResidueWeight < -10) moodOverride = "tired";
		if (moodResidueWeight > 10) moodOverride = "excited";

		return { moodOverride, targetOpinions, moodResidueWeight, memoryBoosts };
	}

	// ── Preferences ─────────────────────────────────────────────────

	getPreferences(agent: string, cycle: number): readonly EchoSummary[] {
		const echoes = this.agents.get(agent);
		if (!echoes) return [];

		const visible = echoes.filter(
			(e) => Math.abs(e.weight) >= DISPLAY_THRESHOLD,
		);
		visible.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

		return visible.map((e) => ({
			kind: e.kind,
			target: e.target ?? "",
			weight: e.weight,
			direction: computeDirection(e, cycle),
			label: echoLabel(e),
			reinforcements: e.reinforcements,
		}));
	}

	// ── Strongest ───────────────────────────────────────────────────

	getStrongest(agent: string, kind: EchoKind): Echo | undefined {
		const echoes = this.agents.get(agent);
		if (!echoes) return undefined;

		let strongest: Echo | undefined;
		let strongestAbs = -1;

		for (const e of echoes) {
			if (e.kind !== kind) continue;
			const absW = Math.abs(e.weight);
			if (absW > strongestAbs) {
				strongestAbs = absW;
				strongest = e;
			}
		}

		return strongest;
	}

	// ── Decay ───────────────────────────────────────────────────────

	decayAll(_cycle: number): DecayResult {
		const evicted: Echo[] = [];
		const thresholdsCrossed: Echo[] = [];
		const habitsFormed = [...this.pendingHabits];
		this.pendingHabits.length = 0;

		for (const [agent, echoes] of this.agents) {
			const kept: Echo[] = [];

			for (const e of echoes) {
				const prevAbs = Math.abs(e.weight);
				const sign = e.weight >= 0 ? 1 : -1;
				const reduced = Math.abs(e.weight) - e.decay;
				const newWeight = reduced <= 0 ? 0 : sign * reduced;

				const decayed: Echo = {
					...e,
					weight: newWeight,
				};

				if (Math.abs(newWeight) <= EVICTION_THRESHOLD) {
					evicted.push(decayed);
					continue;
				}

				// Only downward crossing possible during decay — upward crossing detected in addEcho
				const newAbs = Math.abs(newWeight);
				if (prevAbs > 30 && newAbs <= 30) {
					thresholdsCrossed.push(decayed);
				}

				kept.push(decayed);
			}

			this.agents.set(agent, kept);
		}

		return { evicted, thresholdsCrossed, habitsFormed };
	}

	// ── Cascade Budget ──────────────────────────────────────────────

	getCascadeBudget(): number {
		return this.cascadeBudget;
	}

	consumeCascade(): boolean {
		if (this.cascadeBudget <= 0) return false;
		this.cascadeBudget--;
		return true;
	}

	resetCascadeBudget(): void {
		this.cascadeBudget = MAX_CASCADE_BUDGET;
	}

	// ── Serialization ───────────────────────────────────────────────

	serialize(): Record<string, Echo[]> {
		const out: Record<string, Echo[]> = {};
		for (const [agent, echoes] of this.agents) {
			out[agent] = echoes.map((e) => ({ ...e }));
		}
		return out;
	}

	restore(data: Record<string, Echo[]>): void {
		this.agents.clear();
		this.pendingHabits.length = 0;
		let maxId = 0;
		for (const [agent, echoes] of Object.entries(data)) {
			this.agents.set(agent, echoes.map((e) => ({ ...e })));
			for (const e of echoes) {
				const m = /^echo-(\d+)$/.exec(e.id);
				if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
			}
		}
		if (maxId >= this.nextId) this.nextId = maxId + 1;
	}
}
