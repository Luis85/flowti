/**
 * activity-bar.tsx — Left icon column for section switching.
 *
 * Renders a vertical list of section icons with labels.
 * When focused: shows cursor indicator on the cursor section.
 * Active section is highlighted. Adapts to terminal width:
 * - Compact mode (<50 cols): width 4, icons only
 * - Normal mode (>=50 cols): width 14, icons + labels + cursor indicator
 */

import React from "react";
import { Box, Text, useStdout } from "ink";
import type { Section } from "../types.js";

interface ActivityBarProps {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly focused: boolean;
	readonly cursorSection: string;
	readonly onSelect: (sectionId: string) => void;
}

export function ActivityBar({ sections, activeSection, focused, cursorSection }: ActivityBarProps): React.JSX.Element {
	const { stdout } = useStdout();
	const cols = stdout?.columns ?? 80;
	const compact = cols < 50;
	const barWidth = compact ? 4 : 14;

	return (
		<Box
			flexDirection="column"
			width={barWidth}
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
				const color = isCursor ? "cyan" : isActive ? "white" : undefined;

				if (compact) {
					return (
						<Box key={section.id} justifyContent="center">
							<Text bold={isCursor || isActive} color={color} dimColor={!isActive && !isCursor}>
								{section.icon}
							</Text>
						</Box>
					);
				}

				const prefix = isCursor ? "\u25B8 " : "  ";
				return (
					<Box key={section.id} paddingX={1}>
						<Text bold={isCursor || isActive} color={color} dimColor={!isActive && !isCursor}>
							{prefix}{section.icon} {section.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
