/**
 * Session auto-documentation — generates a completion summary document.
 *
 * Pure function: Session → markdown. Called from closure handlers
 * when a session transitions to "completed".
 */

import type { Session } from "./types";
import { SESSION_TYPE_CONFIGS, SESSION_NOTES_FOLDER } from "./types";

/** Vault path for the completion summary document. */
export function getSessionDocPath(session: Session): string {
	const datePrefix = session.completedAt
		? session.completedAt.split("T")[0]
		: new Date().toISOString().split("T")[0];
	const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
	const shortId = session.id.slice(-6);
	return `${SESSION_NOTES_FOLDER}/Summaries/${datePrefix} ${safeName} (${shortId}).md`;
}

/** Generates a completion summary markdown for a finished session. */
export function generateSessionDoc(session: Session): string {
	const lines: string[] = [];
	const config = SESSION_TYPE_CONFIGS[session.type];

	// Frontmatter
	lines.push("---");
	lines.push("type: SessionSummary");
	lines.push(`sessionId: "${session.id}"`);
	lines.push(`title: "${session.title.replace(/"/g, '\\"')}"`);
	lines.push(`sessionType: "${session.type}"`);
	lines.push(`completed: "${session.completedAt ?? ""}"`);
	lines.push("---");
	lines.push("");

	// Header
	lines.push(`# ${session.title} — Summary`);
	lines.push("");
	lines.push(`**Type:** ${config?.label ?? session.type} | **Duration:** ${session.durationMinutes} min`);
	lines.push("");

	// Artifacts
	if (session.artifacts.length > 0) {
		lines.push("## Artifacts");
		lines.push("");
		for (const a of session.artifacts) {
			lines.push(`- [[${a.path}]] *(${a.action})*`);
		}
		lines.push("");
	}

	// Decisions
	if (session.decisions.length > 0) {
		lines.push("## Decisions");
		lines.push("");
		for (const d of session.decisions) {
			lines.push(`- **${d.title}**${d.description ? `: ${d.description}` : ""}`);
		}
		lines.push("");
	}

	// Reflections
	if (session.reflections.length > 0) {
		lines.push("## Reflections");
		lines.push("");
		for (const r of session.reflections) {
			lines.push(`- **[${r.type}]** ${r.content}`);
		}
		lines.push("");
	}

	// Closure
	if (session.closureResponse) {
		lines.push("## Closure");
		lines.push("");
		lines.push(`- **Outcome:** ${session.closureResponse.outcomeAchieved}`);
		if (session.closureResponse.nextAction.trim()) {
			lines.push(`- **Next action:** ${session.closureResponse.nextAction.trim()}`);
		}
		lines.push("");
	}

	// Link back to session notes
	if (session.notesFile) {
		lines.push("---");
		lines.push(`Session notes: [[${session.notesFile}]]`);
	}

	return lines.join("\n") + "\n";
}
