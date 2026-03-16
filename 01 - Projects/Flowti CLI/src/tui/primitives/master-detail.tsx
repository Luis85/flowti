/**
 * master-detail.tsx — Split panel layout.
 *
 * Renders master (left) and detail (right) panes side by side.
 */

import React from "react";
import { Box } from "ink";

interface MasterDetailProps {
	readonly masterWidth?: number;
	readonly master: React.ReactNode;
	readonly detail?: React.ReactNode;
}

export function MasterDetail({ masterWidth, master, detail }: MasterDetailProps): React.JSX.Element {
	return (
		<Box flexDirection="row" flexGrow={1}>
			<Box flexDirection="column" width={masterWidth ?? 30} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
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
