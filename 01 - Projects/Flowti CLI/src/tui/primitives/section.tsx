/**
 * section.tsx — Titled content block with optional collapse.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";

interface SectionProps {
	readonly title: string;
	readonly collapsible?: boolean;
	readonly children: React.ReactNode;
}

export function Section({ title, collapsible, children }: SectionProps): React.JSX.Element {
	const [collapsed, setCollapsed] = useState(false);

	const toggle = collapsible ? () => setCollapsed((c) => !c) : undefined;
	const prefix = collapsible ? (collapsed ? "\u25B6" : "\u25BC") : "\u2500";

	return (
		<Box flexDirection="column" marginY={0}>
			<Box>
				<Text bold color="cyan" dimColor={collapsed}>
					{prefix} {title}
				</Text>
			</Box>
			{!collapsed && (
				<Box flexDirection="column" paddingLeft={2}>
					{children}
				</Box>
			)}
		</Box>
	);
}
