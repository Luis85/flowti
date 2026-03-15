/**
 * message-area.tsx — Scrollable message area showing history, messages, and streaming.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage, ChatTurn, ChatViewStatus } from "../chat-renderer-types.js";
import { Message } from "./message.js";

interface MessageAreaProps {
	readonly summary: string;
	readonly recentTurns: readonly ChatTurn[];
	readonly messages: readonly ChatMessage[];
	readonly streamingText: string;
	readonly streamingThinking: string;
	readonly agentName: string;
	readonly agentStatus: ChatViewStatus;
	readonly toolsExpanded: boolean;
}

function turnToMessage(turn: ChatTurn): ChatMessage {
	return {
		role: turn.role,
		content: turn.content,
		timestamp: turn.timestamp,
	};
}

export function MessageArea({
	summary,
	recentTurns,
	messages,
	streamingText,
	streamingThinking,
	agentName,
	agentStatus,
	toolsExpanded,
}: MessageAreaProps): React.JSX.Element {
	const hasStreaming = streamingText !== "" || streamingThinking !== "";
	const hasDivider = summary !== "" && recentTurns.length > 0;

	return (
		<Box flexDirection="column" flexGrow={1}>
			{summary !== "" && (
				<Box marginBottom={1}>
					<Text italic dimColor>{summary}</Text>
				</Box>
			)}
			{hasDivider && (
				<Box marginBottom={1}>
					<Text dimColor>{"─".repeat(40)}</Text>
				</Box>
			)}
			{recentTurns.map((turn, i) => (
				<Message
					key={`h-${i}`}
					message={turnToMessage(turn)}
					agentName={agentName}
					toolsExpanded={toolsExpanded}
				/>
			))}
			{messages.map((msg, i) => (
				<Message
					key={`m-${i}`}
					message={msg}
					agentName={agentName}
					toolsExpanded={toolsExpanded}
				/>
			))}
			{hasStreaming && (
				<Box flexDirection="column" marginBottom={1}>
					<Box gap={1}>
						<Text bold color="cyan">{agentName}</Text>
						<Text dimColor>{agentStatus}</Text>
					</Box>
					{streamingThinking !== "" && (
						<Box marginLeft={2}>
							<Text italic dimColor>{streamingThinking}</Text>
						</Box>
					)}
					{streamingText !== "" && (
						<Box marginLeft={2}>
							<Text>{streamingText}</Text>
						</Box>
					)}
				</Box>
			)}
		</Box>
	);
}
