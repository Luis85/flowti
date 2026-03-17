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

	// New train started — switch to it and track the trainId
	unsubs.push(
		eventBus.on("train.started", (event) => {
			const trainId = ctx.getTrainId();
			if (!trainId || trainId === event.payload.train.id) {
				ctx.setTrainId(event.payload.train.id);
				ctx.setActiveThoughtId(null);
				ctx.scheduleRender();
			}
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

	// Thought activated — navigate to the activated thought (e.g. from timeline sidebar)
	unsubs.push(
		eventBus.on("train.thought.activated", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.setActiveThoughtId(event.payload.thoughtId);
				ctx.scheduleRender();
			}
		}),
	);

	// Branch merged — re-render to show merge state
	unsubs.push(
		eventBus.on("train.branch.merged", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Merge undone — re-render to remove merge state
	unsubs.push(
		eventBus.on("train.branch.merge.undone", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Thought renamed — re-render to show updated title
	unsubs.push(
		eventBus.on("train.thought.renamed", (event) => {
			if (event.payload.trainId === ctx.getTrainId()) {
				ctx.scheduleRender();
			}
		}),
	);

	// Session closure started — re-render to show closure overlay
	unsubs.push(
		eventBus.on("session.closure.started", (event) => {
			const sessionId = ctx.getSessionId();
			if (sessionId && event.payload.sessionId === sessionId) {
				ctx.scheduleRender();
			}
		}),
	);

	// Session completed — re-render to hide closure overlay
	unsubs.push(
		eventBus.on("session.completed", (event) => {
			const sessionId = ctx.getSessionId();
			if (sessionId && event.payload.session.id === sessionId) {
				ctx.scheduleRender();
			}
		}),
	);

	return unsubs;
}
