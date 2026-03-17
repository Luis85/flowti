/**
 * effect-strip.tsx — Single-line status strip for running effects.
 *
 * Renders between the content zone and ActionBar, showing the current
 * effect state: spinner when running, checkmark on success, cross on error.
 */

import React from "react";
import { Box, Text } from "ink";

interface EffectStripProps {
	readonly state: "idle" | "running" | "success" | "error";
	readonly message: string;
}

export function EffectStrip({ state, message }: EffectStripProps): React.JSX.Element {
	if (state === "idle") return React.createElement(React.Fragment);

	const color = state === "error" ? "red" : state === "success" ? "green" : "cyan";
	const prefix = state === "running" ? "\u280B" : state === "success" ? "\u2713" : "\u2717";

	return React.createElement(Box, { paddingX: 1 },
		React.createElement(Text, { color }, `${prefix} ${message}`),
	);
}
