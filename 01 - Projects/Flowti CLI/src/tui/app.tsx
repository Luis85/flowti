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
import { ActivityBar } from "./shell/activity-bar.js";
import { HeaderBar } from "./shell/header-bar.js";
import { ContentArea } from "./shell/content-area.js";
import { StatusBar } from "./shell/status-bar.js";
import type { Section } from "./types.js";

function buildBreadcrumbs(sections: readonly Section[], pageStack: readonly string[]): string[] {
	return pageStack.map((pageId) => {
		const section = sections.find((s) => s.pages.includes(pageId));
		if (section && section.pages[0] === pageId) return section.label;
		return pageId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	});
}

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

	useInput((input, key) => {
		if (key.escape) {
			goBack();
		}
		if (key.ctrl && input >= "1" && input <= "8") {
			const idx = parseInt(input, 10) - 1;
			if (idx < sections.length) {
				setSection(sections[idx].id);
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
