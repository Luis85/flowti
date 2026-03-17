export type SpeedPreset = 1 | 1800 | 3600 | 36000;
export type DayPhase = "night" | "morning" | "work" | "session" | "wrapup";

export const PHASE_ORDER: DayPhase[] = [
	"night",
	"morning",
	"work",
	"session",
	"wrapup",
];
export type PhaseMarker = {
	minute: number,
	label: string,
	phase: DayPhase
}
export const PHASE_MARKERS: PhaseMarker[] = [
	{ minute: 360, label: "06:00", phase: "morning" },
	{ minute: 540, label: "09:00", phase: "work" },
	{ minute: 1020, label: "17:00", phase: "session" },
	{ minute: 1200, label: "20:00", phase: "wrapup" },
];

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export interface InboxStats {
	total: number;
	unread: number;
	read: number;
	spam: number;
	byType: Record<string, number>;
	byPriority: Record<string, number>;
}

export interface OrderStats {
	total: number;
	new: number;
	active: number;
	shipped: number;
	closed: number;
	cancelled: number;
	byStatus: Record<string, number>;
	byCustomer: Record<string, number>;
	totalValue: number;
}
