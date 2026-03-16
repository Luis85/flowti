/**
 * key-hints.tsx — Key legend row for the status bar.
 */

import React from "react";
import { Box, Text } from "ink";

interface KeyHintDef {
	readonly key: string;
	readonly label: string;
}

interface KeyHintsProps {
	readonly hints: readonly KeyHintDef[];
}

export function KeyHints({ hints }: KeyHintsProps): React.JSX.Element {
	return (
		<Box gap={2}>
			{hints.map((hint) => (
				<Text key={hint.key} dimColor>
					<Text bold>{hint.key}</Text> {hint.label}
				</Text>
			))}
		</Box>
	);
}
