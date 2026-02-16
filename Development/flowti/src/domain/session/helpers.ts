/**
 * Pure helper functions for the Session domain.
 *
 * All functions are side-effect free and trivially testable.
 */

import type { Session, SessionGoal, SessionType, PauseSegment, TimelineSummary } from "./types";

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
 * Creates a new Session object with default values.
 */
export function createSession(
	id: string,
	type: SessionType,
	title: string,
	durationMinutes: number,
	focusFile?: string,
): Session {
	return {
		id,
		type,
		title,
		status: "prepared",
		durationMinutes,
		createdAt: new Date().toISOString(),
		startedAt: null,
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: focusFile ?? null,
		timeline: [],
		goals: [],
	};
}

/**
 * Creates a new SessionGoal with default values.
 */
export function createGoal(id: string, text: string): SessionGoal {
	return {
		id,
		text,
		completed: false,
		completedAt: null,
	};
}

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
