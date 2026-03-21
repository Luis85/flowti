/**
 * Constants, types, and utility functions for WorldContext.
 *
 * Extracted from world-context.ts to stay under max-lines.
 */

/* ── Supporting types ── */

export interface AgentRosterEntry {
	readonly name: string;
	readonly role: string;
	readonly status: "idle" | "busy";
	readonly task?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly skills?: readonly string[];
}

export interface ProjectInfo {
	readonly name: string;
	readonly domains: string[];
}

export interface IterationInfo {
	readonly name: string;
	readonly phase?: string;
	readonly done: number;
	readonly total: number;
}

export interface CanvasInfo {
	readonly name: string;
	readonly description?: string;
}

export interface ActivityEntry {
	readonly text: string;
	readonly timestamp: number;
}

/* ── Minimal world-state types (mirrors CLI WorldState shape) ── */

export interface WorldStateEntity {
	readonly id: string;
	readonly type: string;
	readonly components: Record<string, Record<string, unknown>>;
}

export interface WorldStateActivityEntry {
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: string;
	readonly summary: string;
}

export interface WorldStateFile {
	readonly entities?: Record<string, WorldStateEntity>;
	readonly activityLog?: readonly WorldStateActivityEntry[];
}

export interface AgentDashboardFile {
	readonly agents?: readonly {
		readonly name: string;
		readonly domain?: string;
		readonly status?: string;
	}[];
}

/* ── Constants ── */

export const MAX_CHANGE_LOG = 50;
export const MAX_CONTENT_SNIPPET = 500;
export const DEBOUNCE_MS = 500;
export const DELTA_FALLBACK_THRESHOLD = 10;

/* ── File type mapping ── */

const EXT_TYPE_MAP: Record<string, string> = {
	".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
	".md": "Markdown", ".json": "JSON", ".css": "CSS", ".canvas": "Canvas", ".html": "HTML",
	".scss": "SCSS", ".less": "LESS", ".yaml": "YAML", ".yml": "YAML", ".xml": "XML",
	".svg": "SVG", ".py": "Python", ".rs": "Rust", ".go": "Go", ".sh": "Shell",
	".bat": "Batch", ".ps1": "PowerShell",
};

export function fileTypeFromPath(path: string): string {
	const dot = path.lastIndexOf(".");
	if (dot === -1) return "Unknown";
	return EXT_TYPE_MAP[path.slice(dot).toLowerCase()] ?? "Unknown";
}

export function basename(path: string): string {
	const sep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	return sep === -1 ? path : path.slice(sep + 1);
}

export function relativeAge(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	return `${Math.floor(min / 60)}h ago`;
}

/** Scene descriptions — what each environment looks and feels like. */
export const SCENE_DESCRIPTIONS: Record<string, { name: string; vibe: string; who: string }> = {
	hub: {
		name: "The Hub",
		vibe: "A central gathering hall with a dark floor and subtle grid pattern. Doorways along the right edge lead to other rooms. The mood is open and communal — this is where everyone crosses paths.",
		who: "General-purpose agents and anyone passing through.",
	},
	office: {
		name: "The Office",
		vibe: "A focused workspace with individual workstations. Monitors glow softly. The atmosphere is heads-down and productive — code gets written here.",
		who: "Engineering, QA, and DevOps agents.",
	},
	village: {
		name: "The Village",
		vibe: "An informal, collaborative space with workbenches instead of desks. Relaxed and creative — ideas flow freely, whiteboards are everywhere.",
		who: "Design, UX, and Product agents.",
	},
	station: {
		name: "The Station",
		vibe: "A coordination center with dashboards and planning boards. Structured but dynamic — schedules are tracked, decisions are made.",
		who: "Management, Delivery, and Coordination agents.",
	},
};
