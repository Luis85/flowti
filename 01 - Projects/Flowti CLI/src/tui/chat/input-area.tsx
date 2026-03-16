/**
 * input-area.tsx — Simple text input display for chat messages.
 *
 * Renders the current value or placeholder in a bordered box with a submit hint.
 * Actual keyboard handling is done at a higher level.
 */

import React from "react";
import { Box, Text } from "ink";

interface InputAreaProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onSubmit: () => void;
	readonly enabled: boolean;
	readonly placeholder?: string;
}

export function InputArea({ value, enabled, placeholder }: InputAreaProps): React.JSX.Element {
	const displayText = value.length > 0 ? value : placeholder ?? "";
	const isDimmed = value.length === 0;
	return (
		<Box
			borderStyle="single"
			borderTop
			borderBottom={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			flexDirection="column"
		>
			<Box>
				<Text dimColor={isDimmed || !enabled}>{displayText}</Text>
			</Box>
			<Box justifyContent="flex-end">
				<Text dimColor>Enter to send</Text>
			</Box>
		</Box>
	);
}
