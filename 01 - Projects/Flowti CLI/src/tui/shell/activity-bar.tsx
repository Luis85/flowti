/**
 * activity-bar.tsx — Left icon column for section switching.
 *
 * Renders a vertical list of section icons with labels.
 * When focused: shows cursor indicator on the cursor section.
 * Active section is highlighted. Width determined by content via flexbox.
 */

import React from "react";
import { Box, Text } from "ink";
import type { Section } from "../types.js";

interface ActivityBarProps {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly focused: boolean;
	readonly cursorSection: string;
	readonly onSelect: (sectionId: string) => void;
}

export function ActivityBar({ sections, activeSection, focused, cursorSection }: ActivityBarProps): React.JSX.Element {
	return (
		<Box
			flexDirection="column"
			flexShrink={0}
			borderStyle="single"
			borderRight
			borderTop={false}
			borderBottom={false}
			borderLeft={false}
			borderColor={focused ? "cyan" : undefined}
		>
			{sections.map((section) => {
				const isActive = section.id === activeSection;
				const isCursor = focused && section.id === cursorSection;
				const prefix = isCursor ? "\u25B8 " : "  ";
				const color = isCursor ? "cyan" : isActive ? "white" : undefined;
				return (
					<Box key={section.id} paddingX={1}>
						<Text bold={isCursor || isActive} color={color} dimColor={!isActive && !isCursor} wrap="truncate">
							{prefix}{section.icon} {section.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
