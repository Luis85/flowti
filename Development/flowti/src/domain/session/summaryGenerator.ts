/**
 * Session notes generation: frontmatter, summary body, merge, and full summary.
 */

import type { Session } from "./types";
import { SESSION_TYPE_CONFIGS } from "./types";
import { isExcluded } from "./sessionUtils";
import { computeActivityIntelligence, formatDurationHuman } from "./timeHelpers";

// ── Session Notes Frontmatter ────────────────────────────────

/** Structured frontmatter fields for a session notes file. */
export interface SessionFrontmatter {
	// ── Identity ──────────────────────────────────────────────
	type: "SessionNote";
	title: string;
	sessionId: string;
	sessionType: string;
	status: string;
	// ── Timing ────────────────────────────────────────────────
	duration: number;
	created: string;
	started?: string;
	completed?: string;
	// ── Context ───────────────────────────────────────────────
	focusFile?: string;
	canvasFile?: string;
	energy?: number;
	intent?: string;
	// ── Activity Intelligence (FR-15) ─────────────────────────
	filesModified?: number;
	artifactsProduced?: number;
	tasksCompleted?: number;
	eventsEmitted?: number;
	wallClockMs?: number;
	activeTimeMs?: number;
	pauseTimeMs?: number;
}

/** Generates the YAML frontmatter record for a session. */
export function generateSessionFrontmatter(session: Session, globalFilter: string[] = []): SessionFrontmatter {
	const fm: SessionFrontmatter = {
		type: "SessionNote",
		title: session.title,
		sessionId: session.id,
		sessionType: session.type,
		status: session.status,
		duration: session.durationMinutes,
		created: session.createdAt,
	};
	if (session.startedAt) fm.started = session.startedAt;
	if (session.completedAt) fm.completed = session.completedAt;
	if (session.focusFile) fm.focusFile = session.focusFile;
	if (session.canvasFile) fm.canvasFile = session.canvasFile;
	if (session.energy !== null && session.energy !== undefined) fm.energy = session.energy;
	if (session.intent) fm.intent = session.intent.primaryOutcome;

	// Activity Intelligence metrics (flat key:value, no objects)
	const intel = computeActivityIntelligence(session, Date.now(), globalFilter);
	if (intel.filesModified > 0) fm.filesModified = intel.filesModified;
	if (intel.artifactsProduced > 0) fm.artifactsProduced = intel.artifactsProduced;
	if (intel.tasksCompleted > 0) fm.tasksCompleted = intel.tasksCompleted;
	if (intel.eventsEmitted > 0) fm.eventsEmitted = intel.eventsEmitted;
	if (intel.wallClockMs > 0) fm.wallClockMs = intel.wallClockMs;
	if (intel.activeTimeMs > 0) fm.activeTimeMs = intel.activeTimeMs;
	if (intel.pauseTimeMs > 0) fm.pauseTimeMs = intel.pauseTimeMs;

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
export function generateSessionSummaryBody(session: Session, globalFilter: string[] = []): string {
	const lines: string[] = [];

	lines.push(SESSION_SUMMARY_MARKER);
	lines.push("");

	// Focus file (only when different from notes file itself)
	if (session.focusFile && session.focusFile !== session.notesFile) {
		lines.push(`**Focus:** [[${session.focusFile}]]`);
		lines.push("");
	}

	// Energy level
	if (session.energy !== null && session.energy !== undefined) {
		const ENERGY_LABELS: Record<number, string> = { 1: "Drained", 2: "Low", 3: "Moderate", 4: "Good", 5: "Energized" };
		lines.push(`**Energy:** ${"⚡".repeat(session.energy)} ${ENERGY_LABELS[session.energy] ?? ""} (${session.energy}/5)`);
		lines.push("");
	}

	// Guiding Questions (from session type config)
	const config = SESSION_TYPE_CONFIGS[session.type];
	if (config?.guidingQuestions.length > 0) {
		lines.push("### Guiding Questions");
		for (const q of config.guidingQuestions) {
			lines.push(`- ${q}`);
		}
		lines.push("");
	}

	// Goals
	if (session.goals.length > 0) {
		lines.push("### Goals");
		for (const g of session.goals) {
			lines.push(`- [${g.completed ? "x" : " "}] ${g.text}`);
		}
		lines.push("");
	}

	// Execution Plan
	if (session.executionTasks && session.executionTasks.length > 0) {
		lines.push("### Execution Plan");
		const sorted = [...session.executionTasks].sort((a, b) => a.order - b.order);
		for (const t of sorted) {
			lines.push(`- [${t.completed ? "x" : " "}] ${t.label}`);
		}
		lines.push("");
	}

	// Session notes (from in-workspace textarea)
	if (session.notes.trim()) {
		lines.push("### Session Notes");
		lines.push(session.notes.trim());
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

	// Reflections
	if (session.reflections && session.reflections.length > 0) {
		lines.push("### Reflections");
		const REFLECTION_ICONS: Record<string, string> = { observation: "👁", blocker: "🚫", idea: "💡", decision: "⚖️" };
		for (const r of session.reflections) {
			lines.push(`- ${REFLECTION_ICONS[r.type] ?? "•"} **[${r.type}]** ${r.content}`);
		}
		lines.push("");
	}

	// Closure Ritual (FR-14) — captures the session's closure response
	if (session.closureResponse) {
		const cr = session.closureResponse;
		lines.push("### Closure Ritual");
		lines.push(`- **Outcome achieved:** ${cr.outcomeAchieved}`);
		if (cr.whatWorked.trim()) lines.push(`- **What worked:** ${cr.whatWorked.trim()}`);
		if (cr.whatDidnt.trim()) lines.push(`- **What didn't:** ${cr.whatDidnt.trim()}`);
		if (cr.nextAction.trim()) lines.push(`- **Next action:** ${cr.nextAction.trim()}`);
		for (const [key, value] of Object.entries(cr.answers)) {
			if (value.trim()) lines.push(`- **${key}:** ${value.trim()}`);
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

	// Timeline
	if (session.timeline.length > 0) {
		lines.push("### Timeline");
		for (const entry of session.timeline) {
			const time = new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
			lines.push(`- ${time} — ${entry.action}`);
		}
		lines.push("");
	}

	// Activity Intelligence (FR-15) — single aggregated section replacing
	// the former Artifacts, Activity Intelligence, and Time Summary sections.
	const perFilter = session.activityFilter ?? [];
	const intel = computeActivityIntelligence(session, Date.now(), globalFilter);
	const filteredArtifacts = (session.artifacts ?? []).filter((a) => !isExcluded(a.path, globalFilter, perFilter));
	const hasActivity = intel.filesModified > 0 || intel.artifactsProduced > 0
		|| intel.tasksCompleted > 0 || intel.eventsEmitted > 0 || intel.wallClockMs > 0;
	if (hasActivity) {
		lines.push("### Activity Intelligence");
		lines.push(`- **Files modified:** ${intel.filesModified}`);
		lines.push(`- **Artifacts produced:** ${intel.artifactsProduced}`);
		lines.push(`- **Tasks completed:** ${intel.tasksCompleted}`);
		lines.push(`- **Events emitted:** ${intel.eventsEmitted}`);
		if (intel.wallClockMs > 0) {
			lines.push(`- **Wall clock:** ${formatDurationHuman(intel.wallClockMs)}`);
			lines.push(`- **Active time:** ${formatDurationHuman(intel.activeTimeMs)}`);
			if (intel.pauseTimeMs > 0) {
				lines.push(`- **Pause time:** ${formatDurationHuman(intel.pauseTimeMs)}`);
			}
		}
		if (filteredArtifacts.length > 0) {
			lines.push("");
			lines.push("**Artifacts:**");
			for (const a of filteredArtifacts) {
				lines.push(`- [[${a.path}]] *(${a.action})*`);
			}
		}
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
export function mergeSessionNotes(existingContent: string, session: Session, globalFilter: string[] = []): string {
	const { fields: existingFm, body: existingBody } = parseFrontmatter(existingContent);

	// Merge frontmatter: session fields overwrite, user fields preserved
	const sessionFm = generateSessionFrontmatter(session, globalFilter);
	const merged: Record<string, unknown> = { ...existingFm, ...sessionFm };

	// Split body at session summary marker — everything before is user content
	const markerIndex = existingBody.indexOf(SESSION_SUMMARY_MARKER);
	const userContent = markerIndex >= 0
		? existingBody.substring(0, markerIndex).trimEnd()
		: existingBody.trimEnd();

	const summaryBody = generateSessionSummaryBody(session, globalFilter);

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
export function generateSessionSummary(session: Session, globalFilter: string[] = []): string {
	const fm = serializeFrontmatter({ ...generateSessionFrontmatter(session, globalFilter) });
	const title = `# ${session.title}`;
	const body = generateSessionSummaryBody(session, globalFilter);
	return `${fm}\n\n${title}\n\n${body}\n`;
}
