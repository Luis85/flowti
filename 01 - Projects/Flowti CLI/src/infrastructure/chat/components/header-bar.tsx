/**
 * header-bar.tsx — Top bar showing agent identity, status, and navigation hint.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatViewStatus } from "../chat-renderer-types.js";

interface HeaderBarProps {
	readonly agentName: string;
	readonly persona?: string;
	readonly status: ChatViewStatus;
	readonly topicName?: string;
}

function statusDot(status: ChatViewStatus): { char: string; color: string } {
	switch (status) {
		case "idle":
			return { char: "●", color: "green" };
		case "thinking":
			return { char: "●", color: "yellow" };
		case "working":
			return { char: "●", color: "yellow" };
		case "waiting":
			return { char: "●", color: "cyan" };
		case "error":
			return { char: "●", color: "red" };
	}
}

export function HeaderBar({ agentName, persona, status, topicName }: HeaderBarProps): React.JSX.Element {
	const dot = statusDot(status);

	return (
		<Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false}>
			<Box flexGrow={1} gap={1}>
				<Text bold color="cyan">{agentName}</Text>
				{persona !== undefined && <Text dimColor>{persona}</Text>}
				<Text color={dot.color as Parameters<typeof Text>[0]["color"]}>{dot.char}</Text>
			</Box>
			<Box gap={2}>
				{topicName !== undefined && <Text color="magenta">{topicName}</Text>}
				<Text dimColor>Esc exit | / commands</Text>
			</Box>
		</Box>
	);
}
