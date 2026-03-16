/**
 * placeholder-page.tsx — Generic "Coming soon" page for unmigrated pages.
 */

import React from "react";
import { Box, Text } from "ink";
import type { PageProps } from "../types.js";

export function PlaceholderPage({ pageId }: PageProps): React.JSX.Element {
	return (
		<Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
			<Text bold color="yellow">{"\u{1F6A7}"} {pageId}</Text>
			<Text dimColor>This page is being migrated to the new TUI.</Text>
			<Text dimColor>Press Esc to go back.</Text>
		</Box>
	);
}
