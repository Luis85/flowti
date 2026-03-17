/**
 * Handler registration for TrainHub tabs.
 *
 * Bridges TrainService → Lit components.
 * Each handler creates a Lit element, sets properties from service data,
 * and wires CustomEvent listeners to service/eventBus calls.
 */

import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import type { FlowtiEventMap } from "../events/events";
import { setProps } from "./handler-utils";

export interface TrainHandlerDeps {
	trainService: {
		getAllTrains: () => readonly unknown[];
		getActiveTrain: () => unknown | undefined;
	};
	onboardingService: {
		shouldShowCallout: (id: string) => boolean;
	};
	eventBus: IEventBus;
	openTrainView: (trainId: string) => void;
}

export function registerTrainHandlers(
	registry: PluginHandlerRegistry,
	deps: TrainHandlerDeps,
): void {
	// ── Dashboard handler ─────────────────────────────────

	registry.registerTabHandler("train:dashboard", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-dashboard");
		const trains = deps.trainService.getAllTrains();
		const activeTrain = deps.trainService.getActiveTrain();

		// Determine paused train: if activeTrain is paused, set it as pausedTrain
		const pausedTrain = (activeTrain as { status?: string } | undefined)?.status === "paused"
			? activeTrain
			: null;
		const runningTrain = (activeTrain as { status?: string } | undefined)?.status === "running"
			? activeTrain
			: null;

		setProps(el, {
			trains,
			activeTrain: runningTrain,
			pausedTrain,
		});
		el.addEventListener("start-train", () => {
			void deps.eventBus.emit("ui.startTrain", {});
		});
		container.appendChild(el);
	});

	// ── Active trains handler ─────────────────────────────

	registry.registerTabHandler("train:active", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-active");
		const allTrains = deps.trainService.getAllTrains() as { status: string }[];
		const activeTrains = allTrains.filter((t) => t.status === "running" || t.status === "paused");
		setProps(el, { trains: activeTrains });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("open-train", ((e: CustomEvent) => {
			deps.openTrainView((e.detail as { trainId: string }).trainId);
		}) as EventListener);
		el.addEventListener("resume-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.resumeTrain", e.detail as FlowtiEventMap["ui.resumeTrain"]);
		}) as EventListener);
		el.addEventListener("pause-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.pauseTrain", e.detail as FlowtiEventMap["ui.pauseTrain"]);
		}) as EventListener);
		el.addEventListener("delete-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteTrain", e.detail as FlowtiEventMap["ui.deleteTrain"]);
		}) as EventListener);
		container.appendChild(el);
	});

	// ── History handler ───────────────────────────────────

	registry.registerTabHandler("train:history", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-history");
		const allTrains = deps.trainService.getAllTrains() as { status: string }[];
		const completedTrains = allTrains.filter((t) => t.status === "completed");
		setProps(el, { trains: completedTrains });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("open-train", ((e: CustomEvent) => {
			deps.openTrainView((e.detail as { trainId: string }).trainId);
		}) as EventListener);
		el.addEventListener("delete-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteTrain", e.detail as FlowtiEventMap["ui.deleteTrain"]);
		}) as EventListener);
		container.appendChild(el);
	});
}
