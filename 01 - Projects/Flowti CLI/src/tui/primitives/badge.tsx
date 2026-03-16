/**
 * badge.tsx — Colored inline label for status, type, domain indicators.
 */

import React from "react";
import { Text } from "ink";

interface BadgeProps {
	readonly text: string;
	readonly color?: string;
}

export function Badge({ text, color }: BadgeProps): React.JSX.Element {
	return <Text color={color ?? "gray"}>[{text}]</Text>;
}
