/**
 * tool-panel.tsx — Collapsible panel showing tool calls for a message.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatToolCall } from "../chat-renderer-types.js";

interface ToolPanelProps {
	readonly tools: readonly ChatToolCall[];
	readonly expanded: boolean;
}

function statusIcon(status: ChatToolCall["status"]): { char: string; color: string } {
	switch (status) {
		case "done":
			return { char: "✓", color: "green" };
		case "error":
			return { char: "✗", color: "red" };
		case "active":
			return { char: "⟳", color: "yellow" };
	}
}

function formatDuration(ms?: number): string {
	if (ms === undefined) return "";
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return text.slice(0, max - 1) + "…";
}

export function ToolPanel({ tools, expanded }: ToolPanelProps): React.JSX.Element {
	const count = tools.length;

	if (!expanded) {
		const summary = tools
			.slice(0, 3)
			.map((t) => [t.name, t.target].filter(Boolean).join(" "))
			.join(" · ");

		return (
			<Box marginLeft={2}>
				<Text dimColor>{"▶ "}{count} tool call{count !== 1 ? "s" : ""}{" — "}{summary}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" marginLeft={2}>
			<Text dimColor>{"▼ "}{count} tool call{count !== 1 ? "s" : ""}</Text>
			{tools.map((tool, i) => {
				const icon = statusIcon(tool.status);
				const duration = formatDuration(tool.durationMs);
				const target = tool.target !== undefined ? ` ${tool.target}` : "";

				return (
					<Box key={i} flexDirection="column" marginLeft={2}>
						<Box gap={1}>
							<Text color={icon.color as Parameters<typeof Text>[0]["color"]}>{icon.char}</Text>
							<Text>{tool.name}{target}</Text>
							{duration !== "" && <Text dimColor>{duration}</Text>}
						</Box>
						{tool.input !== undefined && (
							<Box marginLeft={2}>
								<Text dimColor>in: {truncate(tool.input, 60)}</Text>
							</Box>
						)}
						{tool.output !== undefined && (
							<Box marginLeft={2}>
								<Text dimColor>out: {truncate(tool.output, 60)}</Text>
							</Box>
						)}
					</Box>
				);
			})}
		</Box>
	);
}
