/**
 * activity-bar.tsx — Left icon column for section switching.
 *
 * Renders a vertical list of section icons. The active section is highlighted.
 * Arrow up/down navigation is handled by the parent via useKeyboard.
 */

import React from "react";
import { Box, Text } from "ink";
import type { Section } from "../types.js";

interface ActivityBarProps {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSelect: (sectionId: string) => void;
}

export function ActivityBar({ sections, activeSection }: ActivityBarProps): React.JSX.Element {
	return (
		<Box flexDirection="column" width={8} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
			{sections.map((section) => {
				const isActive = section.id === activeSection;
				return (
					<Box key={section.id} paddingX={1}>
						<Text bold={isActive} color={isActive ? "cyan" : undefined} dimColor={!isActive}>
							{section.icon} {isActive ? section.label : ""}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
