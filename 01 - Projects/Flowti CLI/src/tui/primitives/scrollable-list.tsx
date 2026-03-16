/**
 * scrollable-list.tsx — Arrow-key navigable list with virtualization.
 *
 * Uses useStdout() for dynamic height. Only renders the visible window.
 */

import React from "react";
import { Box, Text, useStdout } from "ink";

interface ScrollableListProps<T> {
	readonly items: readonly T[];
	readonly selected: number;
	readonly renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
	readonly onSelect?: (index: number) => void;
	readonly maxHeight?: number;
}

export function ScrollableList<T>({ items, selected, renderItem, maxHeight }: ScrollableListProps<T>): React.JSX.Element {
	const { stdout } = useStdout();
	const termRows = stdout?.rows ?? 24;
	const visibleCount = maxHeight ?? Math.max(3, termRows - 10);

	const scrollStart = Math.max(0, Math.min(selected - Math.floor(visibleCount / 2), items.length - visibleCount));
	const visibleItems = items.slice(scrollStart, scrollStart + visibleCount);

	if (items.length === 0) {
		return (
			<Box paddingX={1}>
				<Text dimColor>No items</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{scrollStart > 0 && <Text dimColor> {"  \u25B2 more"}</Text>}
			{visibleItems.map((item, vi) => {
				const actualIndex = scrollStart + vi;
				const isSelected = actualIndex === selected;
				return (
					<Box key={actualIndex} paddingLeft={1}>
						<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
							{isSelected ? "\u25B6 " : "  "}
						</Text>
						{renderItem(item, actualIndex, isSelected)}
					</Box>
				);
			})}
			{scrollStart + visibleCount < items.length && <Text dimColor> {"  \u25BC more"}</Text>}
		</Box>
	);
}
