/**
 * message-area.tsx — Displays a list of chat messages with role prefixes and streaming indicator.
 */

import React from "react";
import { Box, Text } from "ink";

export interface ChatMessage {
	readonly id: string;
	readonly role: "user" | "assistant" | "system";
	readonly content: string;
	readonly timestamp: string;
}

interface MessageAreaProps {
	readonly messages: readonly ChatMessage[];
	readonly streamingContent?: string;
}

const ROLE_PREFIXES: Record<string, string> = {
	user: "You:",
	assistant: "Agent:",
	system: "System:",
};

export function MessageArea({ messages, streamingContent }: MessageAreaProps): React.JSX.Element {
	if (messages.length === 0 && streamingContent === undefined) {
		return (
			<Box flexDirection="column" flexGrow={1} paddingX={1}>
				<Text dimColor>No messages yet</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			{messages.map((msg) => {
				const prefix = ROLE_PREFIXES[msg.role] ?? "Unknown:";
				const isSystem = msg.role === "system";
				return (
					<Box key={msg.id} flexDirection="column" marginBottom={1}>
						<Box gap={1}>
							<Text bold={!isSystem} dimColor={isSystem}>{prefix}</Text>
							<Text dimColor={isSystem}>{msg.content}</Text>
						</Box>
					</Box>
				);
			})}
			{streamingContent !== undefined && (
				<Box flexDirection="column" marginBottom={1}>
					<Box gap={1}>
						<Text bold>Agent:</Text>
						<Text>{streamingContent}...</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
}
