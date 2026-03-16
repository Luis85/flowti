/**
 * use-status-hints.ts — Compute status bar hints based on focus zone.
 *
 * Returns the appropriate key hints for the currently active focus zone.
 * Pure function — no React state needed.
 */

import type { FocusZone } from "../types.js";

interface KeyHint {
	readonly key: string;
	readonly label: string;
}

const ACTIVITY_BAR_HINTS: readonly KeyHint[] = [
	{ key: "\u2191\u2193", label: "Navigate" },
	{ key: "Enter", label: "Open" },
	{ key: "Tab", label: "Content" },
	{ key: "q", label: "Quit" },
];

const CONTENT_HINTS: readonly KeyHint[] = [
	{ key: "\u2191\u2193", label: "Navigate" },
	{ key: "Enter", label: "Select" },
	{ key: "Tab", label: "Sidebar" },
	{ key: "Esc", label: "Back" },
	{ key: "q", label: "Quit" },
];

const HINT_MAP: Record<FocusZone, readonly KeyHint[]> = {
	"activity-bar": ACTIVITY_BAR_HINTS,
	"content": CONTENT_HINTS,
};

export function getHintsForZone(zone: FocusZone): readonly KeyHint[] {
	return HINT_MAP[zone];
}
