/**
 * scrollable-list.tsx — Arrow-key navigable list with virtualization.
 *
 * Uses a stateful scroll offset with follow-cursor behavior:
 * scroll stays still until the selection moves out of the visible window.
 */

import React, { useState, useEffect } from "react";
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
	const [scrollOffset, setScrollOffset] = useState(0);

	useEffect(() => {
		setScrollOffset((prev) => {
			if (selected < prev) return selected;
			if (selected >= prev + visibleCount) return selected - visibleCount + 1;
			return prev;
		});
	}, [selected, visibleCount]);

	const safeOffset = Math.max(0, Math.min(scrollOffset, items.length - visibleCount));
	const visibleItems = items.slice(safeOffset, safeOffset + visibleCount);

	if (items.length === 0) {
		return (
			<Box paddingX={1}>
				<Text dimColor>No items</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{safeOffset > 0 && <Text dimColor> {"  \u25B2 more"}</Text>}
			{visibleItems.map((item, vi) => {
				const actualIndex = safeOffset + vi;
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
			{safeOffset + visibleCount < items.length && <Text dimColor> {"  \u25BC more"}</Text>}
		</Box>
	);
}
