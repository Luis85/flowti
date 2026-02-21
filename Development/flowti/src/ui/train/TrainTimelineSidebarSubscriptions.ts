/**
 * Event subscriptions for TrainTimelineSidebar.
 *
 * Extracted to keep the view class focused on rendering.
 * Follows the same pattern as TrainMainViewSubscriptions.ts.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainTimelineContext } from "./TrainTimelineSidebar";

/**
 * Sets up event subscriptions for the Train Timeline Sidebar.
 * Returns an array of unsubscribe functions for cleanup.
 */
export function setupTrainTimelineSubscriptions(
	ctx: TrainTimelineContext,
	eventBus: IEventBus,
): (() => void)[] {
	const unsubs: (() => void)[] = [];

	// New train started — switch to it
	unsubs.push(
		eventBus.on("train.started", (event) => {
			ctx.setTrainId(event.payload.train.id);
			ctx.setActiveThoughtId(null);
			ctx.scheduleRender();
		}),
	);

	// Thought added — activate the new thought and re-render
	unsubs.push(
		eventBus.on("train.thought.added", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.setActiveThoughtId(event.payload.thought.id);
				ctx.scheduleRender();
			}
		}),
	);

	// Train paused — update status display
	unsubs.push(
		eventBus.on("train.paused", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Train resumed — update status display
	unsubs.push(
		eventBus.on("train.resumed", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Train completed — update status display
	unsubs.push(
		eventBus.on("train.completed", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Thought activated — highlight the active node (from Main View or other sources)
	unsubs.push(
		eventBus.on("train.thought.activated", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.setActiveThoughtId(event.payload.thoughtId);
				ctx.scheduleRender();
			}
		}),
	);

	return unsubs;
}
