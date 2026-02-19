/**
 * Pure helper functions for the Session domain.
 *
 * All functions are side-effect free and trivially testable.
 */

import type { ContextBindingType, Session, SessionContextBinding, SessionDecision, SessionGoal, SessionOutputTemplate, SessionTemplate, SessionType, SessionTypeConfig, PauseSegment, TimelineSummary } from "./types";
import { SESSION_TYPE_CONFIGS } from "./types";

// ── Session Type Resolution ──────────────────────────────────

/**
 * Resolves the configuration for a session type.
 * Custom configs take priority over built-in configs.
 * Returns the built-in "documentation" config as fallback for unknown types.
 */
export function resolveTypeConfig(
	type: SessionType,
	customConfigs?: Record<string, SessionTypeConfig>,
): SessionTypeConfig {
	if (customConfigs && customConfigs[type]) {
		return customConfigs[type];
	}
	return SESSION_TYPE_CONFIGS[type] ?? SESSION_TYPE_CONFIGS["documentation"];
}

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
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
	};
}

/**
 * Creates a new SessionContextBinding, auto-deriving label from the path basename.
 */
export function createContextBinding(
	id: string,
	type: ContextBindingType,
	path: string,
): SessionContextBinding {
	const segments = path.replace(/\/$/, "").split("/");
	const last = segments[segments.length - 1] ?? path;
	const label = last.includes(".") ? last.replace(/\.[^.]+$/, "") : last;
	return { id, type, label, path, boundAt: new Date().toISOString() };
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
 * Creates a new SessionDecision.
 */
export function createDecision(id: string, title: string, description?: string, context?: string): SessionDecision {
	return {
		id,
		title,
		description,
		recordedAt: new Date().toISOString(),
		context,
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

	// Context Bindings
	if (session.contextBindings && session.contextBindings.length > 0) {
		lines.push("### Context Bindings");
		for (const b of session.contextBindings) {
			lines.push(`- **${b.type}**: [[${b.path}]] *(${b.label})*`);
		}
		lines.push("");
	}

	// Decisions
	if (session.decisions && session.decisions.length > 0) {
		lines.push("### Decisions");
		for (const d of session.decisions) {
			lines.push(`- **${d.title}**${d.description ? `: ${d.description}` : ""}${d.context ? ` *(${d.context})*` : ""}`);
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

// ── Session Output Artifacts ────────────────────────────────

/** 3 pre-built output templates for generating session artifacts. */
export const BUILT_IN_OUTPUT_TEMPLATES: readonly SessionOutputTemplate[] = [
	{
		type: "meeting-invite",
		title: "Meeting Invite",
		description: "Structured meeting invite with goals, decisions, and context",
		sections: [
			{ heading: "Overview", placeholder: "{{overview}}" },
			{ heading: "Goals", placeholder: "{{goals}}" },
			{ heading: "Decisions", placeholder: "{{decisions}}" },
			{ heading: "Context", placeholder: "{{context}}" },
		],
	},
	{
		type: "action-items",
		title: "Action Items",
		description: "Extracted action items from decisions and activity",
		sections: [
			{ heading: "Summary", placeholder: "{{overview}}" },
			{ heading: "Action Items", placeholder: "{{decisions}}" },
			{ heading: "Files Changed", placeholder: "{{artifacts}}" },
		],
	},
	{
		type: "review-summary",
		title: "Review Summary",
		description: "Complete session review with all details",
		sections: [
			{ heading: "Session Overview", placeholder: "{{overview}}" },
			{ heading: "Goals", placeholder: "{{goals}}" },
			{ heading: "Decisions", placeholder: "{{decisions}}" },
			{ heading: "Artifacts", placeholder: "{{artifacts}}" },
			{ heading: "Notes", placeholder: "{{notes}}" },
		],
	},
];

/**
 * Resolves a single placeholder against a session's data.
 */
export function resolvePlaceholder(placeholder: string, session: Session): string {
	switch (placeholder) {
		case "{{title}}":
			return session.title;
		case "{{date}}":
			return session.completedAt
				? new Date(session.completedAt).toISOString().split("T")[0]
				: new Date(session.createdAt).toISOString().split("T")[0];
		case "{{type}}":
			return resolveTypeConfig(session.type).label;
		case "{{duration}}": {
			const elapsedMs = computeElapsedMs(session);
			return formatDurationHuman(elapsedMs);
		}
		case "{{goals}}":
			return session.goals.length > 0
				? session.goals.map((g) => `- [${g.completed ? "x" : " "}] ${g.text}`).join("\n")
				: "*No goals recorded.*";
		case "{{decisions}}":
			return session.decisions.length > 0
				? session.decisions.map((d) => `- **${d.title}**${d.description ? `: ${d.description}` : ""}`).join("\n")
				: "*No decisions recorded.*";
		case "{{artifacts}}":
			return session.artifacts.length > 0
				? session.artifacts.map((a) => `- [[${a.path}]] *(${a.action})*`).join("\n")
				: "*No artifacts tracked.*";
		case "{{context}}":
			return session.contextBindings.length > 0
				? session.contextBindings.map((b) => b.label).join(", ")
				: "*No context bindings.*";
		case "{{notes}}":
			return session.notes.trim() || "*No notes recorded.*";
		case "{{overview}}": {
			const date = session.completedAt
				? new Date(session.completedAt).toISOString().split("T")[0]
				: new Date(session.createdAt).toISOString().split("T")[0];
			const typeLabel = resolveTypeConfig(session.type).label;
			const elapsedMs = computeElapsedMs(session);
			return `- **Date:** ${date}\n- **Type:** ${typeLabel}\n- **Duration:** ${formatDurationHuman(elapsedMs)}`;
		}
		default:
			return placeholder;
	}
}

/**
 * Generates a markdown output artifact from a session using a template.
 * Pure function — no side effects.
 */
export function generateSessionOutput(session: Session, template: SessionOutputTemplate): string {
	const titleLine = `# ${template.title}: ${session.title}`;
	const sectionLines = template.sections.map((section) => {
		const content = resolvePlaceholder(section.placeholder, session);
		return `## ${section.heading}\n\n${content}`;
	});
	return `${titleLine}\n\n${sectionLines.join("\n\n")}\n`;
}

// ── Path Reconciliation ──────────────────────────────────────

/**
 * Updates all paths in a session when a file is renamed/moved.
 * Returns true if any path was updated.
 *
 * Checks: focusFile, notesFile, canvasFile, contextBindings[].path,
 * artifacts[].path, links[].path.
 */
export function updateSessionPathsForFileMove(session: Session, oldPath: string, newPath: string): boolean {
	let hit = false;
	if (session.focusFile === oldPath) { session.focusFile = newPath; hit = true; }
	if (session.notesFile === oldPath) { session.notesFile = newPath; hit = true; }
	if (session.canvasFile === oldPath) { session.canvasFile = newPath; hit = true; }
	for (const binding of session.contextBindings) {
		if (binding.path === oldPath) { binding.path = newPath; hit = true; }
	}
	for (const artifact of session.artifacts) {
		if (artifact.path === oldPath) { artifact.path = newPath; hit = true; }
	}
	for (const link of session.links) {
		if (link.path === oldPath) { link.path = newPath; hit = true; }
	}
	return hit;
}

/**
 * Updates all paths in a session when a folder is renamed/moved.
 * Uses prefix matching to catch all children under the folder.
 * Returns true if any path was updated.
 *
 * Checks all 7 path fields: focusFile, notesFile, canvasFile,
 * contextBindings[].path, artifacts[].path, links[].path, activityFilter[].
 */
export function updateSessionPathsForFolderMove(session: Session, oldPath: string, newPath: string): boolean {
	let hit = false;
	const oldPrefix = oldPath + "/";

	if (session.focusFile && session.focusFile.startsWith(oldPrefix)) {
		session.focusFile = newPath + session.focusFile.slice(oldPath.length); hit = true;
	}
	if (session.notesFile && session.notesFile.startsWith(oldPrefix)) {
		session.notesFile = newPath + session.notesFile.slice(oldPath.length); hit = true;
	}
	if (session.canvasFile && session.canvasFile.startsWith(oldPrefix)) {
		session.canvasFile = newPath + session.canvasFile.slice(oldPath.length); hit = true;
	}
	for (const binding of session.contextBindings) {
		if (binding.path === oldPath + "/" || binding.path.startsWith(oldPrefix)) {
			binding.path = newPath + binding.path.slice(oldPath.length); hit = true;
		}
	}
	for (const artifact of session.artifacts) {
		if (artifact.path.startsWith(oldPrefix)) {
			artifact.path = newPath + artifact.path.slice(oldPath.length); hit = true;
		}
	}
	for (const link of session.links) {
		if (link.path.startsWith(oldPrefix)) {
			link.path = newPath + link.path.slice(oldPath.length); hit = true;
		}
	}
	for (let i = 0; i < session.activityFilter.length; i++) {
		if (session.activityFilter[i] === oldPath || session.activityFilter[i].startsWith(oldPrefix)) {
			session.activityFilter[i] = newPath + session.activityFilter[i].slice(oldPath.length); hit = true;
		}
	}
	return hit;
}

/**
 * Updates a template's focusFile when a file is renamed.
 * Returns true if the path was updated.
 */
export function updateTemplatePathForFileMove(tmpl: SessionTemplate, oldPath: string, newPath: string): boolean {
	if (tmpl.focusFile === oldPath) {
		tmpl.focusFile = newPath;
		return true;
	}
	return false;
}

/**
 * Updates a template's focusFile when a folder is renamed.
 * Returns true if the path was updated.
 */
export function updateTemplatePathForFolderMove(tmpl: SessionTemplate, oldPath: string, newPath: string): boolean {
	const oldPrefix = oldPath + "/";
	if (tmpl.focusFile && tmpl.focusFile.startsWith(oldPrefix)) {
		tmpl.focusFile = newPath + tmpl.focusFile.slice(oldPath.length);
		return true;
	}
	return false;
}
