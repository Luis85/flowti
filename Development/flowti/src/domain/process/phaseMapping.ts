/**
 * Phase-to-stage mapping — connects 10 Development Lifecycle phases to 6 feature stages.
 *
 * Pure functions for bidirectional lookup and active phase determination.
 */

import type { FeatureStage } from "../featureLifecycle/types";
import type { FeatureEntry } from "../featureLifecycle/types";
import { LIFECYCLE_PHASES } from "./types";
import type { LifecyclePhase } from "./types";

/**
 * Returns all phases that belong to a given feature stage.
 */
export function getPhasesForStage(stage: FeatureStage): LifecyclePhase[] {
	return LIFECYCLE_PHASES.filter((p) => p.stage === stage);
}

/**
 * Returns the stage that a given phase number belongs to.
 * Returns undefined for invalid phase numbers.
 */
export function getStageForPhase(phaseNumber: number): FeatureStage | undefined {
	const phase = LIFECYCLE_PHASES.find((p) => p.phase === phaseNumber);
	return phase?.stage;
}

/**
 * Returns the lifecycle phase by number.
 */
export function getPhase(phaseNumber: number): LifecyclePhase | undefined {
	return LIFECYCLE_PHASES.find((p) => p.phase === phaseNumber);
}

/**
 * Determines the active phase for a feature based on its current stage.
 * Returns the first phase of the feature's current stage.
 */
export function getActivePhase(feature: Pick<FeatureEntry, "stage">): LifecyclePhase | undefined {
	return LIFECYCLE_PHASES.find((p) => p.stage === feature.stage);
}

/**
 * Returns all phases up to and including the active phase for a feature.
 * Useful for showing which phases have been completed.
 */
export function getCompletedPhases(feature: Pick<FeatureEntry, "stage">): LifecyclePhase[] {
	const active = getActivePhase(feature);
	if (!active) return [];
	return LIFECYCLE_PHASES.filter((p) => p.phase <= active.phase);
}

/**
 * Returns the percentage of phases completed (0-100).
 */
export function getPhaseProgress(feature: Pick<FeatureEntry, "stage">): number {
	const active = getActivePhase(feature);
	if (!active) return 0;
	return Math.round((active.phase / LIFECYCLE_PHASES.length) * 100);
}
