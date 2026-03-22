/**
 * Shared constants and helpers for game UI panel components.
 * Extracted to avoid duplication across panel-brain, panel-vitals, and agent-detail-modal.
 */

import type { BrainState } from "../brain/brain-types.js";
import type { AgentNeeds } from "../systems/needs-system.js";

export const STATE_COLORS: Partial<Record<BrainState, string>> = {
	idle: "#3b82f6",
	wandering: "#6b7280",
	working: "#22c55e",
	"walking-to": "#f59e0b",
	"on-break": "#a855f7",
	talking: "#06b6d4",
	waiting: "#f59e0b",
};

export const NEED_META: ReadonlyArray<{ label: string; key: keyof AgentNeeds; color: string }> = [
	{ label: "Energy",  key: "energy",  color: "#22c55e" },
	{ label: "Hunger",  key: "hunger",  color: "#f97316" },
	{ label: "Thirst",  key: "thirst",  color: "#06b6d4" },
	{ label: "Focus",   key: "focus",   color: "#a855f7" },
	{ label: "Social",  key: "social",  color: "#f59e0b" },
	{ label: "Morale",  key: "morale",  color: "#ec4899" },
];

export function relativeTime(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	return `${Math.floor(min / 60)}h`;
}
