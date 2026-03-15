/**
 * activity-bar.tsx — Bottom status bar showing agent activity and token counts.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatViewStatus } from "../chat-renderer-types.js";

interface ActivityBarProps {
	readonly status: ChatViewStatus;
	readonly elapsed: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly currentTool?: string;
}

function formatElapsed(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds === 0) return "0s";
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}m ${secs}s`;
}

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

function statusLabel(status: ChatViewStatus, currentTool?: string): string {
	switch (status) {
		case "idle":
			return "Idle";
		case "thinking":
			return "Thinking…";
		case "working":
			return currentTool !== undefined ? `Using tool: ${currentTool}` : "Working…";
		case "waiting":
			return "Waiting for input";
		case "error":
			return "Error";
	}
}

export function ActivityBar({ status, elapsed, inputTokens, outputTokens, currentTool }: ActivityBarProps): React.JSX.Element {
	const label = statusLabel(status, currentTool);
	const elapsedStr = formatElapsed(elapsed);

	return (
		<Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
			<Box flexGrow={1} gap={2}>
				<Text dimColor>{label}</Text>
				<Text dimColor>{elapsedStr}</Text>
			</Box>
			<Box gap={1}>
				<Text dimColor>in: {formatTokens(inputTokens)}</Text>
				<Text dimColor>out: {formatTokens(outputTokens)}</Text>
			</Box>
		</Box>
	);
}
