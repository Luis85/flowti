/**
 * Compliance Calculator — pure function computing ProcessCompliance
 * from a feature's stage and the Development Lifecycle phases.
 *
 * A step is "satisfied" if its phase number is <= the feature's active phase.
 * This provides a simple, automated compliance view: phases the feature
 * has passed through are considered satisfied.
 */

import type { FeatureEntry } from "../featureLifecycle/types";
import type { ProcessCompliance, StepCompliance } from "./types";
import { LIFECYCLE_PHASES } from "./types";
import { getActivePhase } from "./phaseMapping";

/**
 * Computes process compliance for a feature against the Development Lifecycle.
 *
 * @param feature - The feature entry to compute compliance for
 * @param processName - The process name (default: "Development Lifecycle")
 * @returns ProcessCompliance with per-step status and overall percentage
 */
export function computeProcessCompliance(
	feature: Pick<FeatureEntry, "name" | "stage">,
	processName = "Development Lifecycle",
): ProcessCompliance {
	const activePhase = getActivePhase(feature);
	const activePhaseNumber = activePhase?.phase ?? 0;

	const steps: StepCompliance[] = LIFECYCLE_PHASES.map((phase) => ({
		phase: phase.phase,
		name: phase.name,
		satisfied: phase.phase <= activePhaseNumber,
		evidence: phase.phase <= activePhaseNumber
			? `Feature stage "${feature.stage}" has passed phase ${phase.phase}`
			: undefined,
	}));

	const satisfied = steps.filter((s) => s.satisfied).length;
	const percentage = Math.round((satisfied / steps.length) * 100);

	return {
		featureName: feature.name,
		processName,
		steps,
		percentage,
	};
}
