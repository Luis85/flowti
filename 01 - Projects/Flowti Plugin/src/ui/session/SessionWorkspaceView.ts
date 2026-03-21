/**
 * Session Workspace View — a dedicated focused leaf for active sessions.
 *
 * Extends ItemView directly (not BaseHubView) because it renders a
 * single-session workspace rather than a tabbed hub shell.
 *
 * Layout: header → timer → goals → execution plan → notes → focus file → artifacts.
 * All mutations go through the EventBus; the view is purely reactive.
 *
 * Panel components extracted to src/ui/session/:
 *   SessionTimerPanel, SessionGoalsPanel, SessionExecutionPanel,
 *   SessionNotesPanel, SessionContextPanel, SessionActivityPanel
 *
 * Event subscriptions: SessionWorkspaceSubscriptions.ts (~230 LOC)
 * Helper functions:    SessionWorkspaceHelpers.ts (~150 LOC)
 */

import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { SessionService } from "../../domain/session/SessionService";
import type { Session } from "../../domain/session/types";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "../userHub/types";
import type { SessionPanelDeps } from "./types";
import { SessionTimerPanel } from "./SessionTimerPanel";
import { SessionGoalsPanel } from "./SessionGoalsPanel";
import { SessionExecutionPanel } from "./SessionExecutionPanel";
import { SessionNotesPanel } from "./SessionNotesPanel";
import { SessionContextPanel } from "./SessionContextPanel";
import { SessionActivityPanel } from "./SessionActivityPanel";
import { SessionGuidingQuestions } from "./SessionGuidingQuestions";
import { SessionDecisionPanel } from "./SessionDecisionPanel";
import { SessionReflectionPanel } from "./SessionReflectionPanel";
import { SessionOutputPanel } from "./SessionOutputPanel";
import { type ClosureTemplate, type SessionTypeConfig, type SessionOutputTemplate, SESSION_TYPE_CONFIGS } from "../../domain/session/types";
import { SessionClosureOverlay } from "./SessionClosureOverlay";
import { TrainClosurePanel } from "./TrainClosurePanel";
import { SessionEnergyIndicator } from "./SessionEnergyIndicator";
import { CognitiveLoadAlert } from "./CognitiveLoadAlert";
import { SessionActivityIntelligencePanel } from "./SessionActivityIntelligencePanel";
import { resolveClosureTemplate } from "../../domain/session/helpers";
import { setupEventSubscriptions } from "./SessionWorkspaceSubscriptions";
import type { SubscriptionViewContext } from "./SessionWorkspaceSubscriptions";
import {
	getStatusClass, captureWorkspaceState, restoreWorkspaceState,
	openOutputPicker, openSaveTemplateModal, openInTab, openInSidebar,
	revealInFileExplorer, openInAdjacentLeaf,
} from "./SessionWorkspaceHelpers";
import type { WorkspaceHelperContext } from "./SessionWorkspaceHelpers";
import { renderFocusFile, renderNotesFile, renderCanvasFile } from "./SessionWorkspaceFileSections";

// Re-export for backward compat (canonical location: session/types.ts)
export { VIEW_TYPE_SESSION_WORKSPACE } from "./types";
import { VIEW_TYPE_SESSION_WORKSPACE } from "./types";

export class SessionWorkspaceView extends ItemView {
	private eventBus: IEventBus;
	private sessionService: SessionService;
	private unsubscribes: (() => void)[] = [];
	private session: Session | null = null;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private panelRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingPanelRefreshes = new Set<string>();

	// Panels
	private timerPanel: SessionTimerPanel | null = null;
	private energyPanel: SessionEnergyIndicator | null = null;
	private guidingPanel: SessionGuidingQuestions | null = null;
	private goalsPanel: SessionGoalsPanel | null = null;
	private executionPanel: SessionExecutionPanel | null = null;
	private overloadAlert: CognitiveLoadAlert | null = null;
	private notesPanel: SessionNotesPanel | null = null;
	private contextPanel: SessionContextPanel | null = null;
	private decisionPanel: SessionDecisionPanel | null = null;
	private reflectionPanel: SessionReflectionPanel | null = null;
	private activityPanel: SessionActivityPanel | null = null;
	private intelligencePanel: SessionActivityIntelligencePanel | null = null;
	private outputPanel: SessionOutputPanel | null = null;

	/** Custom session type configs injected from main.ts (synced from SessionService). */
	customSessionTypes: Record<string, SessionTypeConfig> = {};
	/** Optional TrainService — used to show train context in closure overlay. */
	trainService?: import("../../domain/train/TrainService").TrainService;
	/** Custom output templates injected from settings. */
	customOutputTemplates: readonly SessionOutputTemplate[] = [];

