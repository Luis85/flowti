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

import { ItemView, Notice, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { SessionService } from "../domain/session/SessionService";
import type { Session } from "../domain/session/types";
import { generateSessionSummary } from "../domain/session/helpers";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "./userHub/types";
import type { SessionPanelDeps } from "./session/types";
import { SessionTimerPanel } from "./session/SessionTimerPanel";
import { SessionGoalsPanel } from "./session/SessionGoalsPanel";
import { SessionExecutionPanel } from "./session/SessionExecutionPanel";
import { SessionNotesPanel } from "./session/SessionNotesPanel";
import { SessionContextPanel } from "./session/SessionContextPanel";
import { SessionActivityPanel } from "./session/SessionActivityPanel";
import { SessionGuidingQuestions } from "./session/SessionGuidingQuestions";
import { SessionDecisionPanel } from "./session/SessionDecisionPanel";
import { SessionReflectionPanel } from "./session/SessionReflectionPanel";
import { SessionOutputPanel } from "./session/SessionOutputPanel";
import { type ClosureTemplate, type SessionTypeConfig, type SessionOutputTemplate, SESSION_TYPE_CONFIGS } from "../domain/session/types";
import { SessionClosureOverlay } from "./session/SessionClosureOverlay";
import { SessionEnergyIndicator } from "./session/SessionEnergyIndicator";
import { CognitiveLoadAlert } from "./session/CognitiveLoadAlert";
import { SessionActivityIntelligencePanel } from "./session/SessionActivityIntelligencePanel";
import { resolveClosureTemplate } from "../domain/session/helpers";
import { setupEventSubscriptions } from "./session/SessionWorkspaceSubscriptions";
import type { SubscriptionViewContext } from "./session/SessionWorkspaceSubscriptions";
import {
	getStatusStyle, captureWorkspaceState, restoreWorkspaceState,
	openOutputPicker, openSaveTemplateModal, openInTab, openInSidebar,
	revealInFileExplorer, openInAdjacentLeaf,
} from "./session/SessionWorkspaceHelpers";
import type { WorkspaceHelperContext } from "./session/SessionWorkspaceHelpers";

// Re-export for backward compat (canonical location: session/types.ts)
export { VIEW_TYPE_SESSION_WORKSPACE } from "./session/types";
import { VIEW_TYPE_SESSION_WORKSPACE } from "./session/types";

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
			for (const id of pending) {
				switch (id) {
					case "goals": this.goalsPanel?.refreshGoals(); break;
					case "tasks": this.executionPanel?.refreshTasks(); break;
					case "notes": this.notesPanel?.updateNotes(this.session?.notes ?? ""); break;
					case "activity": this.activityPanel?.refreshList(); break;
					case "decisions": this.decisionPanel?.refreshList(); break;
					case "reflections": this.reflectionPanel?.refreshList(); break;
					case "energy": this.energyPanel?.refreshEnergy(); break;
					case "intelligence": this.intelligencePanel?.refreshStats(); break;
					case "output": this.outputPanel?.refreshList(); break;
					case "overload": this.overloadAlert?.refreshAlert(); break;
					case "actions": this.renderActions(); break;
				}
			}
		}, 16);
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

		this.renderFocusFile(container);
		this.renderNotesFile(container);
		this.renderCanvasFile(container);

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
		empty.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:48px 24px;color:var(--text-muted);";

		const iconEl = empty.createDiv();
		setIcon(iconEl, "timer-off");
		iconEl.style.cssText = "opacity:0.4;";
		(iconEl.firstChild as HTMLElement)?.style.setProperty("width", "48px");
		(iconEl.firstChild as HTMLElement)?.style.setProperty("height", "48px");

		empty.createEl("p", { text: "No session selected", cls: "ft-text-lg" });
		empty.createEl("p", { text: "Open a session from the User Hub → Sessions tab.", cls: "ft-text-sm" });
	}

	// ── Header + Actions ──────────────────────────────────────

	private renderHeader(container: HTMLElement): void {
		const session = this.session!;
		const header = container.createDiv({ cls: "ft-session-workspace-header ft-section" });

		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		titleRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";

		titleRow.createEl("h4", { text: session.title });
		titleRow.createEl("span", {
			text: SESSION_TYPE_LABELS[session.type] ?? session.type,
			cls: "ft-badge",
		}).style.cssText = "background:var(--background-modifier-hover);padding:2px 8px;border-radius:4px;font-size:12px;";

		this.headerStatusEl = titleRow.createEl("span", {
			text: SESSION_STATUS_LABELS[session.status] ?? session.status,
			cls: "ft-badge ft-badge-status",
		});
		this.headerStatusEl.style.cssText = "padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;" + getStatusStyle(session.status);

		this.actionsEl = header.createDiv({ cls: "ft-session-workspace-actions" });
		this.actionsEl.style.cssText = "display:flex;gap:8px;";
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
					new Notice("Another session is already active. Complete or pause it first.");
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
		const btn = parent.createEl("button", { text: label });
		btn.style.cssText = "display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:13px;";
		const iconEl = btn.createSpan();
		setIcon(iconEl, icon);
		btn.prepend(iconEl);
		btn.addEventListener("click", onClick);
	}

	// ── File Sections ─────────────────────────────────────────

	private renderFocusFile(container: HTMLElement): void {
		const session = this.session!;
		if (!session.focusFile || session.focusFile === session.notesFile) return;

		const section = container.createDiv({ cls: "ft-session-workspace-focus ft-section" });
		section.style.cssText = "display:flex;align-items:center;gap:8px;";

		const iconEl = section.createSpan();
		setIcon(iconEl, "file-text");

		section.createEl("span", { text: "Focus:" }).style.cssText = "font-weight:600;";

		const ctx = this.buildHelperContext();
		const link = section.createEl("a", { text: session.focusFile, cls: "ft-focus-link" });
		link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);";
		link.addEventListener("click", (e) => {
			e.preventDefault();
			openInAdjacentLeaf(ctx, session.focusFile!);
		});
	}

	private renderNotesFile(container: HTMLElement): void {
		const session = this.session!;
		if (!session.notesFile) return;

		const section = container.createDiv({ cls: "ft-session-workspace-notesfile ft-section" });
		section.style.cssText = "display:flex;align-items:center;gap:8px;";

		const iconEl = section.createSpan();
		setIcon(iconEl, "file-text");

		section.createEl("span", { text: "Session Note:" }).style.cssText = "font-weight:600;";

		const name = session.notesFile.split("/").pop() ?? session.notesFile;
		const link = section.createEl("a", { text: name, cls: "ft-notesfile-link" });
		link.title = session.notesFile;
		link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);";
		link.addEventListener("click", (e) => {
			e.preventDefault();
			void this.openOrCreateNotesFile(session);
		});

		const copyBtn = section.createEl("button", { cls: "ft-copy-path-btn clickable-icon" });
		copyBtn.title = "Copy vault path to clipboard";
		copyBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
		setIcon(copyBtn, "clipboard-copy");
		copyBtn.addEventListener("click", () => {
			void navigator.clipboard.writeText(session.notesFile!).then(() => {
				setIcon(copyBtn, "check");
				copyBtn.style.opacity = "1";
				copyBtn.style.color = "var(--text-success)";
				setTimeout(() => {
					setIcon(copyBtn, "clipboard-copy");
					copyBtn.style.opacity = "0.5";
					copyBtn.style.color = "var(--text-muted)";
				}, 1500);
			});
		});
	}

	private async openOrCreateNotesFile(session: Session): Promise<void> {
		const path = session.notesFile!;
		const exists = this.app.vault.getAbstractFileByPath(path);

		if (!exists) {
			const folder = path.substring(0, path.lastIndexOf("/"));
			if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			try {
				await this.app.vault.create(path, generateSessionSummary(session, this.sessionService.globalActivityFilter));
			} catch {
				// File already exists on disk — proceed to open
			}
		}

		openInAdjacentLeaf(this.buildHelperContext(), path);
	}

	private renderCanvasFile(container: HTMLElement): void {
		const session = this.session!;

		const section = container.createDiv({ cls: "ft-session-workspace-canvas ft-section" });
		section.style.cssText = "display:flex;align-items:center;gap:8px;";

		if (session.canvasFile) {
			const iconEl = section.createSpan();
			setIcon(iconEl, "layout-dashboard");

			section.createEl("span", { text: "Session Canvas:" }).style.cssText = "font-weight:600;";

			const name = session.canvasFile.split("/").pop() ?? session.canvasFile;
			const link = section.createEl("a", { text: name, cls: "ft-canvasfile-link" });
			link.title = session.canvasFile;
			link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);";
			link.addEventListener("click", (e) => {
				e.preventDefault();
				openInAdjacentLeaf(this.buildHelperContext(), session.canvasFile!);
			});
		} else {
			const btn = section.createEl("button", { text: "Create Session Canvas", cls: "ft-canvasfile-create" });
			btn.style.cssText = "display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:13px;";
			const iconEl = btn.createSpan();
			setIcon(iconEl, "layout-dashboard");
			btn.prepend(iconEl);
			btn.addEventListener("click", () => {
				btn.setText("Creating...");
				btn.disabled = true;
				void this.createAndLinkCanvas(session);
			});
		}
	}

	private async createAndLinkCanvas(session: Session): Promise<void> {
		const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
		const shortId = session.id.slice(-6);
		const folder = session.notesFile
			? session.notesFile.substring(0, session.notesFile.lastIndexOf("/"))
			: "03 - Resources/Sessions";
		const path = `${folder}/${safeName} (${shortId}).canvas`;

		const exists = this.app.vault.getAbstractFileByPath(path);
		if (!exists) {
			if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			try {
				await this.app.vault.create(path, '{\n\t"nodes":[],\n\t"edges":[]\n}');
			} catch {
				// File already exists on disk — proceed to open
			}
		}

		void this.eventBus.emit("session.canvasFile.set", { sessionId: session.id, path });
		new Notice(`Canvas created: ${path.split("/").pop()}`);

		if (session.notesFile) {
			await this.appendCanvasLinkToNotes(session.notesFile, path);
		}

		openInAdjacentLeaf(this.buildHelperContext(), path);
	}

	private async appendCanvasLinkToNotes(notesPath: string, canvasPath: string): Promise<void> {
		let file = this.app.vault.getAbstractFileByPath(notesPath);
		if (!file) {
			const folder = notesPath.substring(0, notesPath.lastIndexOf("/"));
			if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			try {
				const title = this.session?.title ?? "Session";
				await this.app.vault.create(notesPath, `# ${title}\n\n## Canvas\n![[${canvasPath}]]\n`);
				return;
			} catch {
				file = this.app.vault.getAbstractFileByPath(notesPath);
				if (!file) return;
			}
		}
		const existing = await this.app.vault.read(file as import("obsidian").TFile);
		const embed = `![[${canvasPath}]]`;
		if (!existing.includes(embed)) {
			await this.app.vault.modify(file as import("obsidian").TFile, existing + `\n## Canvas\n${embed}\n`);
		}
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
