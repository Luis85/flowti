/**
 * content-area.tsx — Renders the active page component from the page registry.
 *
 * For pages with registered loaders: calls loader, passes data + onAction as props.
 * For pages without loaders: passes basic PageProps (backward-compatible with Phase 0).
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import { getPage } from "../pages/page-registry.js";

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
}

export function ContentArea({ pageId, params, navigate, goBack }: ContentAreaProps): React.JSX.Element {
	const [actionError, setActionError] = useState<string | null>(null);
	const Page = getPage(pageId);

	const handleAction = (_actionId: string, _params?: Record<string, string>) => {
		setActionError(null);
		// Action bridge will be wired in Phase 2 when loaders are registered
	};

	return (
		<Box flexGrow={1} flexDirection="column">
			{actionError !== null && (
				<Box paddingX={1} marginBottom={1}>
					<Text color="red" bold>Error: {actionError} </Text>
					<Text dimColor>(press any key to dismiss)</Text>
				</Box>
			)}
			{React.createElement(Page, { pageId, params, navigate, goBack, onAction: handleAction })}
		</Box>
	);
}
