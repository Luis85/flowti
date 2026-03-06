/**
 * Event map for the Feature Lifecycle domain.
 *
 * Events follow the `feature.` and `review.` prefix conventions.
 * 8 events covering stage changes, gate checks, scoring, sessions, and reviews.
 */

import type { FeatureStage, FRILevel, GateCheckItem, GateName } from "./types";

export interface FeatureLifecycleEventMap {
	// ── Stage transitions ────────────────────────────────────────

	/** Emitted when a feature's stage is changed via advance action. */
	"feature.stage.changed": {
		featureName: string;
		previousStage: FeatureStage;
		newStage: FeatureStage;
		timestamp: string;
	};

	// ── Gate checks ──────────────────────────────────────────────

	/** Emitted when all gate checks pass for a stage transition. */
	"feature.gate.passed": {
		featureName: string;
		gateName: GateName;
		stage: FeatureStage;
	};

	/** Emitted when gate checks are run and some fail. */
	"feature.gate.failed": {
		featureName: string;
		gateName: GateName;
		failedChecks: GateCheckItem[];
	};

	// ── Scoring ──────────────────────────────────────────────────

	/** Emitted when FRI or prioritization scores are saved. */
	"feature.scored": {
		featureName: string;
		friScore: number;
		friLevel: FRILevel;
		dimensions: Record<string, number>;
	};

	// ── Sessions ─────────────────────────────────────────────────

	/** Emitted when a user starts a session on a feature. */
	"feature.session.started": {
		featureName: string;
		startTime: string;
	};

	/** Emitted when a user ends a session on a feature. */
	"feature.session.ended": {
		featureName: string;
		endTime: string;
		duration: number;
		filesChanged: number;
	};

	// ── Reviews ──────────────────────────────────────────────────

	/** Emitted when a Three Amigos review document is created for a feature. */
	"review.session.created": {
		featureName: string;
		filePath: string;
	};

	/** Emitted when TASM scores are detected in a review document. */
	"review.session.scored": {
		featureName: string;
		tasmScore: number;
		healthLevel: string;
	};
}
