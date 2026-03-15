/**
 * task-view.tsx — Task mode view showing brief, activity feed, and progress footer.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatToolCall, ChatViewStatus } from "../chat-renderer-types.js";

interface TaskViewProps {
	readonly brief: string;
	readonly tools: readonly ChatToolCall[];
	readonly status: ChatViewStatus;
	readonly elapsed: number;
}

function activityIcon(status: ChatToolCall["status"]): { char: string; color: string } {
	switch (status) {
		case "done":
			return { char: "✓", color: "green" };
		case "active":
			return { char: "⟳", color: "yellow" };
		case "error":
			return { char: "○", color: "red" };
	}
}

function formatDuration(ms?: number): string {
	if (ms === undefined) return "";
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatElapsed(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds === 0) return "0s";
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}m ${secs}s`;
}

export function TaskView({ brief, tools, status: _status, elapsed }: TaskViewProps): React.JSX.Element {
	const doneCount = tools.filter((t) => t.status === "done").length;
	const activeCount = tools.filter((t) => t.status === "active").length;
	const elapsedStr = formatElapsed(elapsed);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box flexDirection="column" marginBottom={1}>
				<Text color="magenta" dimColor>TASK BRIEF</Text>
				<Text>{brief}</Text>
			</Box>
			<Box flexDirection="column" flexGrow={1}>
				<Text color="magenta" dimColor>ACTIVITY FEED</Text>
				{tools.map((tool, i) => {
					const icon = activityIcon(tool.status);
					const target = tool.target !== undefined ? ` ${tool.target}` : "";
					const duration = formatDuration(tool.durationMs);

					return (
						<Box key={i} gap={1} marginLeft={1}>
							<Text color={icon.color as Parameters<typeof Text>[0]["color"]}>{icon.char}</Text>
							<Text>{tool.name}{target}</Text>
							{duration !== "" && <Text dimColor>{duration}</Text>}
						</Box>
					);
				})}
			</Box>
			<Box
				borderStyle="single"
				borderTop
				borderBottom={false}
				borderLeft={false}
				borderRight={false}
				gap={2}
			>
				<Text dimColor>{doneCount} done</Text>
				<Text dimColor>{activeCount} active</Text>
				<Text dimColor>{elapsedStr}</Text>
				<Box flexGrow={1} />
				<Text dimColor>Enter interrupt · Esc detach</Text>
			</Box>
		</Box>
	);
}
