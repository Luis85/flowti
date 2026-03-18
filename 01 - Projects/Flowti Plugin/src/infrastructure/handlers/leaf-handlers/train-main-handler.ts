/**
 * Handler registration for the Train Main leaf view.
 *
 * Bridges TrainService + Lit components into a sitemap-driven
 * tab handler. Uses `<flowti-train-workspace>` as the main
 * orchestrator component, with event wiring back to EventBus.
 *
 * Migrated from: DOM-based panel classes → Lit components.
 */

import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import type { IEventBus } from "../../events/types";
import type { TrainService } from "../../../domain/train/TrainService";
import type { ThoughtNode, TrainState } from "../../../domain/train/types";
import { BUILT_IN_TRAIN_TYPES } from "../../../domain/train/types";
import type { Session, ClosureResponse, ClosureTemplate } from "../../../domain/session/types";
import { SESSION_TYPE_CONFIGS } from "../../../domain/session/types";
import { resolveClosureTemplate } from "../../../domain/session/helpers";
import { SessionClosureOverlay } from "../../../ui/session/SessionClosureOverlay";
import type { TrainViewContext } from "../../../ui/train/TrainMainView";
import { setupTrainViewSubscriptions } from "../../../ui/train/TrainMainViewSubscriptions";
import { TrainHistoryPanel } from "../../../ui/train/TrainHistoryPanel";
import { getCanvasPath } from "../../../domain/train/helpers";

// Side-effect imports for Lit component registration
import "../../../components/train/flowti-train-workspace.js";

// ── Public types ──────────────────────────────────────────────

export interface TrainViewSettings {
	trainFolder: string;
	trainCanvasEnabled: boolean;
	trainCanvasAutoOpen: boolean;
}

/** Optional closure ritual dependencies. */
export interface TrainClosureDeps {
	getSession: (sessionId: string) => Session | null;
	completeClosure: (sessionId: string, response: ClosureResponse) => void;
	skipClosure: (sessionId: string) => void;
}

export interface TrainMainHandlerDeps {
	trainService: TrainService;
	eventBus: IEventBus;
	app: unknown; // Obsidian App
	getTrainSettings: () => TrainViewSettings;
	closureDeps?: TrainClosureDeps;
}

// ── Registration ──────────────────────────────────────────────

