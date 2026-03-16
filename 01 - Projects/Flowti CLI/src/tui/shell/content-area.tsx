/**
 * content-area.tsx — Renders the active page component from the page registry.
 */

import React from "react";
import { Box } from "ink";
import { getPage } from "../pages/page-registry.js";

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
}

export function ContentArea({ pageId, params, navigate, goBack }: ContentAreaProps): React.JSX.Element {
	const Page = getPage(pageId);
	return (
		<Box flexGrow={1} flexDirection="column">
			{React.createElement(Page, { pageId, params, navigate, goBack })}
		</Box>
	);
}
