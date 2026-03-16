/**
 * header-bar.tsx — Top bar showing breadcrumb navigation and project name.
 */

import React from "react";
import { Box, Text } from "ink";

interface HeaderBarProps {
	readonly breadcrumbs: readonly string[];
	readonly projectName?: string;
}

export function HeaderBar({ breadcrumbs, projectName }: HeaderBarProps): React.JSX.Element {
	return (
		<Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} paddingX={1}>
			<Box flexGrow={1} gap={0}>
				{breadcrumbs.map((crumb, i) => (
					<React.Fragment key={i}>
						{i > 0 && <Text dimColor> {">"} </Text>}
						<Text bold={i === breadcrumbs.length - 1} color={i === breadcrumbs.length - 1 ? "cyan" : undefined}>
							{crumb}
						</Text>
					</React.Fragment>
				))}
			</Box>
			{projectName !== undefined && (
				<Text dimColor>{projectName}</Text>
			)}
		</Box>
	);
}
