/**
 * use-navigation.ts — Navigation state machine hook for the TUI shell.
 *
 * Manages section selection, page stack (for breadcrumbs/back), and page params.
 */

import { useState, useCallback } from "react";
import type { Section, NavigationState } from "../types.js";
import { findSectionForPage } from "./section-map.js";

interface UseNavigationResult {
	readonly state: NavigationState;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly setSection: (sectionId: string) => void;
}

export function useNavigation(sections: readonly Section[]): UseNavigationResult {
	const [state, setState] = useState<NavigationState>({
		section: "home",
		pageStack: ["start"],
		params: {},
	});

	const navigate = useCallback((pageId: string, params?: Record<string, string>) => {
		setState((prev) => {
			const targetSection = findSectionForPage(sections, pageId);
			return {
				section: targetSection ?? prev.section,
				pageStack: [...prev.pageStack, pageId],
				params: params ?? {},
			};
		});
	}, [sections]);

	const goBack = useCallback(() => {
		setState((prev) => {
			if (prev.pageStack.length <= 1) return prev;
			const newStack = prev.pageStack.slice(0, -1);
			const topPage = newStack[newStack.length - 1];
			const targetSection = findSectionForPage(sections, topPage);
			return {
				section: targetSection ?? prev.section,
				pageStack: newStack,
				params: {},
			};
		});
	}, [sections]);

	const setSection = useCallback((sectionId: string) => {
		const section = sections.find((s) => s.id === sectionId);
		if (!section) return;
		const rootPage = section.pages[0];
		setState({
			section: sectionId,
			pageStack: [rootPage],
			params: {},
		});
	}, [sections]);

	return { state, navigate, goBack, setSection };
}
