/**
 * status-bar.tsx — Bottom bar showing key hints and agent status.
 */

import React from "react";
import { Box, Text } from "ink";

interface KeyHint {
	readonly key: string;
	readonly label: string;
}

interface StatusBarProps {
	readonly hints: readonly KeyHint[];
	readonly agentStatus?: string;
}

export function StatusBar({ hints, agentStatus }: StatusBarProps): React.JSX.Element {
	return (
		<Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
			<Box flexGrow={1} gap={2}>
				{hints.map((hint) => (
					<Text key={hint.key} dimColor>
						<Text bold>{hint.key}</Text> {hint.label}
					</Text>
				))}
			</Box>
			{agentStatus !== undefined && (
				<Text color="yellow">{agentStatus}</Text>
			)}
		</Box>
	);
}
