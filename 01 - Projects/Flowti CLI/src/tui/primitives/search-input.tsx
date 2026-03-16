/**
 * search-input.tsx — Inline filter input activated by '/'.
 */

import React from "react";
import { Box, Text } from "ink";

interface SearchInputProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly active: boolean;
}

export function SearchInput({ value, onChange, placeholder, active }: SearchInputProps): React.JSX.Element {
	if (!active) return React.createElement(React.Fragment);
	return (
		<Box paddingX={1}>
			<Text dimColor>/ </Text>
			<Text>{value || placeholder || "Type to filter..."}</Text>
			<Text dimColor>{"\u2588"}</Text>
		</Box>
	);
}
