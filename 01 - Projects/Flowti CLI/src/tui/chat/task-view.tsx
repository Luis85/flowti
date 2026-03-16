/**
 * task-view.tsx — Displays a list of tasks with status indicators.
 */

import React from "react";
import { Box, Text } from "ink";

export interface TaskItem {
	readonly id: string;
	readonly label: string;
	readonly status: "pending" | "running" | "done" | "failed";
}

interface TaskViewProps {
	readonly tasks: readonly TaskItem[];
}

const STATUS_INDICATORS: Record<string, { icon: string; color: string }> = {
	pending: { icon: "\u231B", color: "gray" },
	running: { icon: "\u25B6", color: "yellow" },
	done: { icon: "\u2713", color: "green" },
	failed: { icon: "\u2717", color: "red" },
};

export function TaskView({ tasks }: TaskViewProps): React.JSX.Element {
	if (tasks.length === 0) {
		return (
			<Box flexDirection="column" paddingX={1}>
				<Text dimColor>No tasks</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingX={1}>
			{tasks.map((task) => {
				const indicator = STATUS_INDICATORS[task.status] ?? STATUS_INDICATORS.pending;
				return (
					<Box key={task.id} gap={1}>
						<Text color={indicator.color}>{indicator.icon}</Text>
						<Text>{task.label}</Text>
					</Box>
				);
			})}
		</Box>
	);
}
