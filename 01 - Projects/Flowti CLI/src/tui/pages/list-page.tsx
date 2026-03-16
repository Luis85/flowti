/**
 * list-page.tsx — Generic list+detail page pattern.
 *
 * Renders a ScrollableList with optional MasterDetail panel.
 * Handles arrow-key navigation and item selection.
 * Used by agents, iterations, resources, deliverables, and many CRUD pages.
 */

import React, { useState } from "react";
import { Box, useInput } from "ink";
import { ScrollableList } from "../primitives/scrollable-list.js";
import { MasterDetail } from "../primitives/master-detail.js";
import { ActionBar } from "../primitives/action-bar.js";
import type { ActionDef } from "../primitives/action-bar.js";

interface ListPageProps<T> {
	readonly items: readonly T[];
	readonly renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
	readonly renderDetail?: (item: T) => React.ReactNode;
	readonly actions?: readonly ActionDef[];
	readonly onSelect?: (item: T, index: number) => void;
	readonly masterWidth?: number;
	readonly enabled?: boolean;
}

export function ListPage<T>({ items, renderItem, renderDetail, actions, onSelect, masterWidth, enabled = true }: ListPageProps<T>): React.JSX.Element {
	const [selected, setSelected] = useState(0);

	useInput((_input, key) => {
		if (!enabled) return;
		if (key.upArrow && selected > 0) setSelected((s) => s - 1);
		if (key.downArrow && selected < items.length - 1) setSelected((s) => s + 1);
		if (key.return && items[selected] && onSelect) onSelect(items[selected], selected);
	});

	const list = (
		<ScrollableList
			items={items}
			selected={selected}
			renderItem={renderItem}
		/>
	);

	const detail = renderDetail && items[selected] ? renderDetail(items[selected]) : undefined;

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box flexGrow={1}>
				{renderDetail ? (
					<MasterDetail masterWidth={masterWidth} master={list} detail={detail} />
				) : (
					list
				)}
			</Box>
			{actions && actions.length > 0 && <ActionBar actions={actions} />}
		</Box>
	);
}
