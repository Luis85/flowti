/**
 * Handler for the Train Timeline sidebar leaf.
 *
 * Bridges TrainService data to the flowti-train-timeline Lit component
 * and wires component CustomEvents to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import type { TrainService } from "../../../domain/train/TrainService";
import type { IEventBus } from "../../events/types";
import type { FlowtiEventMap } from "../../events/events";
import { computeGraphLayout } from "../../../domain/train/graph-layout";
import { setProps } from "../handler-utils";

// Side-effect import: register Lit custom element
import "../../../components/train/flowti-train-timeline.js";

export interface TrainTimelineHandlerDeps {
	trainService: TrainService;
	eventBus: IEventBus;
	app: { vault: { getAbstractFileByPath: (path: string) => unknown | null } };
	getTrainSettings: () => { trainFolder: string; trainCanvasEnabled: boolean; trainCanvasAutoOpen: boolean };
}

export function registerTrainTimelineHandler(
	registry: PluginHandlerRegistry,
	deps: TrainTimelineHandlerDeps,
): void {
	registry.registerTabHandler("leaf:train-timeline", (container: HTMLElement, _ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-timeline");

		// Get train data
		const activeTrain = deps.trainService.getActiveTrain();
		if (!activeTrain) {
			setProps(el, { train: null });
			container.appendChild(el);
			return;
		}

		const timeline = deps.trainService.getTimeline(activeTrain.id);
		const graphRows = computeGraphLayout(
			timeline, activeTrain,
			(tid, nid) => deps.trainService.getBranches(tid, nid),
			new Set(),
		);

		// Compute branch counts
		const branchCounts = new Map<string, number>();
		for (const thought of activeTrain.thoughts) {
			branchCounts.set(thought.id, deps.trainService.getBranches(activeTrain.id, thought.id).length);
		}

		// Check canvas
		const settings = deps.getTrainSettings();
		const canvasPath = settings.trainCanvasEnabled && activeTrain.folderPath
			? `${activeTrain.folderPath}/${activeTrain.title}.canvas`
			: null;

		setProps(el, {
			train: activeTrain,
			timeline,
			graphRows,
			activeThoughtId: null,
			branchCounts,
			canvasPath,
			canvasExists: canvasPath ? !!deps.app.vault.getAbstractFileByPath(canvasPath) : false,
		});

		// Wire events
		el.addEventListener("thought-activated", ((e: CustomEvent) => {
			const detail = e.detail as FlowtiEventMap["train.thought.activated"];
			void deps.eventBus.emit("train.thought.activated", detail);
			void deps.eventBus.emit("ui.openTrainView", { trainId: detail.trainId });
		}) as EventListener);

		el.addEventListener("open-train-view", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.openTrainView", e.detail as FlowtiEventMap["ui.openTrainView"]);
		}) as EventListener);

		el.addEventListener("open-canvas", (() => {
			// Canvas opening handled by host — no-op in handler
		}) as EventListener);

		el.addEventListener("cycle-branch-status", ((e: CustomEvent) => {
			const { trainId, thoughtId, currentStatus } = e.detail as {
				trainId: string;
				thoughtId: string;
				currentStatus: string | null;
			};
			const cycle = [null, "exploring", "promising", "stale"];
			const idx = cycle.indexOf(currentStatus);
			const next = cycle[(idx + 1) % cycle.length];
			if (next === null) {
				void deps.trainService.clearBranchStatus(trainId, thoughtId);
			} else {
				void deps.trainService.setBranchStatus(trainId, thoughtId, next as "exploring" | "promising" | "stale");
			}
		}) as EventListener);

		container.appendChild(el);
	});
}
