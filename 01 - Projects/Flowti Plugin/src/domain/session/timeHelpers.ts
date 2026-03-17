/**
 * Time computation, duration formatting, and activity intelligence for sessions.
 */

import type { ActivityIntelligence, PauseSegment, Session, TimelineSummary } from "./types";
import { isExcluded } from "./sessionUtils";

// ── Timer Computation ────────────────────────────────────────

/**
 * Computes how much time remains on a session's timer (in ms).
 * Returns 0 if the session has expired.
 */
export function computeRemainingMs(session: Session, now: number = Date.now()): number {
	const totalMs = session.durationMinutes * 60_000;
	const elapsed = computeElapsedMs(session, now);
	return Math.max(0, totalMs - elapsed);
}

/**
 * Computes total elapsed time for a session (in ms),
 * including accumulated time from previous active segments.
 */
export function computeElapsedMs(session: Session, now: number = Date.now()): number {
	let elapsed = session.elapsedBeforePauseMs;
	if (session.startedAt) {
		elapsed += now - Date.parse(session.startedAt);
	}
	return Math.max(0, elapsed);
}

/**
 * Returns true if the session's timer has expired.
 */
export function isTimerExpired(session: Session, now: number = Date.now()): boolean {
	return computeRemainingMs(session, now) <= 0;
}

// ── Duration Formatting ──────────────────────────────────────

/**
 * Formats a duration in ms as "MM:SS".
 */
export function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Formats a duration in ms as a human-readable string.
 * Examples: "45s", "5m 30s", "1h 12m"
 */
export function formatDurationHuman(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

// ── Pause Segments ───────────────────────────────────────────

/**
 * Extracts pause segments from timeline entries.
 * Each "paused" entry is paired with the next "resumed" or "completed" entry.
 * An ongoing pause (no subsequent resume/complete) gets resumedAt: null.
 */
export function computePauseSegments(session: Session, now: number = Date.now()): PauseSegment[] {
	const timeline = session.timeline ?? [];
	const segments: PauseSegment[] = [];

	for (let i = 0; i < timeline.length; i++) {
		if (timeline[i].action !== "paused") continue;

		const pausedAt = timeline[i].timestamp;
		let resumedAt: string | null = null;
		for (let j = i + 1; j < timeline.length; j++) {
			if (timeline[j].action === "resumed" || timeline[j].action === "completed") {
				resumedAt = timeline[j].timestamp;
				break;
			}
		}

		const durationMs = resumedAt
			? Date.parse(resumedAt) - Date.parse(pausedAt)
			: now - Date.parse(pausedAt);

		segments.push({ pausedAt, resumedAt, durationMs: Math.max(0, durationMs) });
	}

	return segments;
}

/**
 * Computes total time spent paused across all pause segments.
 */
export function computeTotalPauseMs(session: Session, now: number = Date.now()): number {
	return computePauseSegments(session, now).reduce((sum, s) => sum + s.durationMs, 0);
}

/**
 * Computes wall clock time from the first "started" entry to completion or now.
 */
export function computeWallClockMs(session: Session, now: number = Date.now()): number {
	const timeline = session.timeline ?? [];
	const startEntry = timeline.find((e) => e.action === "started");
	if (!startEntry) return 0;

	const endTime = session.completedAt ? Date.parse(session.completedAt) : now;
	return Math.max(0, endTime - Date.parse(startEntry.timestamp));
}

/**
 * Computes active working time (wall clock minus total pause).
 */
export function computeActiveTimeMs(session: Session, now: number = Date.now()): number {
	return Math.max(0, computeWallClockMs(session, now) - computeTotalPauseMs(session, now));
}

/**
 * Returns a complete time breakdown summary for a session.
 */
export function computeTimelineSummary(session: Session, now: number = Date.now()): TimelineSummary {
	const pauseSegments = computePauseSegments(session, now);
	return {
		wallClockMs: computeWallClockMs(session, now),
		activeTimeMs: computeActiveTimeMs(session, now),
		totalPauseMs: pauseSegments.reduce((sum, s) => sum + s.durationMs, 0),
		pauseCount: pauseSegments.length,
		pauseSegments,
	};
}

// ── Activity Intelligence (FR-15) ────────────────────────────

/**
 * Computes aggregated activity analytics for a session.
 * Pure function — no side effects, reuses existing time helpers.
 */
export function computeActivityIntelligence(session: Session, now: number = Date.now(), globalFilter: string[] = []): ActivityIntelligence {
	const perFilter = session.activityFilter ?? [];
	const activity = (session.activity ?? []).filter((a) => !isExcluded(a.path, globalFilter, perFilter));
	const uniquePaths = new Set(activity.map((a) => a.path));

	const artifacts = (session.artifacts ?? []).filter((a) => !isExcluded(a.path, globalFilter, perFilter));

	const tasks = session.executionTasks ?? [];
	const tasksCompleted = tasks.filter((t) => t.completed).length;

	const timeline = session.timeline ?? [];

	return {
		filesModified: uniquePaths.size,
		artifactsProduced: artifacts.length,
		tasksCompleted,
		eventsEmitted: timeline.length,
		wallClockMs: computeWallClockMs(session, now),
		activeTimeMs: computeActiveTimeMs(session, now),
		pauseTimeMs: computeTotalPauseMs(session, now),
	};
}
