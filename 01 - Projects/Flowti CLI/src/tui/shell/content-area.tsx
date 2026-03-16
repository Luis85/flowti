/**
 * content-area.tsx — Renders the active page component from the page registry.
 *
 * Passes `focused` (derived from focus zone) to the active page as `enabled`.
 * Pages that respect `enabled` will only consume keyboard input when content is focused.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import { getPage } from "../pages/page-registry.js";
import { useLoaderContext } from "../context.js";

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly focused: boolean;
}

export function ContentArea({ pageId, params, navigate, goBack, focused }: ContentAreaProps): React.JSX.Element {
	const [actionError, setActionError] = useState<string | null>(null);
	const _ctx = useLoaderContext(params);
	const Page = getPage(pageId);

	const handleAction = (_actionId: string, _params?: Record<string, string>) => {
		setActionError(null);
	};

	return (
		<Box flexGrow={1} flexDirection="column">
			{actionError !== null && (
				<Box paddingX={1} marginBottom={1}>
					<Text color="red" bold>Error: {actionError} </Text>
					<Text dimColor>(press any key to dismiss)</Text>
				</Box>
			)}
			{React.createElement(Page, { pageId, params, navigate, goBack, onAction: handleAction, enabled: focused })}
		</Box>
	);
}
