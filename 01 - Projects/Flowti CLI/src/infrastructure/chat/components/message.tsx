/**
 * message.tsx — Single conversation message with optional tool panel.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../chat-renderer-types.js";
import { ToolPanel } from "./tool-panel.js";

interface MessageProps {
	readonly message: ChatMessage;
	readonly agentName: string;
	readonly toolsExpanded: boolean;
}

function relativeTime(timestamp: string): string {
	const delta = Date.now() - new Date(timestamp).getTime();
	const seconds = Math.floor(delta / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
}

export function Message({ message, agentName, toolsExpanded }: MessageProps): React.JSX.Element {
	const isUser = message.role === "user";
	const name = isUser ? "You" : agentName;
	const nameColor: Parameters<typeof Text>[0]["color"] = isUser ? "blue" : "cyan";
	const timeStr = relativeTime(message.timestamp);

	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box gap={1}>
				<Text bold color={nameColor}>{name}</Text>
				<Text dimColor>{timeStr}</Text>
			</Box>
			<Box marginLeft={2}>
				<Text>{message.content}</Text>
			</Box>
			{message.tools !== undefined && message.tools.length > 0 && (
				<ToolPanel tools={message.tools} expanded={toolsExpanded} />
			)}
		</Box>
	);
}
