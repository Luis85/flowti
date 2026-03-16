/**
 * scrollable-list.tsx — Arrow-key navigable list with virtualization.
 *
 * Uses a ref-based scroll offset with follow-cursor behavior:
 * scroll stays still until the selection moves out of the visible window.
 * Offset is computed synchronously during render (no useEffect double-render).
 */

import React, { useRef } from "react";
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
	const offsetRef = useRef(0);

	// Compute offset synchronously — no useEffect, no double-render
	let offset = offsetRef.current;
	if (selected < offset) offset = selected;
	if (selected >= offset + visibleCount) offset = selected - visibleCount + 1;
	offset = Math.max(0, Math.min(offset, Math.max(0, items.length - visibleCount)));
	offsetRef.current = offset;

	const visibleItems = items.slice(offset, offset + visibleCount);

	if (items.length === 0) {
		return (
			<Box paddingX={1}>
				<Text dimColor>No items</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{offset > 0 && <Text dimColor> {"  \u25B2 more"}</Text>}
			{visibleItems.map((item, vi) => {
				const actualIndex = offset + vi;
				const isSelected = actualIndex === selected;
				return (
					<Box key={`item-${actualIndex}`} paddingLeft={1}>
						<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
							{isSelected ? "\u25B6 " : "  "}
						</Text>
						{renderItem(item, actualIndex, isSelected)}
					</Box>
				);
			})}
			{offset + visibleCount < items.length && <Text dimColor> {"  \u25BC more"}</Text>}
		</Box>
	);
}
