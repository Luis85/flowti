/**
 * Pure helper functions for the Session domain.
 *
 * All functions are side-effect free and trivially testable.
 */

import type { Session, SessionGoal, SessionType, PauseSegment, TimelineSummary } from "./types";

// ── Activity filtering (ADR-026) ─────────────────────────────

/**
 * Check if a file path is excluded by global or per-session folder filters.
 * A path is excluded if it starts with any filter prefix.
 */
export function isExcluded(path: string, globalFilter: string[], perSessionFilter: string[]): boolean {
	for (const prefix of globalFilter) {
		if (prefix && path.startsWith(prefix)) return true;
	}
	for (const prefix of perSessionFilter) {
		if (prefix && path.startsWith(prefix)) return true;
	}
	return false;
}

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
		activity: [],
		activityFilter: [],
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

// ── Session Notes Frontmatter ────────────────────────────────

/** Structured frontmatter fields for a session notes file. */
export interface SessionFrontmatter {
	title: string;
	type: string;
	status: string;
	duration: number;
	created: string;
	started?: string;
	completed?: string;
	focusFile?: string;
	canvasFile?: string;
	sessionId: string;
}

/** Generates the YAML frontmatter record for a session. */
export function generateSessionFrontmatter(session: Session): SessionFrontmatter {
	const fm: SessionFrontmatter = {
		title: session.title,
		type: session.type,
		status: session.status,
		duration: session.durationMinutes,
		created: session.createdAt,
		sessionId: session.id,
	};
	if (session.startedAt) fm.started = session.startedAt;
	if (session.completedAt) fm.completed = session.completedAt;
	if (session.focusFile) fm.focusFile = session.focusFile;
	if (session.canvasFile) fm.canvasFile = session.canvasFile;
	return fm;
}

/** Serializes a record as YAML frontmatter (--- delimited). */
function serializeFrontmatter(fields: Record<string, unknown>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		if (typeof value === "string") {
			lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
		} else {
			lines.push(`${key}: ${String(value)}`);
		}
	}
	lines.push("---");
	return lines.join("\n");
}

/**
 * Parses YAML frontmatter from a markdown file.
 * Returns the parsed key-value pairs and the body after the closing ---.
 */
function parseFrontmatter(content: string): { fields: Record<string, string>; body: string } {
	const fields: Record<string, string> = {};
	if (!content.startsWith("---")) {
		return { fields, body: content };
	}
	const endIndex = content.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { fields, body: content };
	}
	const yamlBlock = content.substring(4, endIndex).trim();
	for (const line of yamlBlock.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.substring(0, colonIdx).trim();
		let value = line.substring(colonIdx + 1).trim();
		// Strip surrounding quotes
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1).replace(/\\"/g, '"');
		}
		fields[key] = value;
	}
	const bodyStart = endIndex + 4; // skip "\n---"
	const body = content.substring(bodyStart).replace(/^\n+/, "");
	return { fields, body };
}

// ── Session Summary Body ─────────────────────────────────────

const SESSION_SUMMARY_MARKER = "## Session Summary";

/** Generates the markdown summary body (everything below the frontmatter). */
export function generateSessionSummaryBody(session: Session): string {
	const lines: string[] = [];

	lines.push(SESSION_SUMMARY_MARKER);
	lines.push("");

	// Goals
	if (session.goals.length > 0) {
		lines.push("### Goals");
		for (const g of session.goals) {
			lines.push(`- [${g.completed ? "x" : " "}] ${g.text}`);
		}
		lines.push("");
	}

	// Links
	if (session.links && session.links.length > 0) {
		lines.push("### Links");
		for (const l of session.links) {
			lines.push(`- [[${l.path}]]`);
		}
		lines.push("");
	}

	// Artifacts
	if (session.artifacts.length > 0) {
		lines.push("### Artifacts");
		for (const a of session.artifacts) {
			lines.push(`- [[${a.path}]] *(${a.action})*`);
		}
		lines.push("");
	}

	// Timeline
	if (session.timeline.length > 0) {
		lines.push("### Timeline");
		for (const entry of session.timeline) {
			const time = new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
			lines.push(`- ${time} — ${entry.action}`);
		}
		lines.push("");
	}

	// Time summary
	const summary = computeTimelineSummary(session);
	if (summary.wallClockMs > 0) {
		lines.push("### Time Summary");
		lines.push(`- **Wall clock:** ${formatDurationHuman(summary.wallClockMs)}`);
		lines.push(`- **Active time:** ${formatDurationHuman(summary.activeTimeMs)}`);
		if (summary.pauseCount > 0) {
			lines.push(`- **Total pause:** ${formatDurationHuman(summary.totalPauseMs)} (${summary.pauseCount} pause${summary.pauseCount > 1 ? "s" : ""})`);
		}
		lines.push("");
	}

	// Session notes (from in-workspace textarea)
	if (session.notes.trim()) {
		lines.push("### Session Notes");
		lines.push(session.notes.trim());
		lines.push("");
	}

	return lines.join("\n");
}

// ── Merge ────────────────────────────────────────────────────

/**
 * Merges a session's data into an existing notes file.
 *
 * - Frontmatter: session fields are updated; user-added fields are preserved.
 * - Body: everything before the `## Session Summary` marker is preserved (user content).
 *   The summary section is replaced with the latest session data.
 */
export function mergeSessionNotes(existingContent: string, session: Session): string {
	const { fields: existingFm, body: existingBody } = parseFrontmatter(existingContent);

	// Merge frontmatter: session fields overwrite, user fields preserved
	const sessionFm = generateSessionFrontmatter(session);
	const merged: Record<string, unknown> = { ...existingFm, ...sessionFm };

	// Split body at session summary marker — everything before is user content
	const markerIndex = existingBody.indexOf(SESSION_SUMMARY_MARKER);
	const userContent = markerIndex >= 0
		? existingBody.substring(0, markerIndex).trimEnd()
		: existingBody.trimEnd();

	const summaryBody = generateSessionSummaryBody(session);

	const parts = [serializeFrontmatter(merged)];
	if (userContent) {
		parts.push(userContent);
	}
	parts.push(summaryBody);

	return parts.join("\n\n") + "\n";
}

/**
 * Generates a full Markdown summary for a session (frontmatter + body).
 * Used for creating new notes files. For existing files, use mergeSessionNotes.
 */
export function generateSessionSummary(session: Session): string {
	const fm = serializeFrontmatter({ ...generateSessionFrontmatter(session) });
	const title = `# ${session.title}`;
	const body = generateSessionSummaryBody(session);
	return `${fm}\n\n${title}\n\n${body}\n`;
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
