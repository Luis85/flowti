/**
 * Sitemap-driven handler for the Session Workspace.
 *
 * Orchestrates the same session workspace UI as the legacy
 * SessionWorkspaceView, but as a handler function registered
 * in the PluginHandlerRegistry.
 *
 * Reuses ALL existing panel components:
 *   SessionTimerPanel, SessionGoalsPanel, SessionExecutionPanel,
 *   SessionNotesPanel, SessionContextPanel, SessionActivityPanel,
 *   SessionGuidingQuestions, SessionDecisionPanel, SessionReflectionPanel,
 *   SessionOutputPanel, SessionEnergyIndicator, CognitiveLoadAlert,
 *   SessionActivityIntelligencePanel, SessionClosureOverlay, TrainClosurePanel
 *
 * Event subscriptions: SessionWorkspaceSubscriptions.ts
 * Helper functions:    SessionWorkspaceHelpers.ts
 */

import type { App, WorkspaceLeaf } from "obsidian";
import { setIcon } from "obsidian";
import type { IEventBus } from "../../events/types";
import type { SessionService } from "../../../domain/session/SessionService";
import type { TrainService } from "../../../domain/train/TrainService";
import type { Session, SessionTypeConfig, SessionOutputTemplate, ClosureTemplate } from "../../../domain/session/types";
import { SESSION_TYPE_CONFIGS } from "../../../domain/session/types";
import { resolveClosureTemplate } from "../../../domain/session/helpers";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "../../../ui/userHub/types";
import type { SessionPanelDeps } from "../../../ui/session/types";
import { SessionTimerPanel } from "../../../ui/session/SessionTimerPanel";
import { SessionGoalsPanel } from "../../../ui/session/SessionGoalsPanel";
import { SessionExecutionPanel } from "../../../ui/session/SessionExecutionPanel";
import { SessionNotesPanel } from "../../../ui/session/SessionNotesPanel";
import { SessionContextPanel } from "../../../ui/session/SessionContextPanel";
import { SessionActivityPanel } from "../../../ui/session/SessionActivityPanel";
import { SessionGuidingQuestions } from "../../../ui/session/SessionGuidingQuestions";
import { SessionDecisionPanel } from "../../../ui/session/SessionDecisionPanel";
import { SessionReflectionPanel } from "../../../ui/session/SessionReflectionPanel";
import { SessionOutputPanel } from "../../../ui/session/SessionOutputPanel";
import { SessionClosureOverlay } from "../../../ui/session/SessionClosureOverlay";
import { TrainClosurePanel } from "../../../ui/session/TrainClosurePanel";
import { SessionEnergyIndicator } from "../../../ui/session/SessionEnergyIndicator";
import { CognitiveLoadAlert } from "../../../ui/session/CognitiveLoadAlert";
import { SessionActivityIntelligencePanel } from "../../../ui/session/SessionActivityIntelligencePanel";
import { setupEventSubscriptions } from "../../../ui/session/SessionWorkspaceSubscriptions";
import type { SubscriptionViewContext } from "../../../ui/session/SessionWorkspaceSubscriptions";
import {
	getStatusClass, captureWorkspaceState, restoreWorkspaceState,
	openOutputPicker, openSaveTemplateModal, openInTab, openInSidebar,
	openInAdjacentLeaf, revealInFileExplorer,
} from "../../../ui/session/SessionWorkspaceHelpers";
import type { WorkspaceHelperContext } from "../../../ui/session/SessionWorkspaceHelpers";
import type { PluginHandlerRegistry, TabContext } from "../plugin-handler-registry";

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
	let panelRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	const pendingPanelRefreshes = new Set<string>();
	let unsubscribes: (() => void)[] = [];
	let adjacentLeaf: WorkspaceLeaf | null = null;

	// ── Panel refs ────────────────────────────────────────
	let timerPanel: SessionTimerPanel | null = null;
	let energyPanel: SessionEnergyIndicator | null = null;
	let guidingPanel: SessionGuidingQuestions | null = null;
	let goalsPanel: SessionGoalsPanel | null = null;
	let executionPanel: SessionExecutionPanel | null = null;
	let overloadAlert: CognitiveLoadAlert | null = null;
	let notesPanel: SessionNotesPanel | null = null;
	let contextPanel: SessionContextPanel | null = null;
	let decisionPanel: SessionDecisionPanel | null = null;
	let reflectionPanel: SessionReflectionPanel | null = null;
	let activityPanel: SessionActivityPanel | null = null;
	let intelligencePanel: SessionActivityIntelligencePanel | null = null;
	let outputPanel: SessionOutputPanel | null = null;

	// ── DOM refs for header ───────────────────────────────
	let headerStatusEl: HTMLElement | null = null;
	let actionsEl: HTMLElement | null = null;

	// ── Helpers ───────────────────────────────────────────

	function refreshSession(): Session {
		return (session
			? sessionService.getSessionById(session.id)
			: sessionService.getActiveSession()) ?? session!;
	}

	function buildHelperContext(): WorkspaceHelperContext {
		return {
			app,
			eventBus,
			leaf,
			getSession: () => session,
			getAdjacentLeaf: () => adjacentLeaf,
			setAdjacentLeaf: (l) => { adjacentLeaf = l; },
			customOutputTemplates,
			sessionService,
		};
	}

	function createPanelDeps(): SessionPanelDeps {
		const ctx = buildHelperContext();
		return {
			eventBus,
			getSession: () => session!,
			app,
			openFile: (path) => openInAdjacentLeaf(ctx, path),
			revealFolder: (path) => revealInFileExplorer(ctx, path),
			updateActivityFilter: (id, filter) => sessionService.updateActivityFilter(id, filter),
			getGlobalActivityFilter: () => sessionService.globalActivityFilter,
		};
	}

	// ── Render scheduling ────────────────────────────────

	function scheduleRender(): void {
		if (renderTimer !== null) clearTimeout(renderTimer);
		renderTimer = setTimeout(() => {
			renderTimer = null;
			render();
		}, 16);
	}

	function schedulePanelRefresh(panelId: string): void {
		pendingPanelRefreshes.add(panelId);
		if (panelRefreshTimer !== null) return;
		panelRefreshTimer = setTimeout(() => {
			panelRefreshTimer = null;
			const pending = new Set(pendingPanelRefreshes);
			pendingPanelRefreshes.clear();
			for (const id of pending) {
				switch (id) {
					case "goals": goalsPanel?.refreshGoals(); break;
					case "tasks": executionPanel?.refreshTasks(); break;
					case "notes": notesPanel?.updateNotes(session?.notes ?? ""); break;
					case "activity": activityPanel?.refreshList(); break;
					case "decisions": decisionPanel?.refreshList(); break;
					case "reflections": reflectionPanel?.refreshList(); break;
					case "energy": energyPanel?.refreshEnergy(); break;
					case "intelligence": intelligencePanel?.refreshStats(); break;
					case "output": outputPanel?.refreshList(); break;
					case "overload": overloadAlert?.refreshAlert(); break;
					case "actions": renderActions(); break;
				}
			}
		}, 16);
	}

	// ── Action rendering ─────────────────────────────────

	function createActionButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const btn = parent.createEl("button", { text: label, cls: "ft-session-action-btn" });
		const iconEl = btn.createSpan();
		setIcon(iconEl, icon);
		btn.prepend(iconEl);
		btn.addEventListener("click", onClick);
	}

	function renderActions(): void {
		if (!actionsEl || !session) return;
		actionsEl.empty();
		const ctx = buildHelperContext();

		if (session.status === "active" || session.status === "running") {
			createActionButton(actionsEl, "pause", "Pause", () => {
				void eventBus.emit("session.pause", { sessionId: session!.id });
			});
			createActionButton(actionsEl, "check-circle", "Complete", () => {
				void eventBus.emit("session.complete", { sessionId: session!.id });
			});
		} else if (session.status === "paused") {
			createActionButton(actionsEl, "play", "Resume", () => {
				void eventBus.emit("session.resume", { sessionId: session!.id });
			});
			createActionButton(actionsEl, "check-circle", "Complete", () => {
				void eventBus.emit("session.complete", { sessionId: session!.id });
			});
		} else if (session.status === "prepared" && !sessionService.getActiveSession()) {
			createActionButton(actionsEl, "play", "Start", () => {
				if (sessionService.getActiveSession()) {
					void eventBus.emit("notice.error", { message: "Another session is already active. Complete or pause it first." });
					return;
				}
				void eventBus.emit("session.start", { sessionId: session!.id });
			});
		}

		createActionButton(actionsEl, "bookmark", "Save as Template", () => {
			openSaveTemplateModal(ctx, session!);
		});

		if (leaf.getRoot() !== app.workspace.rightSplit) {
			createActionButton(actionsEl, "panel-right", "Sidebar", () => {
				openInSidebar(ctx);
			});
		} else {
			createActionButton(actionsEl, "layout", "Open in Tab", () => {
				openInTab(ctx);
			});
		}
	}

	// ── Header ───────────────────────────────────────────

	function renderHeader(target: HTMLElement): void {
		const s = session!;
		const header = target.createDiv({ cls: "ft-session-workspace-header ft-section" });

		const titleRow = header.createDiv({ cls: "ft-session-header-title-row" });

		titleRow.createEl("h4", { text: s.title });
		titleRow.createEl("span", {
			text: SESSION_TYPE_LABELS[s.type] ?? s.type,
			cls: "ft-badge ft-session-type-badge",
		});

		headerStatusEl = titleRow.createEl("span", {
			text: SESSION_STATUS_LABELS[s.status] ?? s.status,
			cls: `ft-badge ft-badge-status ft-session-status-badge ft-status-${getStatusClass(s.status)}`,
		});

		actionsEl = header.createDiv({ cls: "ft-session-workspace-actions" });
		renderActions();
	}

	// ── File sections ────────────────────────────────────

	function renderFocusFile(target: HTMLElement): void {
		const s = session!;
		if (!s.focusFile || s.focusFile === s.notesFile) return;

		const section = target.createDiv({ cls: "ft-session-workspace-focus ft-section" });
		const iconEl = section.createSpan();
		setIcon(iconEl, "file-text");
		section.createEl("span", { text: "Focus:", cls: "ft-session-file-label" });

		const ctx = buildHelperContext();
		const link = section.createEl("a", { text: s.focusFile, cls: "ft-focus-link ft-session-file-link" });
		link.addEventListener("click", (e) => {
			e.preventDefault();
			openInAdjacentLeaf(ctx, s.focusFile!);
		});
	}

	function renderNotesFile(target: HTMLElement): void {
		const s = session!;
		if (!s.notesFile) return;

		const section = target.createDiv({ cls: "ft-session-workspace-notesfile ft-section" });
		const iconEl = section.createSpan();
		setIcon(iconEl, "file-text");
		section.createEl("span", { text: "Session note:", cls: "ft-session-file-label" });

		const name = s.notesFile.split("/").pop() ?? s.notesFile;
		const link = section.createEl("a", { text: name, cls: "ft-notesfile-link ft-session-file-link" });
		link.title = s.notesFile;
		link.addEventListener("click", (e) => {
			e.preventDefault();
			openInAdjacentLeaf(buildHelperContext(), s.notesFile!);
		});
	}

	function renderCanvasFile(target: HTMLElement): void {
		const s = session!;
		const section = target.createDiv({ cls: "ft-session-workspace-canvas ft-section" });

		if (s.canvasFile) {
			const iconEl = section.createSpan();
			setIcon(iconEl, "layout-dashboard");
			section.createEl("span", { text: "Session canvas:", cls: "ft-session-file-label" });

			const name = s.canvasFile.split("/").pop() ?? s.canvasFile;
			const link = section.createEl("a", { text: name, cls: "ft-canvasfile-link ft-session-file-link" });
			link.title = s.canvasFile;
			link.addEventListener("click", (e) => {
				e.preventDefault();
				openInAdjacentLeaf(buildHelperContext(), s.canvasFile!);
			});
		} else {
			const btn = section.createEl("button", { text: "Create session canvas", cls: "ft-canvasfile-create ft-session-action-btn" });
			const iconEl = btn.createSpan();
			setIcon(iconEl, "layout-dashboard");
			btn.prepend(iconEl);
		}
	}

	// ── Closure overlay ──────────────────────────────────

	function getTypeClosureTemplates(): Record<string, ClosureTemplate> | undefined {
		const result: Record<string, ClosureTemplate> = {};
		let hasAny = false;

		for (const [type, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}

		for (const [type, config] of Object.entries(customSessionTypes)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}

		return hasAny ? result : undefined;
	}

	function renderClosureOverlay(target: HTMLElement): void {
		const s = session!;

		if (deps.trainService) {
			const train = deps.trainService.getAllTrains().find((t) => t.sessionId === s.id);
			if (train) {
				new TrainClosurePanel(target, train).render();
			}
		}

		const template = resolveClosureTemplate(s, undefined, getTypeClosureTemplates());
		const overlay = new SessionClosureOverlay(target, s, template, {
			onSubmit: (response) => {
				void sessionService.completeClosure(s.id, response);
			},
			onSkip: () => {
				void sessionService.skipClosure(s.id);
			},
		});
		overlay.render();
	}

	// ── Empty state ──────────────────────────────────────

	function renderEmptyState(target: HTMLElement): void {
		const empty = target.createDiv({ cls: "ft-session-workspace-empty" });

		const iconEl = empty.createDiv({ cls: "ft-session-empty-icon" });
		setIcon(iconEl, "timer-off");

		empty.createEl("p", { text: "No session selected", cls: "ft-text-lg" });
		empty.createEl("p", { text: "Open a session from the User hub \u2192 sessions tab.", cls: "ft-text-sm" });
	}

	// ── Main render ──────────────────────────────────────

	function render(): void {
		container.empty();
		container.addClass("ft-session-workspace");

		if (!session) {
			renderEmptyState(container);
			return;
		}

		const panelDeps = createPanelDeps();

		renderHeader(container);

		// FR-14: Closure overlay replaces normal panels when reviewing
		if (session.status === "reviewing") {
			renderClosureOverlay(container);
			return;
		}

		// Only show timer for timed sessions (durationMinutes > 0)
		if (session.durationMinutes > 0) {
			timerPanel = new SessionTimerPanel(container, panelDeps);
			timerPanel.render();
		}

		energyPanel = new SessionEnergyIndicator(container, panelDeps);
		energyPanel.render();

		intelligencePanel = new SessionActivityIntelligencePanel(container, panelDeps);
		intelligencePanel.render();

		if (session.status === "active" || session.status === "running" || session.status === "paused") {
			guidingPanel = new SessionGuidingQuestions(container, panelDeps, customSessionTypes);
			guidingPanel.render();
		}

		goalsPanel = new SessionGoalsPanel(container, panelDeps);
		goalsPanel.render();

		executionPanel = new SessionExecutionPanel(container, panelDeps);
		executionPanel.render();

		overloadAlert = new CognitiveLoadAlert(container, panelDeps);
		overloadAlert.render();

		notesPanel = new SessionNotesPanel(container, panelDeps);
		notesPanel.render();

		renderFocusFile(container);
		renderNotesFile(container);
		renderCanvasFile(container);

		contextPanel = new SessionContextPanel(container, panelDeps);
		contextPanel.render();

		decisionPanel = new SessionDecisionPanel(container, panelDeps);
		decisionPanel.render();

		reflectionPanel = new SessionReflectionPanel(container, panelDeps);
		reflectionPanel.render();

		activityPanel = new SessionActivityPanel(container, panelDeps);
		activityPanel.render();

		if (session.status === "completed" || session.status === "archived") {
			const ctx = buildHelperContext();
			outputPanel = new SessionOutputPanel(container, panelDeps, () => openOutputPicker(ctx));
			outputPanel.render();
		}
	}

	// ── Subscription context ─────────────────────────────

	function buildSubscriptionContext(): SubscriptionViewContext {
		return {
			getSession: () => session,
			setSession: (s) => { session = s; },
			refreshSession: () => refreshSession(),
			render: () => render(),
			scheduleRender: () => scheduleRender(),
			schedulePanelRefresh: (id) => schedulePanelRefresh(id),
			renderActions: () => renderActions(),
			captureWorkspaceState: (id) => captureWorkspaceState(buildHelperContext(), id),
			restoreWorkspaceState: (id, state) => restoreWorkspaceState(buildHelperContext(), id, state),
			getTimerPanel: () => timerPanel,
			getEnergyPanel: () => energyPanel,
			getGoalsPanel: () => goalsPanel,
			getExecutionPanel: () => executionPanel,
			getNotesPanel: () => notesPanel,
			getActivityPanel: () => activityPanel,
			getDecisionPanel: () => decisionPanel,
			getReflectionPanel: () => reflectionPanel,
			getOutputPanel: () => outputPanel,
			getOverloadAlert: () => overloadAlert,
		};
	}

	// ── Initialize ───────────────────────────────────────

	const targetId = sessionService.workspaceSessionId;
	session = targetId
		? sessionService.getSessionById(targetId)
		: sessionService.getActiveSession();

	if (session) {
		sessionService.workspaceSessionId = session.id;
	}

	render();
	unsubscribes = setupEventSubscriptions(buildSubscriptionContext(), eventBus);

	// ── Cleanup function ─────────────────────────────────

	return function destroy(): void {
		if (renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null; }
		if (panelRefreshTimer !== null) { clearTimeout(panelRefreshTimer); panelRefreshTimer = null; }
		pendingPanelRefreshes.clear();
		if (session && sessionService.workspaceSessionId === session.id) {
			sessionService.workspaceSessionId = null;
		}
		for (const unsub of unsubscribes) unsub();
		unsubscribes = [];
		notesPanel?.destroy();
	};
}
