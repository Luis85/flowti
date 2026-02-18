/**
 * Types for the Nudge domain.
 *
 * Nudges are time-based prompts that remind the user to start
 * a session at a configured time of day. Each nudge has a target
 * session type and duration, and can be enabled or disabled.
 */

import type { SessionType } from "../session/types";

// ─────────────────────────────────────────────────────────────
// Entity
// ─────────────────────────────────────────────────────────────

/** Unique identifier for a nudge configuration. */
export type NudgeId = string;

/** A configured time-based session start prompt. */
export interface NudgeConfig {
	id: NudgeId;
	/** Time of day in HH:MM format (24-hour, local time). */
	time: string;
	/** Session type to create when the user accepts the nudge. */
	sessionType: SessionType;
	/** Human-readable title shown in the notification. */
	title: string;
	/** Session duration in minutes (0 = no timer). */
	durationMinutes: number;
	/** Whether this nudge is active. */
	enabled: boolean;
}

// ─────────────────────────────────────────────────────────────
// Persisted state
// ─────────────────────────────────────────────────────────────

/** Shape of the nudge state persisted via TypedStorage. */
export interface NudgeState {
	configs: NudgeConfig[];
	/** IDs of nudges dismissed today (cleared on midnight rollover). */
	dismissedToday: string[];
	/** ISO date string (YYYY-MM-DD) of the last rollover check. */
	lastRolloverDate: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Interval in milliseconds between nudge evaluations. */
export const NUDGE_EVAL_INTERVAL_MS = 60_000;

/** Default nudge configurations created on first load (disabled by default). */
export const DEFAULT_NUDGE_CONFIGS: NudgeConfig[] = [
	{
		id: "default-morning-review",
		time: "09:00",
		sessionType: "daily-tracking",
		title: "Morning Review",
		durationMinutes: 0,
		enabled: false,
	},
	{
		id: "default-afternoon-focus",
		time: "14:00",
		sessionType: "documentation",
		title: "Afternoon Focus",
		durationMinutes: 50,
		enabled: false,
	},
];
