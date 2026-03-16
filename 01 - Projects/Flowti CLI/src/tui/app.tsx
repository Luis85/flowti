/**
 * app.tsx — Root Ink component for the Flowti CLI TUI.
 *
 * Layout: ActivityBar (left) | Header + Content + StatusBar (right)
 * Navigation managed by useNavigation hook.
 * Pages resolved from page-registry.
 */

import React from "react";
import { Box, useInput } from "ink";
import { buildSections } from "./navigation/section-map.js";
import { useNavigation } from "./navigation/use-navigation.js";
import { useFocusZone } from "./hooks/use-focus-zone.js";
import { ActivityBar } from "./shell/activity-bar.js";
import { HeaderBar } from "./shell/header-bar.js";
import { ContentArea } from "./shell/content-area.js";
import { StatusBar } from "./shell/status-bar.js";
import type { Section, FocusZone } from "./types.js";

function buildBreadcrumbs(sections: readonly Section[], pageStack: readonly string[]): string[] {
	return pageStack.map((pageId) => {
		const section = sections.find((s) => s.pages.includes(pageId));
		if (section && section.pages[0] === pageId) return section.label;
		return pageId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	});
}

const FOCUS_ZONES: readonly FocusZone[] = ["activity-bar", "content", "actions"];

const DEFAULT_HINTS = [
	{ key: "\u2191\u2193", label: "Navigate" },
	{ key: "Enter", label: "Select" },
	{ key: "Esc", label: "Back" },
	{ key: "Tab", label: "Focus" },
	{ key: "?", label: "Help" },
];

export function App(): React.JSX.Element {
	const sections = buildSections();
	const { state, navigate, goBack, setSection } = useNavigation(sections);
	const focus = useFocusZone(FOCUS_ZONES);

	useInput((input, key) => {
		if (key.escape) {
			goBack();
		}
		if (key.tab) {
			if (key.shift) { focus.prev(); } else { focus.next(); }
		}
		if (key.ctrl && input >= "1" && input <= "8") {
			const idx = parseInt(input, 10) - 1;
			if (idx < sections.length) {
				setSection(sections[idx].id);
			}
		}
		// Activity bar navigation — arrow keys when activity-bar zone is focused
		if (focus.active === "activity-bar") {
			if (key.upArrow) {
				const idx = sections.findIndex((s) => s.id === state.section);
				if (idx > 0) setSection(sections[idx - 1].id);
			}
			if (key.downArrow) {
				const idx = sections.findIndex((s) => s.id === state.section);
				if (idx < sections.length - 1) setSection(sections[idx + 1].id);
			}
			if (key.return) {
				// Enter on activity bar navigates to section's first page
				const section = sections.find((s) => s.id === state.section);
				if (section && section.pages[0]) navigate(section.pages[0]);
			}
		}
	});

	const activePage = state.pageStack[state.pageStack.length - 1];
	const breadcrumbs = buildBreadcrumbs(sections, state.pageStack);

	return (
		<Box flexDirection="row" width="100%" height="100%">
			<ActivityBar sections={sections} activeSection={state.section} onSelect={setSection} />
			<Box flexDirection="column" flexGrow={1}>
				<HeaderBar breadcrumbs={breadcrumbs} />
				<ContentArea pageId={activePage} params={state.params} navigate={navigate} goBack={goBack} />
				<StatusBar hints={DEFAULT_HINTS} />
			</Box>
		</Box>
	);
}
