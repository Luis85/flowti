/**
 * chat-header-bar.tsx — Top bar for chat view showing agent name, status, and model.
 */

import React from "react";
import { Box, Text } from "ink";

interface ChatHeaderBarProps {
	readonly agentName: string;
	readonly status: "idle" | "thinking" | "streaming";
	readonly model: string;
}

const STATUS_INDICATORS: Record<string, string> = {
	idle: "\u25CF",
	thinking: "\u25CC",
	streaming: "\u25C9",
};

export function ChatHeaderBar({ agentName, status, model }: ChatHeaderBarProps): React.JSX.Element {
	const indicator = STATUS_INDICATORS[status] ?? "\u25CF";
	const statusColor = status === "idle" ? "green" : "yellow";
	return (
		<Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} paddingX={1}>
			<Box flexGrow={1} gap={1}>
				<Text bold>{agentName}</Text>
				<Text color={statusColor}>{indicator} {status}</Text>
			</Box>
			<Text dimColor>{model}</Text>
		</Box>
	);
}
