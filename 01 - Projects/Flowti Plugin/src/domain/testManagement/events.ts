/**
 * Test Management domain events.
 *
 * 9 management events covering journey registration, coverage,
 * compliance, pyramid updates, and review requests.
 */

import type { JourneyStatus } from "./types";

export interface TestManagementEventMap {
	/** Hub view loaded with current state summary. */
	"test-mgmt.hub.loaded": {
		journeyCount: number;
		coveragePercent: number;
	};

	/** A journey was registered in the registry. */
	"test-mgmt.journey.registered": {
		name: string;
		domain?: string;
		stepCount: number;
	};

	/** A journey was removed from the registry. */
	"test-mgmt.journey.deregistered": {
		name: string;
	};

	/** A journey's derived status changed. */
	"test-mgmt.journey.status-changed": {
		name: string;
		oldStatus: JourneyStatus;
		newStatus: JourneyStatus;
	};

	/** A journey run result was recorded. */
	"test-mgmt.journey.run-completed": {
		name: string;
		passed: number;
		failed: number;
		skipped: number;
	};

	/** Coverage matrix was recomputed. */
	"test-mgmt.coverage.computed": {
		totalPrds: number;
		covered: number;
		gaps: number;
	};

	/** Compliance check completed for a standard. */
	"test-mgmt.compliance.checked": {
		standard: string;
		score: number;
		gaps: number;
	};

	/** Test pyramid state was updated. */
	"test-mgmt.pyramid.updated": {
		e2eCount: number;
		flowCount: number;
		unitCount: number;
	};

	/** A Three Amigos review was requested for a journey. */
	"test-mgmt.review.requested": {
		journeyName: string;
	};
}