export function registerTrainMainHandler(
	registry: PluginHandlerRegistry,
	deps: TrainMainHandlerDeps,
): void {
	registry.registerTabHandler("leaf:train-main", (container: HTMLElement, _ctx: TabContext) => {
		const state = createHandlerState();
		const { trainService, eventBus, getTrainSettings, closureDeps } = deps;

		// Initialise trainId from context or active train
		if (!state.trainId) {
			const active = trainService.getActiveTrain();
			if (active) {
				state.trainId = active.id;
			}
		}

		render();

		const unsubscribes = setupTrainViewSubscriptions(buildViewContext(), eventBus);

		// Return cleanup function (called by SitemapLeafView on close)
		return () => {
			if (state.renderTimer !== null) {
				clearTimeout(state.renderTimer);
				state.renderTimer = null;
			}
			for (const unsub of unsubscribes) unsub();
		};

		// ── State ─────────────────────────────────────────────

		function getTrain(): TrainState | undefined {
			if (state.trainId) {
				return trainService.getTrain(state.trainId);
			}
			return trainService.getActiveTrain();
		}

		function scheduleRender(): void {
			if (state.renderTimer !== null) clearTimeout(state.renderTimer);
			state.renderTimer = setTimeout(() => {
				state.renderTimer = null;
				render();
			}, 16);
		}

		function buildViewContext(): TrainViewContext {
			return {
				getTrainId: () => state.trainId,
				getSessionId: () => {
					const train = getTrain();
					return train?.sessionId ?? null;
				},
				setTrainId: (trainId: string) => { state.trainId = trainId; },
				setActiveThoughtId: (id: string | null) => { state.activeThoughtId = id; },
				scheduleRender: () => scheduleRender(),
			};
		}

		// ── Render ────────────────────────────────────────────

		function render(): void {
			container.empty();

			const train = getTrain();
			if (!train) {
				renderEmptyState(container);
				return;
			}

			// Closure ritual overlay (remains DOM-based — Obsidian modal dependency)
			const linkedSession = closureDeps && train.sessionId
				? closureDeps.getSession(train.sessionId)
				: null;
			if (linkedSession?.status === "reviewing" && closureDeps) {
				renderClosureOverlay(container, linkedSession, train);
				return;
			}

			// Compute all data for the workspace component
			const allThoughts = getSortedThoughts(train);
			const activeThought = resolveActiveThought(allThoughts);
			const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));

			// Navigation
			const prevRelation = activeThought
				? train.relations.find((r) => r.toId === activeThought.id && r.direction === "next")
				: null;
			const prevThought = prevRelation ? thoughtById.get(prevRelation.fromId) ?? null : null;
			const nextRelation = activeThought
				? train.relations.find((r) => r.fromId === activeThought.id && r.direction === "next")
				: null;
			const nextThought = nextRelation ? thoughtById.get(nextRelation.toId) ?? null : null;
			const headThought = trainService.getHeadNode(train.id);

			// Merge down
			const mergeDownInfo = (activeThought && train.status !== "completed")
				? trainService.findMergeDownTarget(train.id, activeThought.id)
				: null;
			const mergeDownTarget = mergeDownInfo
				? {
					targetId: mergeDownInfo.targetId,
					targetTitle: mergeDownInfo.targetId
						? train.thoughts.find((t) => t.id === mergeDownInfo.targetId)?.title
						: undefined,
				}
				: null;

			// Stats
			const timeline = trainService.getTimeline(train.id);
			let branchCount = 0;
			for (const thought of train.thoughts) {
				branchCount += trainService.getBranches(train.id, thought.id).length;
			}
			const activeIdx = activeThought
				? allThoughts.findIndex((t) => t.id === activeThought.id)
				: -1;
			const activePosition = activeIdx >= 0
				? { index: activeIdx, total: allThoughts.length }
				: null;

			// Breadcrumb
			const breadcrumbPath = activeThought
				? buildPathToRoot(train, activeThought)
				: [];

			// Branches
			const branches = activeThought
				? trainService.getBranches(train.id, activeThought.id)
				: [];

			// Outgoing merges
			const outgoingMerges = activeThought && train.status !== "completed"
				? train.relations
					.filter((r) => r.fromId === activeThought.id && r.direction === "merge")
					.map((r) => ({
						fromId: r.fromId,
						toId: r.toId,
						targetTitle: train.thoughts.find((t) => t.id === r.toId)?.title ?? "",
					}))
				: [];

			// Parent train
			const parentTrain = train.parentTrainId
				? trainService.getTrain(train.parentTrainId)
				: null;

			// Type badge
			const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
			const trainTypeLabel = typeConfig?.label ?? "Free-form";

			// Canvas
			const canvasPath = getCanvasPathForTrain(train);

			// Elapsed
			const elapsed = computeElapsedLabel(train);

			// Create workspace element
			const workspace = document.createElement("flowti-train-workspace");

			// Set all properties
			Object.assign(workspace, {
				train,
				activeThought,
				allThoughts,
				chainLength: timeline.length,
				branchCount,
				activePosition,
				prevThought,
				nextThought,
				headThought,
				mergeDownTarget,
				parentTrainTitle: parentTrain?.title ?? null,
				parentTrainId: train.parentTrainId ?? null,
				canvasPath,
				breadcrumbPath,
				branches,
				outgoingMerges,
				trainTypeLabel,
				elapsed,
			});

			// Wire events from Lit components to EventBus / TrainService
			wireWorkspaceEvents(workspace, train);

			container.appendChild(workspace);
		}

		// ── Event wiring ──────────────────────────────────────

		function wireWorkspaceEvents(el: HTMLElement, train: TrainState): void {
			el.addEventListener("thought-activated", ((e: CustomEvent) => {
				state.activeThoughtId = e.detail.thoughtId;
				void eventBus.emit("train.thought.activated", {
					trainId: e.detail.trainId,
					thoughtId: e.detail.thoughtId,
				});
				render();
			}) as EventListener);

			el.addEventListener("pause-train", (async () => {
				await trainService.pause(train.id);
				scheduleRender();
			}) as EventListener);

			el.addEventListener("complete-train", (async () => {
				await trainService.completeTrain(train.id);
				scheduleRender();
			}) as EventListener);

			el.addEventListener("resume-train", ((e: CustomEvent) => {
				const fromThoughtId = e.detail?.fromThoughtId ?? state.activeThoughtId ?? undefined;
				void eventBus.emit("ui.startTrain", { fromThoughtId });
			}) as EventListener);

			el.addEventListener("add-thought", ((e: CustomEvent) => {
				const fromThoughtId = e.detail?.fromThoughtId ?? state.activeThoughtId ?? undefined;
				void eventBus.emit("ui.startTrain", { fromThoughtId });
			}) as EventListener);

			el.addEventListener("merge-down", ((e: CustomEvent) => {
				const fromThoughtId = e.detail?.fromThoughtId ?? state.activeThoughtId;
				void eventBus.emit("ui.startTrain", { fromThoughtId, mergeDown: true });
			}) as EventListener);

			el.addEventListener("start-train", (() => {
				void eventBus.emit("ui.startTrain", {});
			}) as EventListener);

			el.addEventListener("toggle-timeline", ((e: CustomEvent) => {
				void eventBus.emit("ui.toggleTrainTimeline", { trainId: e.detail.trainId });
			}) as EventListener);

			el.addEventListener("rename-train", ((e: CustomEvent) => {
				void trainService.renameTrain(e.detail.trainId, e.detail.currentTitle);
			}) as EventListener);

			el.addEventListener("undo-merge", ((e: CustomEvent) => {
				void trainService.undoMerge(
					e.detail.trainId,
					e.detail.fromId,
					e.detail.toId,
				);
			}) as EventListener);

			el.addEventListener("select-train", ((e: CustomEvent) => {
				state.trainId = e.detail.trainId;
				state.activeThoughtId = null;
				render();
			}) as EventListener);
		}

		// ── Section renderers (non-Lit) ──────────────────────

		function renderEmptyState(el: HTMLElement): void {
			const historyEl = el.createDiv({ cls: "ft-train-empty" });
			const panel = new TrainHistoryPanel(historyEl, {
				trainService,
				onSelectTrain: (trainId) => {
					state.trainId = trainId;
					state.activeThoughtId = null;
					render();
				},
				onRenameTrain: (trainId, currentTitle) => {
					void trainService.renameTrain(trainId, currentTitle);
				},
				onDeleteTrain: (trainId, _title) => {
					void trainService.deleteTrain(trainId).then((ok) => {
						if (ok) {
							if (state.trainId === trainId) {
								state.trainId = null;
								state.activeThoughtId = null;
							}
							render();
						}
					});
				},
			});
			panel.render();
		}

		function renderClosureOverlay(el: HTMLElement, session: Session, train: TrainState): void {
			const typeTemplates = getTypeClosureTemplates();
			const template = resolveClosureTemplate(session, undefined, typeTemplates);
			const closDeps = closureDeps!;

			const overlay = new SessionClosureOverlay(el, session, template, {
				onSubmit: (response) => {
					closDeps.completeClosure(session.id, response);
					void eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id, forceClose: true });
				},
				onSkip: () => {
					closDeps.skipClosure(session.id);
					void eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id, forceClose: true });
				},
			});
			overlay.render();
		}

		// ── Helpers ───────────────────────────────────────────

		function getSortedThoughts(train: TrainState): ThoughtNode[] {
			return [...train.thoughts].sort((a, b) => a.order - b.order);
		}

		function resolveActiveThought(sorted: ThoughtNode[]): ThoughtNode | null {
			if (sorted.length === 0) return null;
			if (state.activeThoughtId) {
				const found = sorted.find((t) => t.id === state.activeThoughtId);
				if (found) return found;
			}
			state.activeThoughtId = sorted[0].id;
			return sorted[0];
		}

		function buildPathToRoot(train: TrainState, target: ThoughtNode): ThoughtNode[] {
			const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
			const parentMap = new Map<string, string>();
			for (const rel of train.relations) {
				parentMap.set(rel.toId, rel.fromId);
			}

			const path: ThoughtNode[] = [target];
			let currentId = target.id;
			const visited = new Set<string>([currentId]);

			while (parentMap.has(currentId)) {
				const parentId = parentMap.get(currentId)!;
				if (visited.has(parentId)) break;
				visited.add(parentId);
				const parent = thoughtById.get(parentId);
				if (parent) {
					path.unshift(parent);
				}
				currentId = parentId;
			}

			return path;
		}

		function getCanvasPathForTrain(train: TrainState): string | null {
			const { trainCanvasEnabled } = getTrainSettings();
			if (!trainCanvasEnabled || !train.folderPath) return null;
			return getCanvasPath(train.title, train.folderPath);
		}

		function computeElapsedLabel(train: TrainState): string {
			if (!train.createdAt) return "";
			const start = new Date(train.createdAt).getTime();
			const end = train.completedAt
				? new Date(train.completedAt).getTime()
				: Date.now();
			const mins = Math.floor(Math.max(0, end - start) / 60_000);
			if (mins < 1) return "< 1 min";
			return `${mins} min`;
		}

		function getTypeClosureTemplates(): Record<string, ClosureTemplate> | undefined {
			const result: Record<string, ClosureTemplate> = {};
			let hasAny = false;
			for (const [type, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
				if (config.closureTemplate) {
					result[type] = config.closureTemplate;
					hasAny = true;
				}
			}
			return hasAny ? result : undefined;
		}
	});
}

// ── Internal state factory ────────────────────────────────────

interface HandlerState {
	trainId: string | null;
	activeThoughtId: string | null;
	renderTimer: ReturnType<typeof setTimeout> | null;
}

function createHandlerState(): HandlerState {
	return {
		trainId: null,
		activeThoughtId: null,
		renderTimer: null,
	};
}
