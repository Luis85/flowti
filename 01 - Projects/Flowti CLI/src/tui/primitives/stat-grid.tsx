/**
 * stat-grid.tsx — Responsive grid of StatCards.
 *
 * Uses useStdout() to determine column count from terminal width.
 */

import React from "react";
import { Box, useStdout } from "ink";
import { StatCard } from "./stat-card.js";
import type { StatCardData } from "./stat-card.js";

interface StatGridProps {
	readonly stats: readonly StatCardData[];
}

export function StatGrid({ stats }: StatGridProps): React.JSX.Element {
	const { stdout } = useStdout();
	const termWidth = stdout?.columns ?? 80;
	const cardWidth = 18;
	const columns = Math.max(1, Math.floor(termWidth / cardWidth));

	const rows: StatCardData[][] = [];
	for (let i = 0; i < stats.length; i += columns) {
		rows.push(stats.slice(i, i + columns) as StatCardData[]);
	}

	return (
		<Box flexDirection="column">
			{rows.map((row, ri) => (
				<Box key={ri} gap={1}>
					{row.map((stat) => (
						<StatCard key={stat.label} {...stat} />
					))}
				</Box>
			))}
		</Box>
	);
}
