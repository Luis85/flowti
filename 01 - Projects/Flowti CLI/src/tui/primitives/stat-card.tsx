/**
 * stat-card.tsx — Single KPI box showing a label, value, and optional trend.
 */

import React from "react";
import { Box, Text } from "ink";

export interface StatCardData {
	readonly label: string;
	readonly value: string | number;
	readonly trend?: string;
	readonly color?: string;
}

export function StatCard({ label, value, trend, color }: StatCardData): React.JSX.Element {
	return (
		<Box flexDirection="column" borderStyle="round" paddingX={1} minWidth={16}>
			<Text dimColor>{label}</Text>
			<Text bold color={color}>{String(value)}</Text>
			{trend !== undefined && <Text dimColor>{trend}</Text>}
		</Box>
	);
}
