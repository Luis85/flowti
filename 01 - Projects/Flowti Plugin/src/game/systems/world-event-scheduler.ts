/**
 * world-event-scheduler.ts — Phase-gated micro-event scheduler.
 *
 * Evaluates eligible events on phase changes, rolls probability dice,
 * queues guaranteed events in priority order, enforces 30s minimum gap.
 */

import { MICRO_EVENTS, type MicroEventDefinition } from "../data/micro-event-definitions.js";
import type { DayPhase } from "../data/day-phase-config.js";

const MIN_GAP_MS = 30_000;

interface QueuedEvent {
	definition: MicroEventDefinition;
}

export class WorldEventScheduler {
	private readonly handlers = new Map<string, () => void>();
	private readonly suppressedSensors = new Set<string>();
	private readonly firedThisCycle = new Set<string>();
	private queue: QueuedEvent[] = [];
	private activeEvent: MicroEventDefinition | null = null;
	private activeRemainingMs = 0;
	private gapRemainingMs = 0;

	registerHandler(eventType: string, handler: () => void): void {
		this.handlers.set(eventType, handler);
	}

	recordSensorEvent(sensorType: string): void {
		this.suppressedSensors.add(sensorType);
	}

	isEventActive(): boolean {
		return this.activeEvent !== null;
	}

	getActiveEventType(): string | null {
		return this.activeEvent?.type ?? null;
	}

	onPhaseChange(phase: DayPhase): void {
		// Find eligible events for this phase
		const eligible = MICRO_EVENTS.filter((e) => {
			if (!e.triggerPhases.includes(phase)) return false;
			if (e.suppressedBySensor && this.suppressedSensors.has(e.suppressedBySensor)) return false;
			if (this.firedThisCycle.has(e.type) && e.guaranteed) return false;
			return true;
		});

		// Separate guaranteed from probability-based
		const guaranteed = eligible.filter((e) => e.guaranteed).sort((a, b) => a.priority - b.priority);
		const probabilistic = eligible.filter((e) => !e.guaranteed);

		// Queue guaranteed events
		for (const e of guaranteed) {
			this.queue.push({ definition: e });
		}

		// Roll probability for others
		for (const e of probabilistic) {
			if (Math.random() < e.probability) {
				this.queue.push({ definition: e });
			}
		}
	}

	onCycleReset(): void {
		this.suppressedSensors.clear();
		this.firedThisCycle.clear();
		this.queue = [];
		this.activeEvent = null;
		this.activeRemainingMs = 0;
		this.gapRemainingMs = 0;
	}

	update(deltaMs: number): void {
		// Tick active event
		if (this.activeEvent) {
			this.activeRemainingMs -= deltaMs;
			if (this.activeRemainingMs <= 0) {
				this.activeEvent = null;
				this.gapRemainingMs = MIN_GAP_MS;
			}
			return;
		}

		// Tick gap
		if (this.gapRemainingMs > 0) {
			this.gapRemainingMs -= deltaMs;
			if (this.gapRemainingMs > 0) return;
		}

		// Fire next queued event
		if (this.queue.length > 0) {
			const next = this.queue.shift()!;
			this.activeEvent = next.definition;
			this.activeRemainingMs = next.definition.durationMs;
			this.firedThisCycle.add(next.definition.type);
			const handler = this.handlers.get(next.definition.type);
			if (handler) handler();
		}
	}
}
