/**
 * Sitemap-driven handler for the Session Workspace.
 *
 * Orchestrates the session workspace using the `flowti-session-workspace`
 * Lit component and its sub-components. The handler is responsible for:
 * - Creating and mounting the Lit component
 * - Mapping session domain data to component properties
 * - Wiring CustomEvents from Lit components to EventBus
 * - Subscribing to EventBus events and updating component properties
 *
 * Event subscriptions: session-workspace-subscriptions.ts
 * Helper functions:    SessionWorkspaceHelpers.ts
 */

import { FuzzySuggestModal, type App, type WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../events/types";
import type { SessionService } from "../../../domain/session/SessionService";
import type { TrainService } from "../../../domain/train/TrainService";
import type { Session, SessionTypeConfig, SessionOutputTemplate, ClosureTemplate, EnergyLevel, ClosureResponse } from "../../../domain/session/types";
import { SESSION_TYPE_CONFIGS, MAX_CONTEXT_BINDINGS, BINDING_TYPES } from "../../../domain/session/types";
import { resolveClosureTemplate, resolveTypeConfig } from "../../../domain/session/helpers";
import { computeRemainingMs, computeActivityIntelligence } from "../../../domain/session/helpers";
import { detectCognitiveOverload } from "../../../domain/session/helpers";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "../../../ui/userHub/types";
import { BUILT_IN_TRAIN_TYPES } from "../../../domain/train/types";
import type { FlowtiSessionWorkspace } from "../../../components/session/flowti-session-workspace";
import {
	openOutputPicker, openSaveTemplateModal, openInTab, openInSidebar,
	openInAdjacentLeaf, revealInFileExplorer,
} from "../../../ui/session/SessionWorkspaceHelpers";
import type { WorkspaceHelperContext } from "../../../ui/session/SessionWorkspaceHelpers";
import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";
import { setupEventSubscriptions, getFilteredActivity } from "./session-workspace-subscriptions";

// Side-effect import to register all session Lit components
import "../../../components/session/flowti-session-workspace.js";

// ── Deps ──────────────────────────────────────────────────────

export interface SessionWorkspaceHandlerDeps {
	sessionService: SessionService;
	eventBus: IEventBus;
	app: App;
	trainService?: TrainService;
	customSessionTypes?: Record<string, SessionTypeConfig>;
	customOutputTemplates?: readonly SessionOutputTemplate[];
}

// ── Registration ──────────────────────────────────────────────

export function registerSessionWorkspaceHandler(
	registry: PluginHandlerRegistry,
	deps: SessionWorkspaceHandlerDeps,
): void {
	registry.registerTabHandler("leaf:session-workspace", (container: HTMLElement, ctx: TabContext) => {
		createSessionWorkspace(container, deps, ctx.leaf as WorkspaceLeaf);
	});
}

// ── Orchestrator ──────────────────────────────────────────────

function createSessionWorkspace(
	container: HTMLElement,
	deps: SessionWorkspaceHandlerDeps,
	leaf: WorkspaceLeaf,
): () => void {
	const { sessionService, eventBus, app } = deps;
	const customSessionTypes = deps.customSessionTypes ?? {};
	const customOutputTemplates = deps.customOutputTemplates ?? [];

	// ── State ─────────────────────────────────────────────
	let session: Session | null = null;
	let renderTimer: ReturnType<typeof setTimeout> | null = null;
	let adjacentLeaf: WorkspaceLeaf | null = null;
	let unsubscribes: (() => void)[] = [];

	// ── Create Lit component ─────────────────────────────
	const workspace = document.createElement("flowti-session-workspace") as FlowtiSessionWorkspace;
	container.addClass("ft-session-workspace");
	container.appendChild(workspace);

	// ── Helpers ───────────────────────────────────────────

	function refreshSession(): Session {
		return (session
			? sessionService.getSessionById(session.id)
			: sessionService.getActiveSession()) ?? session!;
	}

	function buildHelperContext(): WorkspaceHelperContext {
		return {
			app, eventBus, leaf,
			getSession: () => session,
			getAdjacentLeaf: () => adjacentLeaf,
			setAdjacentLeaf: (l) => { adjacentLeaf = l; },
			customOutputTemplates,
			sessionService,
		};
	}

	// ── Closure template resolution ──────────────────────

	function getTypeClosureTemplates(): Record<string, ClosureTemplate> | undefined {
		const result: Record<string, ClosureTemplate> = {};
		let hasAny = false;
		for (const [type, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			if (config.closureTemplate) { result[type] = config.closureTemplate; hasAny = true; }
		}
		for (const [type, config] of Object.entries(customSessionTypes)) {
			if (config.closureTemplate) { result[type] = config.closureTemplate; hasAny = true; }
		}
		return hasAny ? result : undefined;
	}

	function buildTrainClosureData(): { title: string; trainType?: string; thoughtCount: number; branchCount: number; mergeCount: number; elapsed: string; keyThoughts: string[] } | null {
		if (!deps.trainService || !session) return null;
		const train = deps.trainService.getAllTrains().find((t) => t.sessionId === session!.id);
		if (!train) return null;
		const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === train.trainType);
		const branchCount = train.relations.filter((r) => r.direction === "branch").length;
		const mergeCount = train.relations.filter((r) => r.direction === "merge").length;
		return {
			title: train.title, trainType: typeConfig?.label,
			thoughtCount: train.thoughts.length, branchCount, mergeCount,
			elapsed: computeTrainElapsed(train), keyThoughts: collectKeyThoughts(train),
		};
	}

	// ── Sync session state to Lit properties ─────────────

	function syncToComponent(): void {
		if (!session) { workspace.sessionId = ""; return; }

		const s = session;
		const isEditable = s.status !== "completed" && s.status !== "archived";
		const isActive = s.status === "active" || s.status === "running" || s.status === "paused";
		const showOutputs = s.status === "completed" || s.status === "archived";

		workspace.sessionId = s.id;
		workspace.sessionStatus = s.status;
		workspace.sessionTitle = s.title;
		workspace.sessionType = s.type;
		workspace.sessionTypeLabel = SESSION_TYPE_LABELS[s.type] ?? s.type;
		workspace.statusLabel = SESSION_STATUS_LABELS[s.status] ?? s.status;
		workspace.durationMinutes = s.durationMinutes;
		workspace.remainingMs = computeRemainingMs(s);
		workspace.energyLevel = s.energy ?? 0;
		workspace.energyEditable = isActive;
		workspace.goals = [...s.goals];
		workspace.tasks = [...s.executionTasks];
		workspace.notesText = s.notes;
		workspace.activities = [...getFilteredActivity(s, sessionService)];
		workspace.activityFilter = [...s.activityFilter];
		workspace.contextBindings = [...s.contextBindings];
		workspace.maxContextBindings = MAX_CONTEXT_BINDINGS;
		workspace.decisions = [...s.decisions];
		workspace.reflections = [...s.reflections];
		workspace.outputArtifacts = [...s.outputArtifacts];
		workspace.isEditable = isEditable;
		workspace.showOutputs = showOutputs;
		workspace.isInSidebar = leaf.getRoot() === app.workspace.rightSplit;
		workspace.canStart = s.status === "prepared" && !sessionService.getActiveSession();
		workspace.focusFile = s.focusFile ?? "";
		workspace.notesFile = s.notesFile ?? "";
		workspace.canvasFile = s.canvasFile ?? "";

		if (isActive) {
			const config = resolveTypeConfig(s.type, customSessionTypes);
			workspace.guidingQuestions = [...config.guidingQuestions];
		} else {
			workspace.guidingQuestions = [];
		}

		syncIntelligenceAndClosure(s);
	}

	function syncIntelligenceAndClosure(s: Session): void {
		const intel = computeActivityIntelligence(s);
		workspace.intelligence = {
			filesModified: intel.filesModified, artifactsProduced: intel.artifactsProduced,
			tasksCompleted: intel.tasksCompleted, eventsEmitted: intel.eventsEmitted,
			activeTimeMs: intel.activeTimeMs, pauseTimeMs: intel.pauseTimeMs,
		};
		if (s.status === "running" || s.status === "paused") {
			const result = detectCognitiveOverload(s);
			workspace.overloaded = result.overloaded;
			workspace.overloadReasons = [...result.reasons];
		} else {
			workspace.overloaded = false;
			workspace.overloadReasons = [];
		}
		if (s.status === "reviewing") {
			const template = resolveClosureTemplate(s, undefined, getTypeClosureTemplates());
			workspace.closureQuestions = [...template.questions];
			workspace.trainClosure = buildTrainClosureData();
		}
	}

	// ── Render scheduling ────────────────────────────────

	function scheduleSync(): void {
		if (renderTimer !== null) clearTimeout(renderTimer);
		renderTimer = setTimeout(() => { renderTimer = null; syncToComponent(); }, 16);
	}

	// ── Wire CustomEvents from Lit components to EventBus ─

	wireComponentEvents(workspace, eventBus, sessionService, app, buildHelperContext, () => session);

	// ── Initialize ───────────────────────────────────────

	const targetId = sessionService.workspaceSessionId;
	session = targetId
		? sessionService.getSessionById(targetId)
		: sessionService.getActiveSession();

	if (session) { sessionService.workspaceSessionId = session.id; }

	syncToComponent();
	unsubscribes = setupEventSubscriptions({
		eventBus, sessionService, workspace,
		getSession: () => session,
		setSession: (s) => { session = s; },
		refreshSession, scheduleSync, syncToComponent, buildHelperContext,
	});

	// ── Cleanup function ─────────────────────────────────

	return function destroy(): void {
		if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null; }
		if (session && sessionService.workspaceSessionId === session.id) {
			sessionService.workspaceSessionId = null;
		}
		for (const unsub of unsubscribes) unsub();
		unsubscribes = [];
		workspace.remove();
	};
}

