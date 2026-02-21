/**
 * Event subscriptions for TrainMainView.
 *
 * Extracted to keep the view class focused on rendering.
 * Follows the same pattern as SessionWorkspaceSubscriptions.ts.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainViewContext } from "./TrainMainView";

/**
 * Sets up event subscriptions for the Train Main View.
 * Returns an array of unsubscribe functions for cleanup.
 */
export function setupTrainViewSubscriptions(
	ctx: TrainViewContext,
	eventBus: IEventBus,
): (() => void)[] {
	const unsubs: (() => void)[] = [];

	// New train started — switch to it
	unsubs.push(
		eventBus.on("train.started", (event) => {
			const trainId = ctx.getTrainId();
			if (!trainId || trainId === event.payload.train.id) {
				ctx.setActiveThoughtIndex(0);
				ctx.scheduleRender();
			}
		}),
	);

	// Thought added — re-render to show new thought
	unsubs.push(
		eventBus.on("train.thought.added", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Train paused — update status badge
	unsubs.push(
		eventBus.on("train.paused", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Train resumed — update status badge
	unsubs.push(
		eventBus.on("train.resumed", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Train completed — update status badge, hide resume button
	unsubs.push(
		eventBus.on("train.completed", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Thought activated — navigate to the activated thought
	unsubs.push(
		eventBus.on("train.thought.activated", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				// The view itself emits this event, so we only re-render
				// if triggered externally (e.g. from timeline sidebar)
				ctx.scheduleRender();
			}
		}),
	);

	return unsubs;
}
