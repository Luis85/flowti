/**
 * use-navigation.ts — Navigation state machine hook for the TUI shell.
 *
 * Manages per-section page stacks (section memory), cross-section navigation,
 * and breadcrumb-compatible page history.
 */

import { useState, useCallback } from "react";
import type { Section, NavigationState, SectionState } from "../types.js";
import { findSectionForPage } from "./section-map.js";

interface UseNavigationResult {
	readonly state: NavigationState;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly setSection: (sectionId: string) => void;
}

function initSections(sections: readonly Section[]): Record<string, SectionState> {
	const map: Record<string, SectionState> = {};
	for (const s of sections) {
		map[s.id] = { pageStack: [s.pages[0]], params: {} };
	}
	return map;
}

export function useNavigation(sections: readonly Section[]): UseNavigationResult {
	const [state, setState] = useState<NavigationState>(() => ({
		activeSection: "home",
		sections: initSections(sections),
	}));

	const navigate = useCallback((pageId: string, params?: Record<string, string>) => {
		setState((prev) => {
			const targetSection = findSectionForPage(sections, pageId);
			if (!targetSection) return prev;

			if (targetSection === prev.activeSection) {
				// Same section — push onto current stack
				const current = prev.sections[prev.activeSection];
				return {
					...prev,
					sections: {
						...prev.sections,
						[prev.activeSection]: {
							pageStack: [...current.pageStack, pageId],
							params: params ?? {},
						},
					},
				};
			}

			// Cross-section — switch section and set page
			return {
				activeSection: targetSection,
				sections: {
					...prev.sections,
					[targetSection]: {
						pageStack: [pageId],
						params: params ?? {},
					},
				},
			};
		});
	}, [sections]);

	const goBack = useCallback(() => {
		setState((prev) => {
			const current = prev.sections[prev.activeSection];
			if (current.pageStack.length <= 1) return prev;
			return {
				...prev,
				sections: {
					...prev.sections,
					[prev.activeSection]: {
						pageStack: current.pageStack.slice(0, -1),
						params: {},
					},
				},
			};
		});
	}, []);

	const setSection = useCallback((sectionId: string) => {
		const section = sections.find((s) => s.id === sectionId);
		if (!section) return;
		setState((prev) => {
			if (sectionId === prev.activeSection) {
				// Re-selecting current section → reset to landing page
				return {
					...prev,
					sections: {
						...prev.sections,
						[sectionId]: { pageStack: [section.pages[0]], params: {} },
					},
				};
			}
			// Switch to section — preserve its existing state (section memory)
			return { ...prev, activeSection: sectionId };
		});
	}, [sections]);

	return { state, navigate, goBack, setSection };
}
