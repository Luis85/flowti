/**
 * Render helpers for TrainMainView — extracted for max-lines compliance.
 */

import { setIcon } from "obsidian";
import type { ThoughtNode, TrainState } from "../../domain/train/types";
import { BUILT_IN_TRAIN_TYPES } from "../../domain/train/types";
import type { TrainService } from "../../domain/train/TrainService";
import { getCanvasPath } from "../../domain/train/helpers";
import type { IEventBus } from "../../infrastructure/events/types";
import type { App } from "obsidian";
import { InputModal } from "../modals";

export function renderHeader(
	el: HTMLElement,
	train: TrainState,
	eventBus: IEventBus,
	app: App,
	showRenameInput: (train: TrainState) => void,
): void {
	const header = el.createDiv({ cls: "ft-section" });

	const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
	const icon = titleRow.createSpan();
	setIcon(icon, "train-front");
	titleRow.createEl("h3", { cls: "ft-heading ft-train-title", text: `Train: ${train.title}` });

	// Rename button
	const renameBtn = titleRow.createEl("button", { cls: "clickable-icon ft-train-rename-btn" });
	renameBtn.ariaLabel = "Rename train";
	setIcon(renameBtn, "pencil");
	renameBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		showRenameInput(train);
	});

	// Summary note link
	const summaryPath = getSummaryPath(train);
	if (summaryPath && app?.vault?.getAbstractFileByPath(summaryPath)) {
		const summaryBtn = titleRow.createEl("button", { cls: "clickable-icon ft-train-summary-btn" });
		summaryBtn.ariaLabel = "Open summary note";
		setIcon(summaryBtn, "file-text");
		summaryBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (app?.workspace) {
				void app.workspace.openLinkText(summaryPath, "", false);
			}
		});
	}

	const badge = titleRow.createSpan({ cls: `ft-badge ft-badge-muted ft-train-status ft-train-status-${train.status}` });
	badge.setText(train.status);

	// Type badge
	const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
	const typeLabel = typeConfig?.label ?? "Free-form";
	const typeBadge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-type-badge" });
	const typeIcon = typeBadge.createSpan();
	setIcon(typeIcon, typeConfig?.icon ?? "pen-line");
	typeBadge.appendText(` ${typeLabel}`);

	titleRow.createSpan({ cls: "ft-flex-spacer" });

	// Toggle timeline sidebar
	const toggleBtn = titleRow.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm" });
	toggleBtn.ariaLabel = "Toggle timeline sidebar";
	const toggleIcon = toggleBtn.createSpan();
	setIcon(toggleIcon, "panel-right");
	toggleBtn.addEventListener("click", () => {
		void eventBus.emit("ui.toggleTrainTimeline", { trainId: train.id });
	});
}

export function renderCompletionCallout(
	el: HTMLElement,
	train: TrainState,
	trainService: TrainService,
	eventBus: IEventBus,
	app: App,
	getCanvasPathForTrain: (train: TrainState) => string | null,
): void {
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
	section.createDiv({ cls: "ft-text-sm ft-text-muted", text: parts.join(" · ") });

	// Artifact links
	const linksRow = section.createDiv({ cls: "ft-flex ft-flex-col ft-gap-1 ft-mt-2" });

	const summaryPath = getSummaryPath(train);
	if (summaryPath && app?.vault?.getAbstractFileByPath(summaryPath)) {
		const summaryRow = linksRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const summaryIcon = summaryRow.createSpan({ cls: "ft-icon-muted" });
		setIcon(summaryIcon, "file-text");
		const summaryLink = summaryRow.createEl("a", { cls: "ft-text-sm", text: `${train.title} — Summary` });
		summaryLink.addEventListener("click", (e) => {
			e.preventDefault();
			if (app?.workspace) void app.workspace.openLinkText(summaryPath, "", false);
		});
	}

	const canvasPath = getCanvasPathForTrain(train);
	if (canvasPath && app?.vault?.getAbstractFileByPath(canvasPath)) {
		const canvasRow = linksRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const canvasIcon = canvasRow.createSpan({ cls: "ft-icon-muted" });
		setIcon(canvasIcon, "layout-dashboard");
		const canvasLink = canvasRow.createEl("a", { cls: "ft-text-sm", text: `${train.title}.canvas` });
		canvasLink.addEventListener("click", (e) => {
			e.preventDefault();
			if (app?.workspace) void app.workspace.openLinkText(canvasPath, "", false);
		});
	}

	const ctaRow = section.createDiv({ cls: "ft-mt-3" });
	const cta = ctaRow.createEl("button", { cls: "ft-btn ft-btn-primary" });
	cta.setText("Start a new ride");
	cta.addEventListener("click", () => {
		void eventBus.emit("ui.startTrain", {});
	});
}

