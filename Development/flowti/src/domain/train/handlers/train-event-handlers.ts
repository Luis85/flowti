/**
 * Extracted session lifecycle event handlers for TrainService.
 *
 * Follows the same handler extraction pattern used by SessionService.
 * Keeps TrainService constructor lean by externalizing event subscriptions.
 */

import type { IEventBus } from "../../../infrastructure/events/types";
import type { TrainState } from "../types";

export interface TrainHandlerContext {
	trains: () => TrainState[];
	findBySessionId: (sessionId: string) => TrainState | undefined;
	persist: () => Promise<void>;
	writeSummary: (train: TrainState) => Promise<void>;
	eventBus: IEventBus;
}

/**
 * Wire session lifecycle events to train state transitions.
 *
 * - `session.completed` → auto-complete the linked train
 * - `session.resumed`   → auto-resume the linked train
 * - `session.paused`    → auto-pause the linked train
 */
export function registerTrainEventHandlers(ctx: TrainHandlerContext): void {
	ctx.eventBus.on("session.completed", (event) => {
		const session = event.payload.session;
		const train = ctx.findBySessionId(session.id);
		if (!train || train.status === "completed") return;

		train.status = "completed";
		train.completedAt = new Date().toISOString();
		void ctx.persist();
		void ctx.eventBus.emit("train.completed", {
			trainId: train.id,
			thoughtCount: train.thoughts.length,
		});
		void ctx.writeSummary(train);
	});

	ctx.eventBus.on("session.resumed", (event) => {
		const session = event.payload.session;
		const train = ctx.findBySessionId(session.id);
		if (!train || train.status !== "paused") return;

		train.status = "running";
		train.pausedAt = null;
		void ctx.persist();
		void ctx.eventBus.emit("train.resumed", { trainId: train.id });
	});

	ctx.eventBus.on("session.paused", (event) => {
		const session = event.payload.session;
		const train = ctx.findBySessionId(session.id);
		if (!train || train.status !== "running") return;

		train.status = "paused";
		train.pausedAt = new Date().toISOString();
		void ctx.persist();
		void ctx.eventBus.emit("train.paused", { trainId: train.id });
	});
}
