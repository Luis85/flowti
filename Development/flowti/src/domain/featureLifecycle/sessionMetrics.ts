/**
 * Session metrics for features — pure functions that compute
 * aggregate session statistics for a feature.
 */

import type { FeatureSessionRecord } from "./types";

/** Aggregate session metrics for a feature. */
export interface FeatureSessionMetrics {
	/** Total number of completed sessions */
	totalSessions: number;
	/** Total elapsed time across all sessions (ms) */
	totalTimeMs: number;
	/** Total files changed across all sessions */
	totalFilesChanged: number;
	/** Most recent session end time (ISO) or null */
	lastSessionEnd: string | null;
}

/**
 * Compute aggregate session metrics for a feature from its session records.
 */
export function computeFeatureSessionMetrics(records: FeatureSessionRecord[]): FeatureSessionMetrics {
	const completed = records.filter(r => r.endTime !== null);

	let totalTimeMs = 0;
	let totalFilesChanged = 0;
	let lastSessionEnd: string | null = null;

	for (const r of completed) {
		if (r.startTime && r.endTime) {
			totalTimeMs += new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
		}
		totalFilesChanged += r.filesCreated.length + r.filesModified.length;
		if (!lastSessionEnd || (r.endTime && r.endTime > lastSessionEnd)) {
			lastSessionEnd = r.endTime;
		}
	}

	return {
		totalSessions: completed.length,
		totalTimeMs,
		totalFilesChanged,
		lastSessionEnd,
	};
}

/**
 * Create a FeatureSessionRecord from a feature.session.ended event payload.
 * Used when the session domain emits completion for a feature-bound session.
 */
export function createSessionRecordFromEvent(payload: {
	featureName: string;
	endTime: string;
	duration: number;
	filesChanged: number;
}): FeatureSessionRecord {
	const startMs = new Date(payload.endTime).getTime() - payload.duration;
	return {
		featureName: payload.featureName,
		startTime: new Date(startMs).toISOString(),
		endTime: payload.endTime,
		filesCreated: [],
		filesModified: Array.from({ length: payload.filesChanged }, (_, i) => `file-${i + 1}`),
		notes: "",
		stageAtStart: "idea",
		stageAtEnd: null,
	};
}
