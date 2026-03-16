/**
 * chat-activity-bar.tsx — Side panel selector for chat view (Chat, Tasks, Files).
 */

import React from "react";
import { Box, Text } from "ink";

type ChatPanel = "chat" | "tasks" | "files";

interface ChatActivityBarProps {
	readonly activePanel: ChatPanel;
	readonly focused: boolean;
	readonly onSelect: (panel: ChatPanel) => void;
}

interface PanelDef {
	readonly id: ChatPanel;
	readonly icon: string;
	readonly label: string;
}

const PANELS: readonly PanelDef[] = [
	{ id: "chat", icon: "\uD83D\uDCAC", label: "Chat" },
	{ id: "tasks", icon: "\uD83D\uDCCB", label: "Tasks" },
	{ id: "files", icon: "\uD83D\uDCC1", label: "Files" },
];

export function ChatActivityBar({ activePanel, focused }: ChatActivityBarProps): React.JSX.Element {
	return (
		<Box flexDirection="column" width={12} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
			{PANELS.map((panel) => {
				const isActive = panel.id === activePanel;
				const cursor = focused && isActive ? "\u25B8 " : "  ";
				return (
					<Box key={panel.id} paddingX={1}>
						<Text bold={isActive} color={isActive ? "cyan" : undefined} dimColor={!isActive}>
							{cursor}{panel.icon} {panel.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
