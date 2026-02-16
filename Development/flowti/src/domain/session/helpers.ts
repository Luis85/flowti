/**
 * Pure helper functions for the Session domain.
 *
 * All functions are side-effect free and trivially testable.
 */

import type { Session, SessionType } from "./types";

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
	};
}
