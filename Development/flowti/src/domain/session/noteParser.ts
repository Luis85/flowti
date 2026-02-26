/**
 * Reverse parsing of session notes files back into structured data.
 * Used for bidirectional sync between session state and note files.
 */

import type { Session } from "./types";

// ── Types ────────────────────────────────────────────────────

/** Parsed result from a session notes file for reverse sync. */
export interface ReverseParsedNotes {
	goals: Array<{ label: string; checked: boolean }>;
	tasks: Array<{ label: string; checked: boolean }>;
	sessionNotes: string;
}

/** Diff between parsed note content and session state. */
export interface ReverseSyncDiff {
	goalToggles: Array<{ goalId: string; completed: boolean }>;
	taskToggles: Array<{ taskId: string; completed: boolean }>;
	newGoals: Array<{ label: string; checked: boolean }>;
	newTasks: Array<{ label: string; checked: boolean }>;
	notesUpdate: string | null;
	changes: string[];
}

// ── Parsing ──────────────────────────────────────────────────

const SESSION_SUMMARY_MARKER = "## Session Summary";

/** Parses checkbox lines (`- [x] label` / `- [ ] label`) from a section string. */
export function parseSectionCheckboxes(sectionContent: string): Array<{ label: string; checked: boolean }> {
	const results: Array<{ label: string; checked: boolean }> = [];
	const regex = /^- \[(x| )\] (.+)$/gm;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(sectionContent)) !== null) {
		results.push({ label: match[2], checked: match[1] === "x" });
	}
	return results;
}

/** Extracts text between a heading and the next heading (or end of content). */
export function parseSectionText(content: string, startHeading: string, nextHeadings: string[]): string {
	const startIdx = content.indexOf(startHeading);
	if (startIdx < 0) return "";
	const afterHeading = content.substring(startIdx + startHeading.length);
	let endIdx = afterHeading.length;
	for (const heading of nextHeadings) {
		const idx = afterHeading.indexOf(heading);
		if (idx >= 0 && idx < endIdx) endIdx = idx;
	}
	return afterHeading.substring(0, endIdx).trim();
}

/** Parses a session notes file and extracts goals, tasks, and notes text. */
export function reverseParseSessionNotes(content: string): ReverseParsedNotes {
	const empty: ReverseParsedNotes = { goals: [], tasks: [], sessionNotes: "" };
	const markerIdx = content.indexOf(SESSION_SUMMARY_MARKER);
	if (markerIdx < 0) return empty;
	const summarySection = content.substring(markerIdx);

	const sectionHeadings = ["### Guiding Questions", "### Goals", "### Execution Plan", "### Session Notes", "### Decisions", "### Reflections", "### Closure Ritual", "### Context Bindings", "### Timeline", "### Activity Intelligence", "### Artifacts", "### Time Summary"];

	const goalsText = parseSectionText(summarySection, "### Goals", sectionHeadings.filter(h => h !== "### Goals"));
	const tasksText = parseSectionText(summarySection, "### Execution Plan", sectionHeadings.filter(h => h !== "### Execution Plan"));
	const notesText = parseSectionText(summarySection, "### Session Notes", sectionHeadings.filter(h => h !== "### Session Notes"));

	return {
		goals: parseSectionCheckboxes(goalsText),
		tasks: parseSectionCheckboxes(tasksText),
		sessionNotes: notesText,
	};
}

// ── Diff Computation ─────────────────────────────────────────

/** Computes the diff between parsed note content and current session state. */
export function computeReverseSyncDiff(session: Session, parsed: ReverseParsedNotes): ReverseSyncDiff {
	const goalToggles: Array<{ goalId: string; completed: boolean }> = [];
	const taskToggles: Array<{ taskId: string; completed: boolean }> = [];
	const newGoals: Array<{ label: string; checked: boolean }> = [];
	const newTasks: Array<{ label: string; checked: boolean }> = [];
	const changes: string[] = [];

	// Match goals by label text
	for (const pg of parsed.goals) {
		const match = session.goals.find(g => g.text === pg.label);
		if (match) {
			if (match.completed !== pg.checked) {
				goalToggles.push({ goalId: match.id, completed: pg.checked });
				changes.push(`goal "${pg.label}" ${pg.checked ? "checked" : "unchecked"}`);
			}
		} else {
			newGoals.push(pg);
			changes.push(`goal "${pg.label}" added`);
		}
	}

	// Match tasks by label text
	for (const pt of parsed.tasks) {
		const match = session.executionTasks.find(t => t.label === pt.label);
		if (match) {
			if (match.completed !== pt.checked) {
				taskToggles.push({ taskId: match.id, completed: pt.checked });
				changes.push(`task "${pt.label}" ${pt.checked ? "checked" : "unchecked"}`);
			}
		} else {
			newTasks.push(pt);
			changes.push(`task "${pt.label}" added`);
		}
	}

	// Compare notes text
	const currentNotes = session.notes.trim();
	const parsedNotes = parsed.sessionNotes.trim();
	const notesUpdate = parsedNotes !== currentNotes ? parsedNotes : null;
	if (notesUpdate !== null) {
		changes.push("notes updated");
	}

	return { goalToggles, taskToggles, newGoals, newTasks, notesUpdate, changes };
}
