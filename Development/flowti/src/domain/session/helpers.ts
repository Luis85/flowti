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
		links: [],
		notesFile: null,
		canvasFile: null,
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
 * Generates a full Markdown summary for a completed session.
 * Pure function — only reads from the Session object.
 */
export function generateSessionSummary(session: Session): string {
	const lines: string[] = [];

	lines.push(`# ${session.title}`);
	lines.push("");
	lines.push("## Session Info");
	lines.push(`- **Type:** ${session.type}`);
	lines.push(`- **Status:** ${session.status}`);
	lines.push(`- **Duration:** ${session.durationMinutes} minutes`);
	lines.push(`- **Created:** ${session.createdAt}`);
	if (session.startedAt) lines.push(`- **Started:** ${session.startedAt}`);
	if (session.completedAt) lines.push(`- **Completed:** ${session.completedAt}`);
	if (session.focusFile) lines.push(`- **Focus File:** [[${session.focusFile}]]`);
	if (session.canvasFile) lines.push(`- **Canvas:** [[${session.canvasFile}]]`);

	// Goals
	if (session.goals.length > 0) {
		lines.push("");
		lines.push("## Goals");
		for (const g of session.goals) {
			lines.push(`- [${g.completed ? "x" : " "}] ${g.text}`);
		}
	}

	// Links
	if (session.links && session.links.length > 0) {
		lines.push("");
		lines.push("## Links");
		for (const l of session.links) {
			lines.push(`- [[${l.path}]]`);
		}
	}

	// Artifacts
	if (session.artifacts.length > 0) {
		lines.push("");
		lines.push("## Artifacts");
		for (const a of session.artifacts) {
			lines.push(`- [[${a.path}]] *(${a.action})*`);
		}
	}

	// Timeline
	if (session.timeline.length > 0) {
		lines.push("");
		lines.push("## Timeline");
		for (const entry of session.timeline) {
			const time = new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
			lines.push(`- ${time} — ${entry.action}`);
		}
	}

	// Time summary
	const summary = computeTimelineSummary(session);
	if (summary.wallClockMs > 0) {
		lines.push("");
		lines.push("## Time Summary");
		lines.push(`- **Wall clock:** ${formatDurationHuman(summary.wallClockMs)}`);
		lines.push(`- **Active time:** ${formatDurationHuman(summary.activeTimeMs)}`);
		if (summary.pauseCount > 0) {
			lines.push(`- **Total pause:** ${formatDurationHuman(summary.totalPauseMs)} (${summary.pauseCount} pause${summary.pauseCount > 1 ? "s" : ""})`);
		}
	}

	// Notes
	if (session.notes.trim()) {
		lines.push("");
		lines.push("## Notes");
		lines.push(session.notes.trim());
	}

	lines.push("");
	return lines.join("\n");
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
