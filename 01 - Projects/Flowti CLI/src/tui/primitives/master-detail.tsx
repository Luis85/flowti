/**
 * master-detail.tsx — Split panel layout.
 *
 * Renders master (left) and detail (right) panes side by side.
 * Master gets 40% width via flexBasis, detail fills the rest.
 */

import React from "react";
import { Box } from "ink";

interface MasterDetailProps {
	readonly master: React.ReactNode;
	readonly detail?: React.ReactNode;
}

export function MasterDetail({ master, detail }: MasterDetailProps): React.JSX.Element {
	return (
		<Box flexDirection="row" flexGrow={1}>
			<Box flexDirection="column" flexBasis="40%" flexShrink={0} overflow="hidden" borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
				{master}
			</Box>
			{detail !== undefined && (
				<Box flexDirection="column" flexGrow={1} paddingLeft={1}>
					{detail}
				</Box>
			)}
		</Box>
	);
}
