/**
 * Shared constants and helpers for game UI panel components.
 * Extracted to avoid duplication across panel-brain, panel-vitals, and agent-detail-modal.
 */

import type { AgentBlackboard } from "../systems/blackboard.js";
import type { AgentNeeds } from "../systems/needs-system.js";
import type { DashboardAgent } from "../data/types.js";

export const STATE_COLORS: Partial<Record<AgentBlackboard["intent"], string>> = {
	idle: "#3b82f6",
	seeking: "#6b7280",
	working: "#22c55e",
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

export const TRUST_TIER_COLORS: Record<string, string> = {
	supervised: "#f59e0b",
	trusted: "#22c55e",
	autonomous: "#8b5cf6",
};

export const STATUS_DOT_COLORS: Record<string, string> = {
	busy: "#22c55e",
	idle: "#3b82f6",
	unassigned: "#6b7280",
};

export const COUNCIL_SLOT_COUNT = 5;

export function getCouncilSlots(
	councilNames: readonly string[],
	agents: readonly DashboardAgent[],
): (DashboardAgent | null)[] {
	const slots: (DashboardAgent | null)[] = [];
	for (let i = 0; i < COUNCIL_SLOT_COUNT; i++) {
		const name = councilNames[i];
		slots.push(name ? (agents.find(a => a.name === name) ?? null) : null);
	}
	return slots;
}

export function relativeTime(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	return `${Math.floor(min / 60)}h`;
}
