/**
 * section-map.ts — Maps sitemap pages to activity bar sections.
 *
 * The section list is static — derived from the spec's activity bar design.
 * Pages are grouped by domain affinity, not by sitemap.json structure.
 */

import type { Section } from "../types.js";

export function buildSections(): Section[] {
	return [
		{ id: "home", label: "Home", icon: "\u{1F3E0}", pages: ["start"] },
		{ id: "agents", label: "Agents", icon: "\u{1F464}", pages: ["ai-tools", "agent-detail", "agents-chat"] },
		{ id: "project", label: "Project", icon: "\u{1F4CB}", pages: ["projects-list", "project-detail", "build", "test", "health", "scaffold", "make", "review", "devtools"] },
		{ id: "reports", label: "Reports", icon: "\u{1F4CA}", pages: ["reports"] },
		{ id: "events", label: "Events", icon: "\u26A1", pages: ["event-catalog"] },
		{ id: "management", label: "Manage", icon: "\u{1F527}", pages: ["iterations", "iteration-detail", "lifecycle", "resources", "timelog", "deliverables", "raid", "requirements", "capa"] },
		{ id: "publish", label: "Publish", icon: "\u{1F4E6}", pages: ["publish", "plugins"] },
		{ id: "help", label: "Help", icon: "\u2753", pages: ["help", "onboarding", "onboarding-tour", "knowledgebase", "capture"] },
	];
}

export function findSectionForPage(sections: readonly Section[], pageId: string): string | null {
	for (const section of sections) {
		if (section.pages.includes(pageId)) return section.id;
	}
	return null;
}
