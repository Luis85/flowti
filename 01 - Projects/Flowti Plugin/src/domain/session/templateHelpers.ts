/**
 * Session output templates and placeholder resolution.
 */

import type { Session, SessionOutputTemplate } from "./types";
import { resolveTypeConfig } from "./sessionUtils";
import { computeElapsedMs, formatDurationHuman } from "./timeHelpers";

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
