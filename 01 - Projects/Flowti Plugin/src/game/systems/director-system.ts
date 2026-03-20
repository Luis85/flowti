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

// ── System ───────────────────────────────────────────────────────────

export class DirectorSystem {
	private idleMs = 0;
	private present = true;

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

	/** Record a user interaction (click, message, etc.) — resets idle timer. */
	recordInteraction(_type: string, _position?: { x: number; y: number }): void {
		this.idleMs = 0;
	}

	/** Track mouse movement — resets idle timer. */
	onMouseMove(_x: number, _y: number): void {
		this.idleMs = 0;
	}

	/** Track mouse leaving the game area. */
	onMouseLeave(): void {
		// Don't reset idle — user left the viewport
	}

	/** Set visibility state (e.g., IntersectionObserver). */
	setPresent(visible: boolean): void {
		this.present = visible;
		if (!visible) this.idleMs = 0;
	}
}