export function renderThoughtDetail(el: HTMLElement, thought: ThoughtNode, train: TrainState): void {
	const detail = el.createDiv({ cls: "ft-section ft-train-detail" });

	const titleRow = detail.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
	titleRow.createEl("h3", { cls: "ft-heading-sm ft-train-thought-title", text: thought.title });

	const isMerged = train.relations.some((r) => r.fromId === thought.id && r.direction === "merge");
	if (isMerged) {
		const badge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-merged-badge" });
		badge.setText("Merged");
	}

	const meta = detail.createDiv({ cls: "ft-detail-info-grid ft-train-thought-meta" });
	const time = new Date(thought.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	const relation = train.relations.find((r) => r.toId === thought.id);
	const directionLabel = relation ? `→ ${relation.direction}` : "root";

	renderInfoRow(meta, "Created", time);
	renderInfoRow(meta, "Order", `#${thought.order + 1}`);
	renderInfoRow(meta, "Direction", directionLabel);

	// Clickable note link
	const noteLink = detail.createDiv({ cls: "ft-train-note-link ft-flex ft-items-center ft-gap-1 ft-text-sm" });
	const noteLinkIcon = noteLink.createSpan();
	setIcon(noteLinkIcon, "file-text");
	noteLink.createSpan({ text: thought.path.split("/").pop() ?? thought.path });
	noteLink.addEventListener("click", () => {
		// App reference not available here — use global approach
		const workspace = (globalThis as unknown as { app?: { workspace?: { openLinkText: (path: string, source: string, newLeaf: boolean) => Promise<void> } } }).app?.workspace;
		if (workspace) void workspace.openLinkText(thought.path, "", false);
	});
}

function renderInfoRow(grid: HTMLElement, label: string, value: string): void {
	grid.createDiv({ cls: "ft-detail-info-label", text: label });
	grid.createDiv({ cls: "ft-detail-info-value", text: value });
}

export function computeElapsedLabel(train: TrainState): string {
	if (!train.createdAt) return "";
	const start = new Date(train.createdAt).getTime();
	const end = train.completedAt
		? new Date(train.completedAt).getTime()
		: Date.now();
	const mins = Math.floor(Math.max(0, end - start) / 60_000);
	if (mins < 1) return "< 1 min";
	return `${mins} min`;
}

export function getSummaryPath(train: TrainState): string | null {
	const folder = train.folderPath;
	if (!folder) return null;
	return `${folder}/${train.title} — Summary.md`;
}

export function getCanvasPathForTrain(
	train: TrainState,
	trainCanvasEnabled: boolean,
): string | null {
	if (!trainCanvasEnabled || !train.folderPath) return null;
	return getCanvasPath(train.title, train.folderPath);
}

export function renderContentPreview(el: HTMLElement, thought: ThoughtNode, app: App): void {
	const preview = el.createDiv({ cls: "ft-train-content-preview" });

	if (!app?.vault) {
		preview.setText("(preview unavailable)");
		return;
	}

	preview.setText("Loading preview...");

	const file = app.vault.getAbstractFileByPath(thought.path);
	if (file && "extension" in file) {
		void app.vault.read(file as import("obsidian").TFile).then((content) => {
			const body = content.replace(/^---[\s\S]*?---\n?/, "").trim();
			const snippet = body.length > 200 ? body.slice(0, 200) + "\u2026" : body;
			preview.setText(snippet || "(empty note)");
		}).catch(() => {
			preview.setText("(could not read note)");
		});
	} else {
		preview.setText("(note not found)");
	}
}

export function renderCanvasCallout(
	el: HTMLElement,
	train: TrainState,
	canvasPath: string | null,
	app: App,
): void {
	if (!canvasPath) return;

	const callout = el.createDiv({ cls: "ft-section ft-train-canvas-callout ft-flex ft-items-center ft-gap-2" });
	const icon = callout.createSpan();
	setIcon(icon, "layout-dashboard");

	const canvasExists = app?.vault?.getAbstractFileByPath(canvasPath);

	if (canvasExists) {
		callout.createSpan({ cls: "ft-text-sm", text: `Canvas: ${train.title}` });
		const openBtn = callout.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm" });
		openBtn.setText("Open");
		openBtn.addEventListener("click", () => {
			if (app?.workspace) {
				void app.workspace.openLinkText(canvasPath, "", false);
			}
		});
	} else {
		callout.createSpan({ cls: "ft-text-sm ft-text-muted", text: "Canvas will be created on first thought" });
	}
}

export function renderParentLink(
	el: HTMLElement,
	parentTrainId: string,
	trainService: TrainService,
	onNavigate: (trainId: string) => void,
): void {
	const parentTrain = trainService.getTrain(parentTrainId);
	if (!parentTrain) return;

	const link = el.createDiv({ cls: "ft-section ft-train-parent-link ft-flex ft-items-center ft-gap-1 ft-text-sm ft-text-muted" });
	const icon = link.createSpan();
	setIcon(icon, "arrow-up-left");
	link.appendText(`Parent: ${parentTrain.title}`);
	link.addEventListener("click", () => onNavigate(parentTrainId));
}

export function renderBranchLinks(
	el: HTMLElement,
	thought: ThoughtNode,
	train: TrainState,
	trainService: TrainService,
	onNavigate: (thoughtId: string) => void,
): void {
	const branches = trainService.getBranches(train.id, thought.id);
	if (branches.length === 0) return;

	const section = el.createDiv({ cls: "ft-section ft-train-branches" });
	section.createEl("h4", { cls: "ft-heading-sm", text: "Branches" });

	for (const branch of branches) {
		const link = section.createDiv({ cls: "ft-train-branch-link" });
		const linkIcon = link.createSpan();
		setIcon(linkIcon, "git-branch");
		link.createSpan({ text: branch.title });
		link.addEventListener("click", () => onNavigate(branch.id));
	}
}

export function renderMergeSection(
	el: HTMLElement,
	thought: ThoughtNode,
	train: TrainState,
	trainService: TrainService,
): void {
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

export function renderNavBar(
	el: HTMLElement,
	allThoughts: ThoughtNode[],
	activeThought: ThoughtNode | null,
	train: TrainState,
	trainService: TrainService,
	eventBus: IEventBus,
	onActivateThought: (thought: ThoughtNode) => void,
	onScheduleRender: () => void,
	getActiveThoughtId: () => string | null,
): void {
	const navWrapper = el.createDiv({ cls: "ft-section ft-train-nav-wrapper" });
	const nav = navWrapper.createDiv({ cls: "ft-flex ft-items-center ft-justify-between ft-gap-2 ft-train-nav-bar" });

	const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
	const prevRelation = activeThought ? train.relations.find((r) => r.toId === activeThought.id && r.direction === "next") : null;
	const nextRelation = activeThought ? train.relations.find((r) => r.fromId === activeThought.id && r.direction === "next") : null;
	const prevThought = prevRelation ? thoughtById.get(prevRelation.fromId) ?? null : null;
	const nextThought = nextRelation ? thoughtById.get(nextRelation.toId) ?? null : null;

	// Prev button
	const prevBtn = nav.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-prev-btn" });
	prevBtn.setText("\u25C4 prev");
	if (!prevThought) { prevBtn.disabled = true; prevBtn.addClass("ft-train-nav-disabled"); }
	else { prevBtn.addEventListener("click", () => onActivateThought(prevThought)); }

	// Inline controls
	if (train.status !== "completed") {
		const controls = nav.createDiv({ cls: "ft-detail-actions ft-flex ft-items-center ft-gap-1" });
		renderInlineControls(controls, train, trainService, eventBus, onScheduleRender, getActiveThoughtId);
	}

	// Right nav group
	const rightGroup = nav.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
	renderRightNavButtons(rightGroup, activeThought, nextThought, train, trainService, eventBus, onActivateThought, getActiveThoughtId);
}

function renderInlineControls(
	container: HTMLElement,
	train: TrainState,
	trainService: TrainService,
	eventBus: IEventBus,
	onScheduleRender: () => void,
	getActiveThoughtId: () => string | null,
): void {
	const addBtn = (label: string, iconName: string, onClick: () => void | Promise<void>, primary = false): void => {
		const cls = primary ? "ft-btn ft-btn-primary ft-btn-sm" : "ft-btn ft-btn-secondary ft-btn-sm";
		const btn = container.createEl("button", { cls });
		const iconEl = btn.createSpan();
		setIcon(iconEl, iconName);
		btn.appendText(` ${label}`);
		btn.addEventListener("click", () => { void onClick(); });
	};

	if (train.status === "running") {
		addBtn("Pause", "pause", async () => { await trainService.pause(train.id); onScheduleRender(); });
		addBtn("Complete", "check-circle", async () => { await trainService.completeTrain(train.id); onScheduleRender(); });
	} else if (train.status === "paused") {
		addBtn("Resume", "play", () => { void eventBus.emit("ui.startTrain", { fromThoughtId: getActiveThoughtId() ?? undefined }); }, true);
		addBtn("Complete", "check-circle", async () => { await trainService.completeTrain(train.id); onScheduleRender(); });
	}
}

function renderRightNavButtons(
	rightGroup: HTMLElement,
	activeThought: ThoughtNode | null,
	nextThought: ThoughtNode | null,
	train: TrainState,
	trainService: TrainService,
	eventBus: IEventBus,
	onActivateThought: (thought: ThoughtNode) => void,
	getActiveThoughtId: () => string | null,
): void {
	const mergeDownInfo = (activeThought && train.status !== "completed") ? trainService.findMergeDownTarget(train.id, activeThought.id) : null;

	if (mergeDownInfo) {
		const target = mergeDownInfo.targetId ? train.thoughts.find((t) => t.id === mergeDownInfo.targetId) : null;
		const mergeBtn = rightGroup.createEl("button", { cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-merge-down-btn" });
		setIcon(mergeBtn.createSpan(), "git-merge");
		mergeBtn.appendText(` Merge down${target ? ` \u2192 ${target.title}` : ""}`);
		mergeBtn.addEventListener("click", () => { void eventBus.emit("ui.startTrain", { fromThoughtId: activeThought!.id, mergeDown: true }); });
	} else if (nextThought) {
		const nextBtn = rightGroup.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-next-btn" });
		nextBtn.setText("Next \u25BA");
		nextBtn.addEventListener("click", () => onActivateThought(nextThought));
	} else if (activeThought && train.status !== "completed") {
		const addBtn = rightGroup.createEl("button", { cls: "ft-btn ft-btn-primary ft-btn-sm ft-train-nav-btn ft-train-add-thought-btn" });
		setIcon(addBtn.createSpan(), "plus-circle");
		addBtn.appendText(" Add Thought");
		addBtn.addEventListener("click", () => { void eventBus.emit("ui.startTrain", { fromThoughtId: getActiveThoughtId() ?? undefined }); });
	}

	const headNode = trainService.getHeadNode(train.id);
	if (headNode && activeThought && headNode.id !== activeThought.id) {
		const jumpBtn = rightGroup.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm ft-train-nav-btn ft-train-jump-to-end-btn" });
		setIcon(jumpBtn.createSpan(), "fast-forward");
		jumpBtn.appendText(" End");
		jumpBtn.addEventListener("click", () => onActivateThought(headNode));
	}
}

export function showRenameInput(
	app: App,
	train: TrainState,
	trainService: TrainService,
	render: () => void,
): void {
	new InputModal(app, {
		title: "Rename Train",
		inputName: "New title",
		inputDesc: "Enter a new name for this train",
		defaultValue: train.title,
		submitLabel: "Rename",
		onSubmit: (newTitle) => {
			if (newTitle !== train.title) {
				void trainService.renameTrain(train.id, newTitle).then((ok) => {
					if (ok) render();
				});
			}
		},
	}).open();
}
