/**
 * action-bar.tsx — Bottom contextual action buttons.
 *
 * Renders a row of key+label pairs. Used at the bottom of list and dashboard pages.
 */

import React from "react";
import { Box, Text } from "ink";

export interface ActionDef {
	readonly key: string;
	readonly label: string;
}

interface ActionBarProps {
	readonly actions: readonly ActionDef[];
}

export function ActionBar({ actions }: ActionBarProps): React.JSX.Element {
	if (actions.length === 0) return React.createElement(React.Fragment);
	return (
		<Box gap={2} paddingX={1}>
			{actions.map((action) => (
				<Text key={action.key} dimColor>
					<Text bold color="cyan">{action.key}</Text> {action.label}
				</Text>
			))}
		</Box>
	);
}