// ── Component event wiring (extracted for readability) ───

function wireComponentEvents(
	workspace: FlowtiSessionWorkspace,
	eventBus: IEventBus,
	sessionService: SessionService,
	app: App,
	buildHelperContext: () => WorkspaceHelperContext,
	getSession: () => Session | null,
): void {
	workspace.addEventListener("action-pause", ((e: CustomEvent) => { void eventBus.emit("session.pause", { sessionId: e.detail.sessionId }); }) as EventListener);
	workspace.addEventListener("action-resume", ((e: CustomEvent) => { void eventBus.emit("session.resume", { sessionId: e.detail.sessionId }); }) as EventListener);
	workspace.addEventListener("action-complete", ((e: CustomEvent) => { void eventBus.emit("session.complete", { sessionId: e.detail.sessionId }); }) as EventListener);
	workspace.addEventListener("action-start", ((e: CustomEvent) => {
		if (sessionService.getActiveSession()) { void eventBus.emit("notice.error", { message: "Another session is already active. Complete or pause it first." }); return; }
		void eventBus.emit("session.start", { sessionId: e.detail.sessionId });
	}) as EventListener);
	workspace.addEventListener("action-save-template", () => { const s = getSession(); if (s) openSaveTemplateModal(buildHelperContext(), s); });
	workspace.addEventListener("action-sidebar", () => { openInSidebar(buildHelperContext()); });
	workspace.addEventListener("action-tab", () => { openInTab(buildHelperContext()); });
	workspace.addEventListener("file-open", ((e: CustomEvent) => { openInAdjacentLeaf(buildHelperContext(), e.detail.path); }) as EventListener);
	workspace.addEventListener("canvas-create", () => { /* no-op */ });
	workspace.addEventListener("duration-change", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.duration.update", { sessionId: s.id, durationMinutes: e.detail.durationMinutes }); }) as EventListener);
	workspace.addEventListener("energy-change", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.energy.set", { sessionId: s.id, level: e.detail.level as EnergyLevel }); }) as EventListener);
	workspace.addEventListener("goal-toggle", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.goal.toggle", { sessionId: s.id, goalId: e.detail.goalId }); }) as EventListener);
	workspace.addEventListener("goal-add", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.goal.add", { sessionId: s.id, text: e.detail.text }); }) as EventListener);
	workspace.addEventListener("goal-remove", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.goal.remove", { sessionId: s.id, goalId: e.detail.goalId }); }) as EventListener);
	workspace.addEventListener("goal-reorder", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.goal.reorder", { sessionId: s.id, goalIds: e.detail.goalIds }); }) as EventListener);
	workspace.addEventListener("task-toggle", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.task.toggle", { sessionId: s.id, taskId: e.detail.taskId }); }) as EventListener);
	workspace.addEventListener("task-add", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.task.add", { sessionId: s.id, label: e.detail.label }); }) as EventListener);
	workspace.addEventListener("task-remove", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.task.remove", { sessionId: s.id, taskId: e.detail.taskId }); }) as EventListener);
	workspace.addEventListener("task-reorder", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.task.reorder", { sessionId: s.id, taskIds: e.detail.taskIds }); }) as EventListener);
	workspace.addEventListener("notes-change", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.notes.update", { sessionId: s.id, notes: e.detail.notes }); }) as EventListener);
	workspace.addEventListener("filter-add", ((e: CustomEvent) => { const s = getSession(); if (s) { void sessionService.updateActivityFilter(s.id, [...s.activityFilter, e.detail.folder]); } }) as EventListener);
	workspace.addEventListener("filter-remove", ((e: CustomEvent) => { const s = getSession(); if (s) { void sessionService.updateActivityFilter(s.id, s.activityFilter.filter((f) => f !== e.detail.folder)); } }) as EventListener);
	workspace.addEventListener("activity-open", ((e: CustomEvent) => { openInAdjacentLeaf(buildHelperContext(), e.detail.path); }) as EventListener);
	workspace.addEventListener("context-cycle-type", ((e: CustomEvent) => {
		const s = getSession(); if (!s) return;
		const binding = s.contextBindings.find((b) => b.id === e.detail.bindingId);
		if (!binding) return;
		const currentIdx = BINDING_TYPES.indexOf(binding.type);
		const nextType = BINDING_TYPES[(currentIdx + 1) % BINDING_TYPES.length];
		void eventBus.emit("session.context.changeType", { sessionId: s.id, bindingId: binding.id, type: nextType });
	}) as EventListener);
	workspace.addEventListener("context-open", ((e: CustomEvent) => {
		const ctx = buildHelperContext();
		if (e.detail.type === "folder") { revealInFileExplorer(ctx, e.detail.path); }
		else { openInAdjacentLeaf(ctx, e.detail.path); }
	}) as EventListener);
	workspace.addEventListener("context-remove", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.context.unbind", { sessionId: s.id, bindingId: e.detail.bindingId }); }) as EventListener);
	workspace.addEventListener("context-add", () => {
		const s = getSession(); if (!s) return;
		const items = app.vault.getAllLoadedFiles();
		const choices: Array<{ path: string; type: "file" | "folder" }> = [];
		for (const item of items) {
			if ("children" in item && item.path) { choices.push({ path: item.path + "/", type: "folder" }); }
			else if ("extension" in item) { choices.push({ path: item.path, type: "file" }); }
		}
		choices.sort((a, b) => a.path.localeCompare(b.path));
		class PickerModal extends FuzzySuggestModal<{ path: string; type: "file" | "folder" }> {
			getItems() { return choices; }
			getItemText(item: { path: string }) { return item.path; }
			onChooseItem(item: { path: string; type: "file" | "folder" }) {
				void eventBus.emit("session.context.bind", { sessionId: s!.id, path: item.path, type: item.type });
				const name = item.path.replace(/\/$/, "").split("/").pop() ?? item.path;
				void eventBus.emit("notice.success", { message: `Added "${name}" as ${item.type} context` });
			}
		}
		const modal = new PickerModal(app);
		modal.setPlaceholder("Search for a file or folder to bind...");
		modal.open();
	});
	workspace.addEventListener("decision-record", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.decision.record", { sessionId: s.id, title: e.detail.title }); }) as EventListener);
	workspace.addEventListener("decision-remove", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.decision.remove", { sessionId: s.id, decisionId: e.detail.decisionId }); }) as EventListener);
	workspace.addEventListener("reflection-add", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.reflection.add", { sessionId: s.id, type: e.detail.type, content: e.detail.content }); }) as EventListener);
	workspace.addEventListener("reflection-remove", ((e: CustomEvent) => { const s = getSession(); if (s) void eventBus.emit("session.reflection.remove", { sessionId: s.id, entryId: e.detail.entryId }); }) as EventListener);
	workspace.addEventListener("output-open", ((e: CustomEvent) => { openInAdjacentLeaf(buildHelperContext(), e.detail.path); }) as EventListener);
	workspace.addEventListener("output-generate", () => { openOutputPicker(buildHelperContext()); });
	workspace.addEventListener("closure-submit", ((e: CustomEvent) => {
		const s = getSession(); if (!s) return;
		const answers = e.detail.answers as Record<string, string>;
		const response: ClosureResponse = {
			outcomeAchieved: (answers["outcome"] as ClosureResponse["outcomeAchieved"]) ?? "partial",
			whatWorked: answers["what-worked"] ?? "", whatDidnt: answers["what-didnt"] ?? "",
			nextAction: answers["next-action"] ?? "", answers,
		};
		void sessionService.completeClosure(s.id, response);
	}) as EventListener);
	workspace.addEventListener("closure-skip", () => { const s = getSession(); if (s) void sessionService.skipClosure(s.id); });
}

// ── Train closure helpers ─────────────────────────────────

interface TrainLike {
	createdAt: string;
	completedAt: string | null;
	pausedAt: string | null;
	thoughts: Array<{ id: string; title: string }>;
	relations: Array<{ fromId: string; toId: string; direction: string }>;
}

function computeTrainElapsed(train: TrainLike): string {
	if (!train.createdAt) return "\u2014";
	const start = new Date(train.createdAt).getTime();
	const end = train.completedAt
		? new Date(train.completedAt).getTime()
		: (train.pausedAt ? new Date(train.pausedAt).getTime() : Date.now());
	return `${Math.floor(Math.max(0, end - start) / 60_000)} min`;
}

function collectKeyThoughts(train: TrainLike): string[] {
	const { thoughts, relations } = train;
	const titles: string[] = [];
	const seen = new Set<string>();
	if (thoughts.length > 0) {
		let head = thoughts[0];
		for (;;) {
			const next = relations.find((r) => r.fromId === head.id && r.direction === "next");
			if (!next) break;
			const nextNode = thoughts.find((t) => t.id === next.toId);
			if (!nextNode) break;
			head = nextNode;
		}
		titles.push(head.title);
		seen.add(head.id);
	}
	for (const dir of ["branch", "merge"] as const) {
		for (const rel of relations) {
			if (titles.length >= 5) break;
			if (rel.direction === dir) {
				const node = thoughts.find((t) => t.id === rel.toId);
				if (node && !seen.has(node.id)) { titles.push(node.title); seen.add(node.id); }
			}
		}
	}
	return titles.slice(0, 5);
}
