/**
 * memory-system.ts — Cross-session agent memory persistence.
 *
 * Tracks per-agent streaks, visit counts, preferred spots/objects,
 * recent events, mood history, and milestone achievements.
 * Serializes to and restores from .flowti/var/ data files.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface MemoryEvent {
	readonly cycle: number;
	readonly type: string;
	readonly with?: string;
	readonly summary: string;
}

export interface CycleEndData {
	readonly completedTask: boolean;
	readonly conversations: number;
	readonly dominantMood: string;
}

export interface AgentMemory {
	preferredSpot: { x: number; y: number; scene: string } | null;
	preferredObject: string | null;
	visitCounts: Record<string, number>;
	workStreak: number;
	socialStreak: number;
	daysActive: number;
	longestWorkStreak: number;
	milestones: string[];
	recentEvents: MemoryEvent[];
	moodLog: Array<{ cycle: number; dominant: string }>;
	opinions: Array<{ topic: string; side: "A" | "B" }>;
	quirks: string[];
}

// ── Defaults ─────────────────────────────────────────────────────────

function createDefaultMemory(): AgentMemory {
	return {
		preferredSpot: null,
		preferredObject: null,
		visitCounts: {},
		workStreak: 0,
		socialStreak: 0,
		daysActive: 0,
		longestWorkStreak: 0,
		milestones: ["first-day"],
		recentEvents: [],
		moodLog: [],
		opinions: [],
		quirks: [],
	};
}

const MAX_RECENT_EVENTS = 20;
const MAX_MOOD_LOG = 10;

// ── System ───────────────────────────────────────────────────────────

export class MemorySystem {
	private readonly agents = new Map<string, AgentMemory>();
	private readonly milestoneCallbacks: Array<(agentName: string, milestoneId: string) => void> = [];

	register(name: string): void {
		if (!this.agents.has(name)) {
			this.agents.set(name, createDefaultMemory());
		}
	}

	getMemory(name: string): AgentMemory {
		return this.agents.get(name) ?? createDefaultMemory();
	}

	onMilestone(cb: (agentName: string, milestoneId: string) => void): void {
		this.milestoneCallbacks.push(cb);
	}

	// ── Events ─────────────────────────────────────────────────

	recordEvent(name: string, event: MemoryEvent): void {
		const mem = this.agents.get(name);
		if (!mem) return;
		mem.recentEvents.push(event);
		if (mem.recentEvents.length > MAX_RECENT_EVENTS) {
			mem.recentEvents.splice(0, mem.recentEvents.length - MAX_RECENT_EVENTS);
		}
	}

	// ── Visit tracking ─────────────────────────────────────────

	recordVisit(name: string, objectId: string): void {
		const mem = this.agents.get(name);
		if (!mem) return;
		mem.visitCounts[objectId] = (mem.visitCounts[objectId] ?? 0) + 1;

		// Update preferred object
		let maxVisits = 0;
		let preferred: string | null = null;
		for (const [id, count] of Object.entries(mem.visitCounts)) {
			if (count > maxVisits) {
				maxVisits = count;
				preferred = id;
			}
		}
		mem.preferredObject = preferred;
	}

	// ── Preferred spot ─────────────────────────────────────────

	recordPosition(name: string, x: number, y: number, scene: string): void {
		const mem = this.agents.get(name);
		if (!mem) return;
		// Simple heuristic: if agent returns to similar position 3+ times, it becomes preferred
		if (mem.preferredSpot && Math.abs(mem.preferredSpot.x - x) < 30 && Math.abs(mem.preferredSpot.y - y) < 30) {
			return; // already near preferred spot
		}
		// For now, just set the latest idle position — refined in later phases
		mem.preferredSpot = { x, y, scene };
	}

	// ── Cycle end ──────────────────────────────────────────────

	onCycleEnd(name: string, data: CycleEndData): void {
		const mem = this.agents.get(name);
		if (!mem) return;

		mem.daysActive++;

		// Work streak
		if (data.completedTask) {
			mem.workStreak++;
			if (mem.workStreak > mem.longestWorkStreak) {
				mem.longestWorkStreak = mem.workStreak;
			}
		} else {
			mem.workStreak = 0;
		}

		// Social streak
		if (data.conversations >= 3) {
			mem.socialStreak++;
		} else {
			mem.socialStreak = 0;
		}

		// Mood log
		mem.moodLog.push({ cycle: mem.daysActive, dominant: data.dominantMood });
		if (mem.moodLog.length > MAX_MOOD_LOG) {
			mem.moodLog.splice(0, mem.moodLog.length - MAX_MOOD_LOG);
		}

		// Milestone checks
		this.checkMilestones(name, mem);
	}

	// ── Persistence ────────────────────────────────────────────

	serialize(): Record<string, AgentMemory> {
		const result: Record<string, AgentMemory> = {};
		for (const [name, mem] of this.agents) {
			result[name] = { ...mem };
		}
		return result;
	}

	restore(data: Record<string, AgentMemory>): void {
		for (const [name, mem] of Object.entries(data)) {
			// Merge with defaults for forward-compatibility
			this.agents.set(name, { ...createDefaultMemory(), ...mem });
		}
	}

	// ── Private ────────────────────────────────────────────────

	private checkMilestones(name: string, mem: AgentMemory): void {
		const award = (id: string): void => {
			if (!mem.milestones.includes(id)) {
				mem.milestones.push(id);
				for (const cb of this.milestoneCallbacks) cb(name, id);
			}
		};

		if (mem.workStreak >= 5) award("work-streak-5");
		if (mem.workStreak >= 10) award("work-streak-10");
		if (mem.daysActive >= 25) award("early-adopter");
		if (mem.daysActive >= 100) award("veteran");
		if ((mem.visitCounts["coffee-machine"] ?? 0) >= 20) award("coffee-regular");
	}
}
