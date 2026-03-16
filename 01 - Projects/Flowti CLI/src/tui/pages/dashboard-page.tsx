/**
 * dashboard-page.tsx — Generic dashboard page pattern.
 *
 * Renders a StatGrid at top + scrollable Section list below.
 * Used by start, project-detail, health, agent-detail, build, test pages.
 */

import React from "react";
import { Box } from "ink";
import { StatGrid } from "../primitives/stat-grid.js";
import { Section } from "../primitives/section.js";
import { ActionBar } from "../primitives/action-bar.js";
import type { StatCardData } from "../primitives/stat-card.js";
import type { ActionDef } from "../primitives/action-bar.js";

export interface DashboardSection {
	readonly title: string;
	readonly content: React.ReactNode;
	readonly collapsible?: boolean;
}

interface DashboardPageProps {
	readonly stats?: readonly StatCardData[];
	readonly sections: readonly DashboardSection[];
	readonly actions?: readonly ActionDef[];
}

export function DashboardPage({ stats, sections, actions }: DashboardPageProps): React.JSX.Element {
	return (
		<Box flexDirection="column" flexGrow={1} overflow="hidden">
			{stats && stats.length > 0 && (
				<Box marginBottom={1}>
					<StatGrid stats={stats} />
				</Box>
			)}
			<Box flexDirection="column" flexGrow={1}>
				{sections.map((section) => (
					<Section key={section.title} title={section.title} collapsible={section.collapsible}>
						{section.content}
					</Section>
				))}
			</Box>
			{actions && actions.length > 0 && <ActionBar actions={actions} />}
		</Box>
	);
}
