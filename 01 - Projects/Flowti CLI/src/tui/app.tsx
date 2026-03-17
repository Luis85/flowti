/**
 * app.tsx — Root Ink component for the Flowti CLI TUI.
 *
 * Layout: ActivityBar (left) | Header + Content + StatusBar (right)
 *
 * Focus zones: Tab cycles between activity-bar and content.
 * Activity bar: ↑↓ move cursor, Enter opens section.
 * Content: keyboard delegated to page components.
 * Escape: goBack in content, or move focus to activity bar at root.
 */

import React, { useState, useCallback } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import { buildSections } from "./navigation/section-map.js";
import { useNavigation } from "./navigation/use-navigation.js";
import { useFocusZone } from "./hooks/use-focus-zone.js";
import { useKeyboard } from "./navigation/use-keyboard.js";
import { getHintsForZone } from "./hooks/use-status-hints.js";
import { ActivityBar } from "./shell/activity-bar.js";
import { HeaderBar } from "./shell/header-bar.js";
import { ContentArea } from "./shell/content-area.js";
import { StatusBar } from "./shell/status-bar.js";
import { NavigationProvider } from "./sitemap/navigation-context.js";
import type { Section, FocusZone } from "./types.js";

function buildBreadcrumbs(sections: readonly Section[], pageStack: readonly string[]): string[] {
	return pageStack.map((pageId) => {
		const section = sections.find((s) => s.pages.includes(pageId));
		if (section && section.pages[0] === pageId) return section.label;
		return pageId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	});
}

const ZONES: readonly FocusZone[] = ["activity-bar", "content"];

export function App(): React.JSX.Element {
	const { exit } = useApp();
	const sections = buildSections();
	const { state, navigate, goBack, setSection } = useNavigation(sections);
	const { active: focusZone, setActive: setFocusZone } = useFocusZone(ZONES);
	const [cursorSection, setCursorSection] = useState(state.activeSection);
	const [_refreshKey, setRefreshKey] = useState(0);
	const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

	const handleSectionOpen = useCallback((sectionId: string) => {
		setSection(sectionId);
		setFocusZone("content");
	}, [setSection, setFocusZone]);

	// Activity bar keyboard (arrows + Enter) — only when bar is focused
	useKeyboard({
		sections,
		activeSection: cursorSection,
		onSectionChange: setCursorSection,
		onSectionOpen: handleSectionOpen,
		enabled: focusZone === "activity-bar",
	});

	// Default Escape behavior — passed to ContentArea, which delegates to pages first
	const handleEscapeDefault = useCallback(() => {
		if (focusZone !== "content") return;
		const currentStack = state.sections[state.activeSection].pageStack;
		if (currentStack.length > 1) {
			goBack();
		} else {
			setFocusZone("activity-bar");
			setCursorSection(state.activeSection);
		}
	}, [focusZone, state, goBack, setFocusZone, setCursorSection]);

	// Global keys: Tab, Ctrl+N, q (Escape handled by ContentArea)
	useInput((input, key) => {
		if (key.tab) {
			if (focusZone === "activity-bar") {
				setFocusZone("content");
			} else {
				setFocusZone("activity-bar");
				setCursorSection(state.activeSection);
			}
			return;
		}

		if (key.ctrl && input >= "1" && input <= "8") {
			const idx = parseInt(input, 10) - 1;
			if (idx < sections.length) {
				setSection(sections[idx].id);
				setCursorSection(sections[idx].id);
				setFocusZone("content");
			}
			return;
		}

		if (input === "q" && !key.ctrl && !key.meta) {
			exit();
		}
	});

	const { stdout } = useStdout();
	const termHeight = stdout?.rows ?? 24;

	const activeState = state.sections[state.activeSection];
	const activePage = activeState.pageStack[activeState.pageStack.length - 1];
	const breadcrumbs = buildBreadcrumbs(sections, activeState.pageStack);
	const hints = getHintsForZone(focusZone);

	return (
		<NavigationProvider navigate={navigate} goBack={goBack} refresh={refresh}>
			<Box flexDirection="row" width="100%" height={termHeight} overflow="hidden">
				<ActivityBar
					sections={sections}
					activeSection={state.activeSection}
					focused={focusZone === "activity-bar"}
					cursorSection={cursorSection}
					onSelect={handleSectionOpen}
				/>
				<Box flexDirection="column" flexGrow={1}>
					<HeaderBar breadcrumbs={breadcrumbs} />
					<ContentArea
						pageId={activePage}
						params={activeState.params}
						navigate={navigate}
						goBack={goBack}
						focused={focusZone === "content"}
						onEscapeDefault={handleEscapeDefault}
					/>
					<StatusBar hints={hints} />
				</Box>
			</Box>
		</NavigationProvider>
	);
}
