/**
 * action-bar.tsx — Bottom contextual action buttons.
 *
 * Renders a row of key+label pairs with support for disabled state
 * and group separators. Used at the bottom of list and dashboard pages.
 */

import React from "react";
import { Box, Text } from "ink";

export interface ActionDef {
	readonly key: string;
	readonly label: string;
	readonly disabled?: boolean;
	readonly group?: string;
}

interface ActionBarProps {
	readonly actions: readonly ActionDef[];
}

export function ActionBar({ actions }: ActionBarProps): React.JSX.Element {
	if (actions.length === 0) return React.createElement(React.Fragment);

	const elements: React.JSX.Element[] = [];
	let lastGroup: string | undefined;

	for (const action of actions) {
		if (action.group && lastGroup && action.group !== lastGroup) {
			elements.push(React.createElement(Text, { key: `sep-${action.key}`, dimColor: true }, " \u2502 "));
		}
		lastGroup = action.group;

		if (action.disabled) {
			elements.push(
				React.createElement(Text, { key: action.key, dimColor: true },
					`[${action.key}] ${action.label}`,
				),
			);
		} else {
			elements.push(
				React.createElement(Text, { key: action.key, dimColor: true },
					React.createElement(Text, { color: "cyan", bold: true }, `[${action.key}]`),
					` ${action.label}`,
				),
			);
		}
	}

	return React.createElement(Box, { gap: 2, paddingX: 1 }, ...elements);
}
