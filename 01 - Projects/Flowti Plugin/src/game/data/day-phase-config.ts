/**
 * day-phase-config.ts — Day cycle phase definitions with need rate multipliers.
 *
 * Each phase has a percentage of the total cycle duration and multipliers
 * that scale NeedsSystem decay/restore rates during that phase.
 */

export type DayPhase =
	| "morning-arrival"
	| "productive-morning"
	| "lunch"
	| "afternoon"
	| "afternoon-slump"
	| "wind-down"
	| "evening-departure";

export interface NeedMultipliers {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
}

export interface DayPhaseConfig {
	readonly phase: DayPhase;
	readonly percent: number;
	readonly needMultipliers: NeedMultipliers;
}

export const DAY_PHASES: readonly DayPhaseConfig[] = [
	{ phase: "morning-arrival",    percent: 0.08, needMultipliers: { energy: 1.2, social: 1.5, focus: 0.5, morale: 1.3 } },
	{ phase: "productive-morning", percent: 0.25, needMultipliers: { energy: 0.8, social: 0.7, focus: 1.3, morale: 1.2 } },
	{ phase: "lunch",              percent: 0.10, needMultipliers: { energy: 1.5, social: 2.0, focus: 0.3, morale: 1.5 } },
	{ phase: "afternoon",          percent: 0.25, needMultipliers: { energy: 1.0, social: 1.0, focus: 1.0, morale: 1.0 } },
	{ phase: "afternoon-slump",    percent: 0.12, needMultipliers: { energy: 0.6, social: 1.2, focus: 0.6, morale: 0.7 } },
	{ phase: "wind-down",          percent: 0.12, needMultipliers: { energy: 1.1, social: 1.3, focus: 0.5, morale: 1.0 } },
	{ phase: "evening-departure",  percent: 0.08, needMultipliers: { energy: 1.0, social: 1.5, focus: 0.2, morale: 1.2 } },
];

const DEFAULT_MULTIPLIERS: NeedMultipliers = { energy: 1.0, social: 1.0, focus: 1.0, morale: 1.0 };

const MULTIPLIER_MAP = new Map<string, NeedMultipliers>(
	DAY_PHASES.map((p) => [p.phase, p.needMultipliers]),
);

/** Get need multipliers for a given phase. Returns 1.0 defaults for unknown phases. */
export function PHASE_MULTIPLIERS(phase: DayPhase): NeedMultipliers {
	return MULTIPLIER_MAP.get(phase) ?? DEFAULT_MULTIPLIERS;
}
