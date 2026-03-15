/**
 * input-area.tsx — User input area with command parsing and Esc handling.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import type { ChatCommand } from "../chat-renderer-types.js";
import { parseCommand } from "../command-parser.js";

interface InputAreaProps {
	readonly disabled: boolean;
	readonly onSubmit: (text: string) => void;
	readonly onCommand: (cmd: ChatCommand) => void;
}

export function InputArea({ disabled, onSubmit, onCommand }: InputAreaProps): React.JSX.Element {
	// Key increments to remount TextInput (reset its internal state) after submit.
	const [inputKey, setInputKey] = useState(0);

	useInput((_input, key) => {
		if (key.escape) {
			onCommand({ type: "done" });
		}
	});

	function handleSubmit(text: string): void {
		const trimmed = text.trim();
		if (trimmed === "") return;

		// Remount TextInput to clear it.
		setInputKey((k) => k + 1);

		const cmd = parseCommand(trimmed);
		if (cmd !== null) {
			onCommand(cmd);
		} else {
			onSubmit(trimmed);
		}
	}

	if (disabled) {
		return (
			<Box>
				<Text color="cyan">{"❯ "}</Text>
				<Text dimColor>Agent is working...</Text>
			</Box>
		);
	}

	return (
		<Box>
			<Text color="cyan">{"❯ "}</Text>
			<TextInput key={inputKey} onSubmit={handleSubmit} />
		</Box>
	);
}
