/**
 * day-clock.ts — Compressed day cycle driving the Living World.
 *
 * Progresses through 7 phases (morning-arrival → evening-departure) over
 * a configurable duration (default 25 min). Provides phase multipliers
 * for NeedsSystem and time-of-day context for TalkEngine.
 */

import { DAY_PHASES, PHASE_MULTIPLIERS, type DayPhase, type NeedMultipliers } from "../data/day-phase-config.js";

// ── Persistence shape ────────────────────────────────────────────────

export interface DayClockState {
	readonly cycleCount: number;
	readonly elapsedMs: number;
	readonly lastUpdated: number;
}

// ── Time-of-day lookup ───────────────────────────────────────────────

const TIME_OF_DAY: Record<DayPhase, string> = {
	"morning-arrival": "morning",
	"productive-morning": "morning",
	"lunch": "midday",
	"afternoon": "afternoon",
	"afternoon-slump": "afternoon",
	"wind-down": "evening",
	"evening-departure": "evening",
};

// ── System ───────────────────────────────────────────────────────────

export class DayClock {
	private readonly durationMs: number;
	private elapsedMs = 0;
	private cycleCount = 0;
	private currentPhaseIndex = 0;
	private readonly callbacks: Array<(phase: DayPhase) => void> = [];

	constructor(durationMs = 1_500_000) {
		this.durationMs = durationMs;
	}

	// ── Public API ─────────────────────────────────────────────

	getPhase(): DayPhase {
		return DAY_PHASES[this.currentPhaseIndex].phase;
	}

	getProgress(): number {
		const start = this.phaseStartMs(this.currentPhaseIndex);
		const end = this.phaseEndMs(this.currentPhaseIndex);
		const duration = end - start;
		if (duration <= 0) return 0;
		return Math.min(1, (this.elapsedMs - start) / duration);
	}

	getCycleProgress(): number {
		return Math.min(1, this.elapsedMs / this.durationMs);
	}

	getTimeOfDay(): string {
		return TIME_OF_DAY[this.getPhase()];
	}

	getCycleCount(): number {
		return this.cycleCount;
	}

	getPhaseMultipliers(): NeedMultipliers {
		return PHASE_MULTIPLIERS(this.getPhase());
	}

	onPhaseChange(cb: (phase: DayPhase) => void): void {
		this.callbacks.push(cb);
	}

	offPhaseChange(cb: (phase: DayPhase) => void): void {
		const idx = this.callbacks.indexOf(cb);
		if (idx >= 0) this.callbacks.splice(idx, 1);
	}

	// ── Update ─────────────────────────────────────────────────

	update(deltaMs: number): void {
		this.elapsedMs += deltaMs;

		// Check for cycle completion
		if (this.elapsedMs >= this.durationMs) {
			this.cycleCount++;
			this.elapsedMs = this.elapsedMs % this.durationMs;
			if (this.currentPhaseIndex !== 0) {
				this.currentPhaseIndex = 0;
				this.emit(DAY_PHASES[0].phase);
			}
			return;
		}

		// Check for phase transition
		const newIndex = this.computePhaseIndex();
		if (newIndex !== this.currentPhaseIndex) {
			this.currentPhaseIndex = newIndex;
			this.emit(DAY_PHASES[newIndex].phase);
		}
	}

	// ── Persistence ────────────────────────────────────────────

	serialize(): DayClockState {
		return {
			cycleCount: this.cycleCount,
			elapsedMs: this.elapsedMs,
			lastUpdated: Date.now(),
		};
	}

	restore(state: DayClockState): void {
		const elapsed = Date.now() - state.lastUpdated;
		const totalElapsed = state.elapsedMs + elapsed;

		if (totalElapsed >= this.durationMs) {
			// Elapsed exceeds cycle — start fresh
			this.cycleCount = state.cycleCount + 1;
			this.elapsedMs = 0;
			this.currentPhaseIndex = 0;
		} else {
			// Snap forward to correct position
			this.cycleCount = state.cycleCount;
			this.elapsedMs = totalElapsed;
			this.currentPhaseIndex = this.computePhaseIndex();
		}
	}

	// ── Private ────────────────────────────────────────────────

	private computePhaseIndex(): number {
		const progress = this.elapsedMs / this.durationMs;
		let cumulative = 0;
		for (let i = 0; i < DAY_PHASES.length; i++) {
			cumulative += DAY_PHASES[i].percent;
			if (progress < cumulative) return i;
		}
		return DAY_PHASES.length - 1;
	}

	private phaseStartMs(index: number): number {
		let cumulative = 0;
		for (let i = 0; i < index; i++) {
			cumulative += DAY_PHASES[i].percent;
		}
		return cumulative * this.durationMs;
	}

	private phaseEndMs(index: number): number {
		return this.phaseStartMs(index) + DAY_PHASES[index].percent * this.durationMs;
	}

	private emit(phase: DayPhase): void {
		for (const cb of this.callbacks) cb(phase);
	}
}