	// DOM refs for header (not extracted — tightly coupled to lifecycle actions)
	private headerStatusEl: HTMLElement | null = null;
	private actionsEl: HTMLElement | null = null;
	private adjacentLeaf: WorkspaceLeaf | null = null;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, sessionService: SessionService) {
		super(leaf);
		this.eventBus = eventBus;
		this.sessionService = sessionService;
	}

	getViewType(): string {
		return VIEW_TYPE_SESSION_WORKSPACE;
	}

	getDisplayText(): string {
		return this.session ? `Session: ${this.session.title}` : "Session Workspace";
	}

	getIcon(): string {
		return "timer";
	}

	async onOpen(): Promise<void> {
		this.containerEl.addClass("ft-hide-header");

		const targetId = this.sessionService.workspaceSessionId;
		this.session = targetId
			? this.sessionService.getSessionById(targetId)
			: this.sessionService.getActiveSession();

		if (this.session) {
			this.sessionService.workspaceSessionId = this.session.id;
		}

		this.render();
		this.unsubscribes = setupEventSubscriptions(this.buildSubscriptionContext(), this.eventBus);
	}

	async setState(state: Record<string, unknown>, result: import("obsidian").ViewStateResult): Promise<void> {
		if (state?.sessionId && typeof state.sessionId === "string") {
			this.sessionService.workspaceSessionId = state.sessionId;
			this.session = this.sessionService.getSessionById(state.sessionId) ?? null;
			this.render();
		}
		await super.setState(state, result);
	}

	getState(): Record<string, unknown> {
		return { sessionId: this.session?.id ?? null };
	}

	async onClose(): Promise<void> {
		if (this.renderTimer !== null) { clearTimeout(this.renderTimer); this.renderTimer = null; }
		if (this.panelRefreshTimer !== null) { clearTimeout(this.panelRefreshTimer); this.panelRefreshTimer = null; }
		this.pendingPanelRefreshes.clear();
		if (this.session && this.sessionService.workspaceSessionId === this.session.id) {
			this.sessionService.workspaceSessionId = null;
		}
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.notesPanel?.destroy();
	}

	updateTimerDisplay(remainingMs: number): void {
		this.timerPanel?.updateDisplay(remainingMs);
	}

	// ── Render scheduling ────────────────────────────────────

	/**
	 * Debounced render — coalesces multiple render requests within 16ms
	 * into a single DOM rebuild. Mirrors BaseHubView.scheduleRender().
	 */
	scheduleRender(): void {
		if (this.renderTimer !== null) clearTimeout(this.renderTimer);
		this.renderTimer = setTimeout(() => {
			this.renderTimer = null;
			this.render();
		}, 16);
	}

	/**
	 * Debounced panel refresh — coalesces multiple panel refresh requests
	 * within 16ms into a single batch. Avoids redundant per-panel updates
	 * when multiple events fire in quick succession (e.g. reverse sync).
	 */
	schedulePanelRefresh(panelId: string): void {
		this.pendingPanelRefreshes.add(panelId);
		if (this.panelRefreshTimer !== null) return;
		this.panelRefreshTimer = setTimeout(() => {
			this.panelRefreshTimer = null;
			const pending = new Set(this.pendingPanelRefreshes);
			this.pendingPanelRefreshes.clear();
			for (const id of pending) this.refreshPanel(id);
		}, 16);
	}

	private refreshPanel(id: string): void {
		const handlers: Record<string, () => void> = {
			goals: () => this.goalsPanel?.refreshGoals(),
			tasks: () => this.executionPanel?.refreshTasks(),
			notes: () => this.notesPanel?.updateNotes(this.session?.notes ?? ""),
			activity: () => this.activityPanel?.refreshList(),
			decisions: () => this.decisionPanel?.refreshList(),
			reflections: () => this.reflectionPanel?.refreshList(),
			energy: () => this.energyPanel?.refreshEnergy(),
			intelligence: () => this.intelligencePanel?.refreshStats(),
			output: () => this.outputPanel?.refreshList(),
			overload: () => this.overloadAlert?.refreshAlert(),
			actions: () => this.renderActions(),
		};
		handlers[id]?.();
	}

	// ── Rendering ────────────────────────────────────────────

	private refreshSession(): Session {
		return (this.session
			? this.sessionService.getSessionById(this.session.id)
			: this.sessionService.getActiveSession()) ?? this.session!;
	}

	private createPanelDeps(): SessionPanelDeps {
		const ctx = this.buildHelperContext();
		return {
			eventBus: this.eventBus,
			getSession: () => this.session!,
			app: this.app,
			openFile: (path) => openInAdjacentLeaf(ctx, path),
			revealFolder: (path) => revealInFileExplorer(ctx, path),
			updateActivityFilter: (id, filter) => this.sessionService.updateActivityFilter(id, filter),
			getGlobalActivityFilter: () => this.sessionService.globalActivityFilter,
		};
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("ft-session-workspace");

		if (!this.session) {
			this.renderEmptyState(container);
			return;
		}

		const deps = this.createPanelDeps();

		this.renderHeader(container);

		// FR-14: Closure overlay replaces normal panels when reviewing
		if (this.session.status === "reviewing") {
			this.renderClosureOverlay(container);
			return;
		}

		// Only show timer for timed sessions (durationMinutes > 0)
		if (this.session.durationMinutes > 0) {
			this.timerPanel = new SessionTimerPanel(container, deps);
			this.timerPanel.render();
		}

		this.energyPanel = new SessionEnergyIndicator(container, deps);
		this.energyPanel.render();

		this.intelligencePanel = new SessionActivityIntelligencePanel(container, deps);
		this.intelligencePanel.render();

		if (this.session.status === "active" || this.session.status === "running" || this.session.status === "paused") {
			this.guidingPanel = new SessionGuidingQuestions(container, deps, this.customSessionTypes);
			this.guidingPanel.render();
		}

		this.goalsPanel = new SessionGoalsPanel(container, deps);
		this.goalsPanel.render();

		this.executionPanel = new SessionExecutionPanel(container, deps);
		this.executionPanel.render();

		this.overloadAlert = new CognitiveLoadAlert(container, deps);
		this.overloadAlert.render();

		this.notesPanel = new SessionNotesPanel(container, deps);
		this.notesPanel.render();

		const ctx = this.buildHelperContext();
		renderFocusFile(container, this.session, ctx);
		renderNotesFile(container, this.session, this.app, this.eventBus, this.sessionService, ctx);
		renderCanvasFile(container, this.session, this.app, this.eventBus, ctx);

		this.contextPanel = new SessionContextPanel(container, deps);
		this.contextPanel.render();

		this.decisionPanel = new SessionDecisionPanel(container, deps);
		this.decisionPanel.render();

		this.reflectionPanel = new SessionReflectionPanel(container, deps);
		this.reflectionPanel.render();

		this.activityPanel = new SessionActivityPanel(container, deps);
		this.activityPanel.render();

		if (this.session.status === "completed" || this.session.status === "archived") {
			const ctx = this.buildHelperContext();
			this.outputPanel = new SessionOutputPanel(container, deps, () => openOutputPicker(ctx));
			this.outputPanel.render();
		}
	}

	private renderClosureOverlay(container: HTMLElement): void {
		const session = this.session!;

		// Train context panel — show train journey stats when session originated from a train
		if (this.trainService) {
			const train = this.trainService.getAllTrains().find((t) => t.sessionId === session.id);
			if (train) {
				new TrainClosurePanel(container, train).render();
			}
		}

		const template = resolveClosureTemplate(session, undefined, this.getTypeClosureTemplates());
		const overlay = new SessionClosureOverlay(container, session, template, {
			onSubmit: (response) => {
				void this.sessionService.completeClosure(session.id, response);
			},
			onSkip: () => {
				void this.sessionService.skipClosure(session.id);
			},
		});
		overlay.render();
	}

	private getTypeClosureTemplates(): Record<string, ClosureTemplate> | undefined {
		const result: Record<string, ClosureTemplate> = {};
		let hasAny = false;

		// Include built-in type configs with closure templates
		for (const [type, config] of Object.entries(SESSION_TYPE_CONFIGS)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}

		// Custom types override built-in
		for (const [type, config] of Object.entries(this.customSessionTypes)) {
			if (config.closureTemplate) {
				result[type] = config.closureTemplate;
				hasAny = true;
			}
		}

		return hasAny ? result : undefined;
	}

	private renderEmptyState(container: HTMLElement): void {
		const empty = container.createDiv({ cls: "ft-session-workspace-empty" });

		const iconEl = empty.createDiv({ cls: "ft-session-empty-icon" });
		setIcon(iconEl, "timer-off");

		empty.createEl("p", { text: "No session selected", cls: "ft-text-lg" });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
	empty.createEl("p", { text: "Open a session from the User hub → sessions tab.", cls: "ft-text-sm" });
	}

	// ── Header + Actions ──────────────────────────────────────

	private renderHeader(container: HTMLElement): void {
		const session = this.session!;
		const header = container.createDiv({ cls: "ft-session-workspace-header ft-section" });

		const titleRow = header.createDiv({ cls: "ft-session-header-title-row" });

		titleRow.createEl("h4", { text: session.title });
		titleRow.createEl("span", {
			text: SESSION_TYPE_LABELS[session.type] ?? session.type,
			cls: "ft-badge ft-session-type-badge",
		});

		this.headerStatusEl = titleRow.createEl("span", {
			text: SESSION_STATUS_LABELS[session.status] ?? session.status,
			cls: `ft-badge ft-badge-status ft-session-status-badge ft-status-${getStatusClass(session.status)}`,
		});

		this.actionsEl = header.createDiv({ cls: "ft-session-workspace-actions" });
		this.renderActions();
	}

	private renderActions(): void {
		if (!this.actionsEl || !this.session) return;
		this.actionsEl.empty();
		const session = this.session;
		const ctx = this.buildHelperContext();

		if (session.status === "active" || session.status === "running") {
			this.createActionButton(this.actionsEl, "pause", "Pause", () => {
				void this.eventBus.emit("session.pause", { sessionId: session.id });
			});
			this.createActionButton(this.actionsEl, "check-circle", "Complete", () => {
				void this.eventBus.emit("session.complete", { sessionId: session.id });
			});
		} else if (session.status === "paused") {
			this.createActionButton(this.actionsEl, "play", "Resume", () => {
				void this.eventBus.emit("session.resume", { sessionId: session.id });
			});
			this.createActionButton(this.actionsEl, "check-circle", "Complete", () => {
				void this.eventBus.emit("session.complete", { sessionId: session.id });
			});
		} else if (session.status === "prepared" && !this.sessionService.getActiveSession()) {
			this.createActionButton(this.actionsEl, "play", "Start", () => {
				if (this.sessionService.getActiveSession()) {
					void this.eventBus.emit("notice.error", { message: "Another session is already active. Complete or pause it first." });
					return;
				}
				void this.eventBus.emit("session.start", { sessionId: session.id });
			});
		}

		this.createActionButton(this.actionsEl, "bookmark", "Save as Template", () => {
			openSaveTemplateModal(ctx, session);
		});

		if (this.leaf.getRoot() !== this.app.workspace.rightSplit) {
			this.createActionButton(this.actionsEl, "panel-right", "Sidebar", () => {
				openInSidebar(ctx);
			});
		} else {
			this.createActionButton(this.actionsEl, "layout", "Open in Tab", () => {
				openInTab(ctx);
			});
		}
	}

	private createActionButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const btn = parent.createEl("button", { text: label, cls: "ft-session-action-btn" });
		const iconEl = btn.createSpan();
		setIcon(iconEl, icon);
		btn.prepend(iconEl);
		btn.addEventListener("click", onClick);
	}

	// ── Context builders ─────────────────────────────────────

	private buildSubscriptionContext(): SubscriptionViewContext {
		return {
			getSession: () => this.session,
			setSession: (s) => { this.session = s; },
			refreshSession: () => this.refreshSession(),
			render: () => this.render(),
			scheduleRender: () => this.scheduleRender(),
			schedulePanelRefresh: (id) => this.schedulePanelRefresh(id),
			renderActions: () => this.renderActions(),
			captureWorkspaceState: (id) => captureWorkspaceState(this.buildHelperContext(), id),
			restoreWorkspaceState: (id, state) => restoreWorkspaceState(this.buildHelperContext(), id, state),
			getTimerPanel: () => this.timerPanel,
			getEnergyPanel: () => this.energyPanel,
			getGoalsPanel: () => this.goalsPanel,
			getExecutionPanel: () => this.executionPanel,
			getNotesPanel: () => this.notesPanel,
			getActivityPanel: () => this.activityPanel,
			getDecisionPanel: () => this.decisionPanel,
			getReflectionPanel: () => this.reflectionPanel,
			getOutputPanel: () => this.outputPanel,
			getOverloadAlert: () => this.overloadAlert,
		};
	}

	private buildHelperContext(): WorkspaceHelperContext {
		return {
			app: this.app,
			eventBus: this.eventBus,
			leaf: this.leaf,
			getSession: () => this.session,
			getAdjacentLeaf: () => this.adjacentLeaf,
			setAdjacentLeaf: (l) => { this.adjacentLeaf = l; },
			customOutputTemplates: this.customOutputTemplates,
			sessionService: this.sessionService,
		};
	}
}
