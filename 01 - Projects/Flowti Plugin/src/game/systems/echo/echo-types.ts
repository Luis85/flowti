/**
 * echo-types.ts — Type definitions for the Echo System.
 *
 * Echoes are weighted residue (opinions, preferences, aversions, bonds,
 * moods) that accumulate on agents, decay over time, and influence
 * dialogue and behavior.
 */

// ── Echo Kind ───────────────────────────────────────────────────────

export type EchoKind =
	| "opinion"
	| "preference"
	| "aversion"
	| "memory"
	| "reputation"
	| "bond"
	| "mood-residue";

// ── Core Echo ───────────────────────────────────────────────────────

export interface Echo {
	readonly id: string;
	readonly kind: EchoKind;
	readonly source: string;
	readonly target?: string;
	readonly weight: number;
	readonly decay: number;
	readonly reinforcements: number;
	readonly lastReinforcedCycle: number;
	readonly tags: readonly string[];
	readonly cycleCreated: number;
}

// ── Dialogue Integration ────────────────────────────────────────────

export interface DialogueBias {
	readonly moodOverride?: string;
	readonly targetOpinions: ReadonlyMap<string, number>;
	readonly moodResidueWeight: number;
	readonly memoryBoosts: ReadonlyMap<string, number>;
}

// ── Display / Summary ───────────────────────────────────────────────

export interface EchoSummary {
	readonly kind: EchoKind;
	readonly target: string;
	readonly weight: number;
	readonly direction: "warming" | "cooling" | "stable" | "fading" | "strong";
	readonly label: string;
	readonly reinforcements: number;
}

// ── Decay Result ────────────────────────────────────────────────────

export interface DecayResult {
	readonly evicted: readonly Echo[];
	readonly thresholdsCrossed: readonly Echo[];
	readonly habitsFormed: readonly Echo[];
}

// ── Add Result ──────────────────────────────────────────────────────

export interface AddResult {
	readonly merged: boolean;
	readonly echo: Echo;
	readonly cascadeTriggered: boolean;
}

// ── Cascade Chain ───────────────────────────────────────────────────

export interface CascadeChain {
	readonly depth: number;
	readonly visited: Set<string>;
	readonly rootEchoId: string;
}

// ── Input (omits generated fields) ──────────────────────────────────

export type EchoInput = Omit<Echo, "id" | "cycleCreated" | "reinforcements" | "lastReinforcedCycle">;

// ── Store Contract ──────────────────────────────────────────────────

export interface IEchoStore {
	addEcho(agent: string, echo: EchoInput, cycle: number): AddResult;
	queryWeight(agent: string, kind: EchoKind, target?: string): number;
	getDialogueBias(agent: string): DialogueBias;
	getPreferences(agent: string, cycle: number): readonly EchoSummary[];
	getStrongest(agent: string, kind: EchoKind): Echo | undefined;
	decayAll(cycle: number): DecayResult;
	getCascadeBudget(): number;
	consumeCascade(): boolean;
	resetCascadeBudget(): void;
	serialize(): Record<string, Echo[]>;
	restore(data: Record<string, Echo[]>): void;
}
