/**
 * director-system.ts — Tracks the "Director" (user/cursor) presence and idle time.
 *
 * The Director is the invisible observer. When the user stops interacting,
 * idleMs grows, enabling the EngagementSystem to escalate outreach.
 * Any user interaction (click, key, message) resets idle time.
 */

// ── Public types ──────────────────────────────────────────────────────

export interface DirectorPresence {
	/** Milliseconds since last user interaction. */
	readonly idleMs: number;
	/** Whether the director is currently "present" (tab visible). */
	readonly present: boolean;
}

export interface DirectorSignal {
	readonly type: string;
	readonly moraleEffect?: number;
	readonly position?: { x: number; y: number };
}

// ── Signal effects map ──────────────────────────────────────────────

const SIGNAL_EFFECTS: Record<string, { moraleEffect?: number }> = {
	click: {},
	message: { moraleEffect: 2 },
	"permission-grant": { moraleEffect: 5 },
	"permission-deny": { moraleEffect: -3 },
	"task-praise": { moraleEffect: 10 },
};

// ── System ───────────────────────────────────────────────────────────

export class DirectorSystem {
	private idleMs = 0;
	private present = true;
	private cursorX: number | null = null;
	private cursorY: number | null = null;

	/** Get current director presence state. */
	getPresence(): DirectorPresence {
		return { idleMs: this.idleMs, present: this.present };
	}

	/** Tick idle timer forward. */
	update(deltaMs: number): void {
		if (this.present) {
			this.idleMs += deltaMs;
		}
	}

	/** Reset idle timer — called on any user interaction. */
	resetIdle(): void {
		this.idleMs = 0;
	}

	/** Record a user interaction (click, message, etc.) — resets idle timer, returns signal. */
	recordInteraction(type: string, position?: { x: number; y: number }): DirectorSignal {
		this.idleMs = 0;
		const effects = SIGNAL_EFFECTS[type] ?? {};
		return {
			type,
			...effects,
			...(position ? { position } : {}),
		};
	}

	/** Track mouse movement — stores cursor position and resets idle timer. */
	onMouseMove(x: number, y: number): void {
		this.cursorX = x;
		this.cursorY = y;
		this.idleMs = 0;
	}

	/** Track mouse leaving the game area — clears cursor position. */
	onMouseLeave(): void {
		this.cursorX = null;
		this.cursorY = null;
	}

	/** Get current cursor world position, or null if unknown. */
	getCursorPosition(): { x: number; y: number } | null {
		if (this.cursorX === null || this.cursorY === null) return null;
		return { x: this.cursorX, y: this.cursorY };
	}

	/** Calculate Euclidean distance from cursor to a point. Returns Infinity if cursor unknown. */
	distanceTo(x: number, y: number): number {
		if (this.cursorX === null || this.cursorY === null) return Infinity;
		const dx = this.cursorX - x;
		const dy = this.cursorY - y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	/** Set visibility state (e.g., IntersectionObserver). */
	setPresent(visible: boolean): void {
		this.present = visible;
		if (!visible) this.idleMs = 0;
	}
}
