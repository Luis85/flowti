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

function resolveDate(session: Session): string {
	return session.completedAt
		? new Date(session.completedAt).toISOString().split("T")[0]
		: new Date(session.createdAt).toISOString().split("T")[0];
}

const PLACEHOLDER_RESOLVERS: Record<string, (session: Session) => string> = {
	"{{title}}": (s) => s.title,
	"{{date}}": resolveDate,
	"{{type}}": (s) => resolveTypeConfig(s.type).label,
	"{{duration}}": (s) => formatDurationHuman(computeElapsedMs(s)),
	"{{goals}}": (s) => s.goals.length > 0
		? s.goals.map((g) => `- [${g.completed ? "x" : " "}] ${g.text}`).join("\n")
		: "*No goals recorded.*",
	"{{decisions}}": (s) => s.decisions.length > 0
		? s.decisions.map((d) => `- **${d.title}**${d.description ? `: ${d.description}` : ""}`).join("\n")
		: "*No decisions recorded.*",
	"{{artifacts}}": (s) => s.artifacts.length > 0
		? s.artifacts.map((a) => `- [[${a.path}]] *(${a.action})*`).join("\n")
		: "*No artifacts tracked.*",
	"{{context}}": (s) => s.contextBindings.length > 0
		? s.contextBindings.map((b) => b.label).join(", ")
		: "*No context bindings.*",
	"{{notes}}": (s) => s.notes.trim() || "*No notes recorded.*",
	"{{overview}}": (s) => {
		const date = resolveDate(s);
		const typeLabel = resolveTypeConfig(s.type).label;
		return `- **Date:** ${date}\n- **Type:** ${typeLabel}\n- **Duration:** ${formatDurationHuman(computeElapsedMs(s))}`;
	},
};

/**
 * Resolves a single placeholder against a session's data.
 */
export function resolvePlaceholder(placeholder: string, session: Session): string {
	const resolver = PLACEHOLDER_RESOLVERS[placeholder];
	return resolver ? resolver(session) : placeholder;
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
