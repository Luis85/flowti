/**
 * Handler registration for the Train Main leaf view.
 *
 * Bridges TrainService + existing panel classes into a sitemap-driven
 * tab handler. Reuses TrainStatsPanel, TrainBreadcrumbPanel,
 * TrainHistoryPanel, and TrainMainViewSubscriptions rather than
 * duplicating their logic.
 *
 * Migrated from: src/ui/train/TrainMainView.ts (843 LOC ItemView).
 */

import { setIcon } from "obsidian";
import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import type { IEventBus } from "../../events/types";
import type { TrainService } from "../../../domain/train/TrainService";
import type { ThoughtNode, TrainState } from "../../../domain/train/types";
import { BUILT_IN_TRAIN_TYPES } from "../../../domain/train/types";
import type { Session, ClosureResponse, ClosureTemplate } from "../../../domain/session/types";
import { SESSION_TYPE_CONFIGS } from "../../../domain/session/types";
import { resolveClosureTemplate } from "../../../domain/session/helpers";
import { SessionClosureOverlay } from "../../../ui/session/SessionClosureOverlay";
import type { TrainPanelDeps } from "../../../ui/train/types";
import type { TrainViewContext } from "../../../ui/train/TrainMainView";
import { setupTrainViewSubscriptions } from "../../../ui/train/TrainMainViewSubscriptions";
import { TrainStatsPanel } from "../../../ui/train/TrainStatsPanel";
import { TrainBreadcrumbPanel } from "../../../ui/train/TrainBreadcrumbPanel";
import { TrainHistoryPanel } from "../../../ui/train/TrainHistoryPanel";
import { getCanvasPath } from "../../../domain/train/helpers";

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
			state.statsPanel?.destroy();
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

		function buildPanelDeps(): TrainPanelDeps {
			return {
				trainService,
				eventBus,
				scheduleRender: () => scheduleRender(),
				getActiveThoughtId: () => state.activeThoughtId,
			};
		}

		// ── Render ────────────────────────────────────────────

		function render(): void {
			state.statsPanel?.destroy();
			container.empty();

			const train = getTrain();
			if (!train) {
				renderEmptyState(container);
				return;
			}

			// Closure ritual overlay
			const linkedSession = closureDeps && train.sessionId
				? closureDeps.getSession(train.sessionId)
				: null;
			if (linkedSession?.status === "reviewing" && closureDeps) {
				renderHeader(container, train);
				renderClosureOverlay(container, linkedSession, train);
				return;
			}

			const panelDeps = buildPanelDeps();
			const allThoughts = getSortedThoughts(train);
			const activeThought = resolveActiveThought(allThoughts);

			// 1. Header
			renderHeader(container, train);

			// 2. Parent train link
			if (train.parentTrainId) {
				renderParentLink(container, train.parentTrainId);
			}

			// 3. Completed train
			if (train.status === "completed") {
				renderCompletionCallout(container, train);
				const statsEl = container.createDiv({ cls: "ft-section ft-train-stats-section" });
				state.statsPanel = new TrainStatsPanel(statsEl, panelDeps);
				state.statsPanel.render(train);
				return;
			}

			// 4. Nav bar
			renderNavBar(container, allThoughts, activeThought, train);

			// 5. Stats panel
			const statsEl = container.createDiv({ cls: "ft-section ft-train-stats-section" });
			state.statsPanel = new TrainStatsPanel(statsEl, panelDeps);
			const activeIdx = activeThought ? allThoughts.findIndex((t) => t.id === activeThought.id) : -1;
			const activePosition = activeIdx >= 0
				? { index: activeIdx, total: allThoughts.length }
				: undefined;
			state.statsPanel.render(train, activePosition);

			// 6-10. Active thought sections
			if (activeThought) {
				renderThoughtDetail(container, activeThought, train);
				renderCanvasCallout(container, train);
				renderContentPreview(container, activeThought);
				renderBranchLinks(container, activeThought, train);
				renderMergeSection(container, activeThought, train);
			} else {
				renderCanvasCallout(container, train);
			}

			// 11. Breadcrumb
			const breadcrumbEl = container.createDiv({ cls: "ft-section ft-train-breadcrumb-section" });
			const breadcrumb = new TrainBreadcrumbPanel(breadcrumbEl, panelDeps);
			breadcrumb.render(train, activeThought);
		}

		// ── Section renderers ─────────────────────────────────

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

		function renderHeader(el: HTMLElement, train: TrainState): void {
			const header = el.createDiv({ cls: "ft-section" });
			const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const icon = titleRow.createSpan();
			setIcon(icon, "train-front");
			titleRow.createEl("h3", { cls: "ft-heading ft-train-title", text: `Train: ${train.title}` });

			// Rename button
			const renameBtn = titleRow.createEl("button", {
				cls: "clickable-icon ft-train-rename-btn",
			});
			renameBtn.ariaLabel = "Rename train";
			setIcon(renameBtn, "pencil");
			renameBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void trainService.renameTrain(train.id, train.title);
			});

			const badge = titleRow.createSpan({ cls: `ft-badge ft-badge-muted ft-train-status ft-train-status-${train.status}` });
			badge.setText(train.status);

			// Type badge
			const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
			const typeLabel = typeConfig?.label ?? "Free-form";
			const typeBadge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-type-badge" });
			const typeIcon = typeBadge.createSpan();
			setIcon(typeIcon, typeConfig?.icon ?? "pen-line");
			typeBadge.appendText(` ${typeLabel}`);

			// Spacer
			titleRow.createSpan({ cls: "ft-flex-spacer" });

			// Toggle timeline sidebar button
			const toggleBtn = titleRow.createEl("button", {
				cls: "ft-btn ft-btn-ghost ft-btn-sm",
			});
			toggleBtn.ariaLabel = "Toggle timeline sidebar";
			const toggleIcon = toggleBtn.createSpan();
			setIcon(toggleIcon, "panel-right");
			toggleBtn.addEventListener("click", () => {
				void eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id });
			});
		}

		function renderNavBar(
			el: HTMLElement,
			allThoughts: ThoughtNode[],
			activeThought: ThoughtNode | null,
			train: TrainState,
		): void {
			const navWrapper = el.createDiv({ cls: "ft-section ft-train-nav-wrapper" });
			const nav = navWrapper.createDiv({ cls: "ft-flex ft-items-center ft-justify-between ft-gap-2 ft-train-nav-bar" });

			// Graph-based navigation
			const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
			const prevRelation = activeThought
				? train.relations.find((r) => r.toId === activeThought.id && r.direction === "next")
				: null;
			const prevThought = prevRelation ? thoughtById.get(prevRelation.fromId) ?? null : null;
			const nextRelation = activeThought
				? train.relations.find((r) => r.fromId === activeThought.id && r.direction === "next")
				: null;
			const nextThought = nextRelation ? thoughtById.get(nextRelation.toId) ?? null : null;

			// Left: prev
			const prevBtn = nav.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-prev-btn" });
			prevBtn.setText("\u25C4 prev");
			if (!prevThought) {
				prevBtn.disabled = true;
				prevBtn.addClass("ft-train-nav-disabled");
			} else {
				prevBtn.addEventListener("click", () => {
					state.activeThoughtId = prevThought.id;
					emitThoughtActivated(prevThought);
					render();
				});
			}

			// Center: inline controls
			if (train.status !== "completed") {
				const controls = nav.createDiv({ cls: "ft-detail-actions ft-flex ft-items-center ft-gap-1" });
				renderInlineControls(controls, train);
			}

			// Right group
			const rightGroup = nav.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			const mergeDownInfo = (activeThought && train.status !== "completed")
				? trainService.findMergeDownTarget(train.id, activeThought.id)
				: null;

			if (mergeDownInfo) {
				const target = mergeDownInfo.targetId
					? train.thoughts.find((t) => t.id === mergeDownInfo.targetId)
					: null;
				const mergeBtn = rightGroup.createEl("button", {
					cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-merge-down-btn",
				});
				const mdIcon = mergeBtn.createSpan();
				setIcon(mdIcon, "git-merge");
				mergeBtn.appendText(` Merge down${target ? ` \u2192 ${target.title}` : ""}`);
				mergeBtn.addEventListener("click", () => {
					const fromThoughtId = activeThought!.id;
					void eventBus.emit("ui.startTrain", { fromThoughtId, mergeDown: true });
				});
			} else if (nextThought) {
				const nextBtn = rightGroup.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-next-btn" });
				nextBtn.setText("Next \u25BA");
				nextBtn.addEventListener("click", () => {
					state.activeThoughtId = nextThought.id;
					emitThoughtActivated(nextThought);
					render();
				});
			} else if (activeThought && train.status !== "completed") {
				const addBtn = rightGroup.createEl("button", {
					cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-add-thought-btn",
				});
				const addIcon = addBtn.createSpan();
				setIcon(addIcon, "plus-circle");
				addBtn.appendText(" Add Thought");
				addBtn.addEventListener("click", () => {
					const fromThoughtId = state.activeThoughtId ?? undefined;
					void eventBus.emit("ui.startTrain", { fromThoughtId });
				});
			}

			// End button
			const headNode = trainService.getHeadNode(train.id);
			if (headNode && activeThought && headNode.id !== activeThought.id) {
				const jumpBtn = rightGroup.createEl("button", {
					cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-jump-to-end-btn",
				});
				const jumpIcon = jumpBtn.createSpan();
				setIcon(jumpIcon, "fast-forward");
				jumpBtn.appendText(" End");
				jumpBtn.addEventListener("click", () => {
					state.activeThoughtId = headNode.id;
					emitThoughtActivated(headNode);
					render();
				});
			}
		}

		function renderInlineControls(el: HTMLElement, train: TrainState): void {
			if (train.status === "running") {
				addNavButton(el, "Pause", "pause", async () => {
					await trainService.pause(train.id);
					scheduleRender();
				});
				addNavButton(el, "Complete", "check-circle", async () => {
					await trainService.completeTrain(train.id);
					scheduleRender();
				});
			} else if (train.status === "paused") {
				addNavButton(el, "Resume", "play", () => {
					const fromThoughtId = state.activeThoughtId ?? undefined;
					void eventBus.emit("ui.startTrain", { fromThoughtId });
				}, true);
				addNavButton(el, "Complete", "check-circle", async () => {
					await trainService.completeTrain(train.id);
					scheduleRender();
				});
			}
		}

		function addNavButton(
			bar: HTMLElement,
			label: string,
			iconName: string,
			onClick: () => void | Promise<void>,
			primary = false,
		): void {
			const cls = primary
				? "ft-btn ft-btn-primary ft-btn-sm"
				: "ft-btn ft-btn-secondary ft-btn-sm";
			const btn = bar.createEl("button", { cls });
			const iconEl = btn.createSpan();
			setIcon(iconEl, iconName);
			btn.appendText(` ${label}`);
			btn.addEventListener("click", () => { void onClick(); });
		}

		function renderCompletionCallout(el: HTMLElement, train: TrainState): void {
			const section = el.createDiv({ cls: "ft-section ft-train-completion-callout" });

			const headingRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const iconEl = headingRow.createSpan({ cls: "ft-icon-muted" });
			setIcon(iconEl, "check-circle");
			headingRow.createEl("h3", { cls: "ft-heading-sm", text: "Ride complete" });

			// Summary line
			let branchCount = 0;
			for (const thought of train.thoughts) {
				branchCount += trainService.getBranches(train.id, thought.id).length;
			}
			const elapsed = computeElapsedLabel(train);
			const parts = [`${train.thoughts.length} thought${train.thoughts.length !== 1 ? "s" : ""}`];
			if (branchCount > 0) parts.push(`${branchCount} branch${branchCount !== 1 ? "es" : ""}`);
			if (elapsed) parts.push(elapsed);
			section.createDiv({ cls: "ft-text-sm ft-text-muted", text: parts.join(" \u00B7 ") });

			// CTA
			const ctaRow = section.createDiv({ cls: "ft-mt-3" });
			const cta = ctaRow.createEl("button", { cls: "ft-btn ft-btn-primary" });
			cta.setText("Start a new ride");
			cta.addEventListener("click", () => {
				void eventBus.emit("ui.startTrain", {});
			});
		}

		function renderThoughtDetail(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
			const detail = el.createDiv({ cls: "ft-section ft-train-detail" });

			const titleRow = detail.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			titleRow.createEl("h3", { cls: "ft-heading-sm ft-train-thought-title", text: thought.title });

			// Merged badge
			const isMerged = train.relations.some((r) => r.fromId === thought.id && r.direction === "merge");
			if (isMerged) {
				const mergedBadge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-merged-badge" });
				mergedBadge.setText("Merged");
			}

			const meta = detail.createDiv({ cls: "ft-detail-info-grid ft-train-thought-meta" });
			const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

			const relation = train.relations.find((r) => r.toId === thought.id);
			const directionLabel = relation ? `\u2192 ${relation.direction}` : "root";

			renderInfoRow(meta, "Created", time);
			renderInfoRow(meta, "Order", `#${thought.order + 1}`);
			renderInfoRow(meta, "Direction", directionLabel);

			// Clickable note link
			const noteLink = detail.createDiv({ cls: "ft-train-note-link ft-flex ft-items-center ft-gap-1 ft-text-sm" });
			const noteLinkIcon = noteLink.createSpan();
			setIcon(noteLinkIcon, "file-text");
			noteLink.createSpan({ text: thought.path.split("/").pop() ?? thought.path });
		}

		function renderInfoRow(grid: HTMLElement, label: string, value: string): void {
			grid.createDiv({ cls: "ft-detail-info-label", text: label });
			grid.createDiv({ cls: "ft-detail-info-value", text: value });
		}

		function renderContentPreview(el: HTMLElement, _thought: ThoughtNode): void {
			const preview = el.createDiv({ cls: "ft-train-content-preview" });
			// In the handler context we do not have direct vault access for async file reads.
			// The preview is a placeholder; full vault file reading requires the Obsidian App API.
			preview.setText("(preview available in full view)");
		}

		function renderParentLink(el: HTMLElement, parentTrainId: string): void {
			const parentTrain = trainService.getTrain(parentTrainId);
			if (!parentTrain) return;

			const link = el.createDiv({ cls: "ft-section ft-train-parent-link ft-flex ft-items-center ft-gap-1 ft-text-sm ft-text-muted" });
			const icon = link.createSpan();
			setIcon(icon, "arrow-up-left");
			link.appendText(`Parent: ${parentTrain.title}`);
			link.addEventListener("click", () => {
				state.trainId = parentTrainId;
				state.activeThoughtId = null;
				render();
			});
		}

		function renderCanvasCallout(el: HTMLElement, train: TrainState): void {
			const canvasPath = getCanvasPathForTrain(train);
			if (!canvasPath) return;

			const callout = el.createDiv({ cls: "ft-section ft-train-canvas-callout ft-flex ft-items-center ft-gap-2" });
			const icon = callout.createSpan();
			setIcon(icon, "layout-dashboard");
			callout.createSpan({ cls: "ft-text-sm ft-text-muted", text: "Canvas will be created on first thought" });
		}

		function renderBranchLinks(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
			const branches = trainService.getBranches(train.id, thought.id);
			if (branches.length === 0) return;

			const section = el.createDiv({ cls: "ft-section ft-train-branches" });
			section.createEl("h4", { cls: "ft-heading-sm", text: "Branches" });

			for (const branch of branches) {
				const link = section.createDiv({ cls: "ft-train-branch-link" });
				const linkIcon = link.createSpan();
				setIcon(linkIcon, "git-branch");
				link.createSpan({ text: branch.title });
				link.addEventListener("click", () => {
					state.activeThoughtId = branch.id;
					emitThoughtActivated(branch);
					render();
				});
			}
		}

		function renderMergeSection(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
			if (train.status === "completed") return;

			const outgoingMerges = train.relations.filter(
				(r) => r.fromId === thought.id && r.direction === "merge",
			);
			if (outgoingMerges.length === 0) return;

			const section = el.createDiv({ cls: "ft-section ft-train-merge-section" });
			const mergeHeader = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-mb-1" });
			const headerIcon = mergeHeader.createSpan();
			setIcon(headerIcon, "git-merge");
			mergeHeader.createSpan({ cls: "ft-heading-sm", text: "Merged into" });

			for (const merge of outgoingMerges) {
				const target = train.thoughts.find((t) => t.id === merge.toId);
				if (!target) continue;

				const row = section.createDiv({ cls: "ft-train-merge-link ft-flex ft-items-center ft-gap-2 ft-pl-2" });
				row.createSpan({ cls: "ft-text-sm", text: `\u2192 ${target.title}` });

				const undoBtn = row.createEl("button", {
					cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-merge-undo",
				});
				undoBtn.ariaLabel = "Undo merge";
				setIcon(undoBtn, "undo-2");
				undoBtn.addEventListener("click", () => {
					void trainService.undoMerge(train.id, thought.id, target.id);
				});
			}
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

		function emitThoughtActivated(thought: ThoughtNode): void {
			void eventBus.emit("train.thought.activated", {
				trainId: thought.trainId,
				thoughtId: thought.id,
			});
		}
	});
}

// ── Internal state factory ────────────────────────────────────

interface HandlerState {
	trainId: string | null;
	activeThoughtId: string | null;
	renderTimer: ReturnType<typeof setTimeout> | null;
	statsPanel: TrainStatsPanel | null;
}

function createHandlerState(): HandlerState {
	return {
		trainId: null,
		activeThoughtId: null,
		renderTimer: null,
		statsPanel: null,
	};
}
