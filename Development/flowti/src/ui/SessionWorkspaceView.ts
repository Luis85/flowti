/**
 * Session Workspace View — a dedicated focused leaf for active sessions.
 *
 * Extends ItemView directly (not BaseHubView) because it renders a
 * single-session workspace rather than a tabbed hub shell.
 *
 * Layout: header → timer → goals → notes → focus file → artifacts.
 * All mutations go through the EventBus; the view is purely reactive.
 *
 * Panel components extracted to src/ui/session/:
 *   SessionTimerPanel, SessionGoalsPanel, SessionNotesPanel,
 *   SessionContextPanel, SessionActivityPanel
 */

import { ItemView, Notice, setIcon } from "obsidian";
import type { TAbstractFile, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { SessionService } from "../domain/session/SessionService";
import type { Session } from "../domain/session/types";
import { generateSessionSummary } from "../domain/session/helpers";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "./userHub/types";
import { SaveTemplateModal } from "./modals";
import type { SessionPanelDeps } from "./session/types";
import { SessionTimerPanel } from "./session/SessionTimerPanel";
import { SessionGoalsPanel } from "./session/SessionGoalsPanel";
import { SessionNotesPanel } from "./session/SessionNotesPanel";
import { SessionContextPanel } from "./session/SessionContextPanel";
import { SessionActivityPanel } from "./session/SessionActivityPanel";
import { SessionGuidingQuestions } from "./session/SessionGuidingQuestions";
import { SessionDecisionPanel } from "./session/SessionDecisionPanel";
import { type SessionTypeConfig } from "../domain/session/types";

export const VIEW_TYPE_SESSION_WORKSPACE = "flowti-session-workspace";

export class SessionWorkspaceView extends ItemView {
	private eventBus: IEventBus;
	private sessionService: SessionService;
	private unsubscribes: (() => void)[] = [];
	private session: Session | null = null;

	// Panels
	private timerPanel: SessionTimerPanel | null = null;
	private guidingPanel: SessionGuidingQuestions | null = null;
	private goalsPanel: SessionGoalsPanel | null = null;
	private notesPanel: SessionNotesPanel | null = null;
	private contextPanel: SessionContextPanel | null = null;
	private decisionPanel: SessionDecisionPanel | null = null;
	private activityPanel: SessionActivityPanel | null = null;

	/** Custom session type configs injected from main.ts (synced from SessionService). */
	customSessionTypes: Record<string, SessionTypeConfig> = {};

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

		// Load session: prefer workspace target, then fall back to active session
		const targetId = this.sessionService.workspaceSessionId;
		this.session = targetId
			? this.sessionService.getSessionById(targetId)
			: this.sessionService.getActiveSession();

		// Track workspace session so context menu "Add to Session" works for prepared sessions
		if (this.session) {
			this.sessionService.workspaceSessionId = this.session.id;
		}

		this.render();
		this.subscribeToEvents();
	}

	/**
	 * Called by Obsidian when setViewState() targets an existing leaf of the same type.
	 * Switches the displayed session without destroying and recreating the view.
	 */
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
		// Clear workspace tracking
		if (this.session && this.sessionService.workspaceSessionId === this.session.id) {
			this.sessionService.workspaceSessionId = null;
		}
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.notesPanel?.destroy();
	}

	/**
	 * Updates the timer display without a full re-render.
	 * Called externally (e.g. from main.ts wiring) for direct DOM updates.
	 */
	updateTimerDisplay(remainingMs: number): void {
		this.timerPanel?.updateDisplay(remainingMs);
	}

	// ── Rendering ────────────────────────────────────────────

	private refreshSession(): Session {
		return (this.session
			? this.sessionService.getSessionById(this.session.id)
			: this.sessionService.getActiveSession()) ?? this.session!;
	}

	private createPanelDeps(): SessionPanelDeps {
		return {
			eventBus: this.eventBus,
			getSession: () => this.session!,
			app: this.app,
			openFile: (path) => this.openInAdjacentLeaf(path),
			revealFolder: (path) => this.revealInFileExplorer(path),
			updateActivityFilter: (id, filter) => this.sessionService.updateActivityFilter(id, filter),
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

		this.timerPanel = new SessionTimerPanel(container, deps);
		this.timerPanel.render();

		// Guiding questions — visible during active/paused to keep focus
		if (this.session.status === "active" || this.session.status === "paused") {
			this.guidingPanel = new SessionGuidingQuestions(container, deps, this.customSessionTypes);
			this.guidingPanel.render();
		}

		this.goalsPanel = new SessionGoalsPanel(container, deps);
		this.goalsPanel.render();

		this.notesPanel = new SessionNotesPanel(container, deps);
		this.notesPanel.render();

		this.renderFocusFile(container);
		this.renderNotesFile(container);
		this.renderCanvasFile(container);

		this.contextPanel = new SessionContextPanel(container, deps);
		this.contextPanel.render();

		this.decisionPanel = new SessionDecisionPanel(container, deps);
		this.decisionPanel.render();

		this.activityPanel = new SessionActivityPanel(container, deps);
		this.activityPanel.render();
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

		// Title row
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
		this.headerStatusEl.style.cssText = "padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;" + this.getStatusStyle(session.status);

		// Action buttons
		this.actionsEl = header.createDiv({ cls: "ft-session-workspace-actions" });
		this.actionsEl.style.cssText = "display:flex;gap:8px;";
		this.renderActions();
	}

	private renderActions(): void {
		if (!this.actionsEl || !this.session) return;
		this.actionsEl.empty();
		const session = this.session;

		if (session.status === "active") {
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
			this.openSaveTemplateModal(session);
		});

		// Show "Sidebar" or "Open in Tab" depending on current location
		if (this.leaf.getRoot() !== this.app.workspace.rightSplit) {
			this.createActionButton(this.actionsEl, "panel-right", "Sidebar", () => {
				this.openInSidebar();
			});
		} else {
			this.createActionButton(this.actionsEl, "layout", "Open in Tab", () => {
				this.openInTab();
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
		if (!session.focusFile) return;

		const section = container.createDiv({ cls: "ft-session-workspace-focus ft-section" });
		section.style.cssText = "display:flex;align-items:center;gap:8px;";

		const iconEl = section.createSpan();
		setIcon(iconEl, "file-text");

		section.createEl("span", { text: "Focus:" }).style.cssText = "font-weight:600;";

		const link = section.createEl("a", { text: session.focusFile, cls: "ft-focus-link" });
		link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);";
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.openInAdjacentLeaf(session.focusFile!);
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
				await this.app.vault.create(path, generateSessionSummary(session));
			} catch {
				// File already exists on disk — proceed to open
			}
		}

		this.openInAdjacentLeaf(path);
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
				this.openInAdjacentLeaf(session.canvasFile!);
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

		// Create canvas file if it doesn't exist
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

		// Set canvas file on session
		void this.eventBus.emit("session.canvasFile.set", { sessionId: session.id, path });
		new Notice(`Canvas created: ${path.split("/").pop()}`);

		// Auto-link canvas in the notes file
		if (session.notesFile) {
			await this.appendCanvasLinkToNotes(session.notesFile, path);
		}

		this.openInAdjacentLeaf(path);
	}

	private async appendCanvasLinkToNotes(notesPath: string, canvasPath: string): Promise<void> {
		let file = this.app.vault.getAbstractFileByPath(notesPath);
		if (!file) {
			// Notes file doesn't exist yet — create it with canvas link
			const folder = notesPath.substring(0, notesPath.lastIndexOf("/"));
			if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			try {
				const title = this.session?.title ?? "Session";
				await this.app.vault.create(notesPath, `# ${title}\n\n## Canvas\n![[${canvasPath}]]\n`);
				return;
			} catch {
				// File exists on disk but not in cache — fall through to append
				file = this.app.vault.getAbstractFileByPath(notesPath);
				if (!file) return;
			}
		}
		// File exists — append canvas embed if not already present
		const existing = await this.app.vault.read(file as import("obsidian").TFile);
		const embed = `![[${canvasPath}]]`;
		if (!existing.includes(embed)) {
			await this.app.vault.modify(file as import("obsidian").TFile, existing + `\n## Canvas\n${embed}\n`);
		}
	}

	// ── Event subscriptions ──────────────────────────────────

	private subscribeToEvents(): void {
		// Timer tick — incremental DOM update only
		this.unsubscribes.push(
			this.eventBus.on("session.timer.tick", (event) => {
				if (this.timerPanel && this.session && event.payload.sessionId === this.session.id) {
					this.timerPanel.updateDisplay(event.payload.remainingMs);
				}
			}),
		);

		// Timer completed — full re-render for status change
		this.unsubscribes.push(
			this.eventBus.on("session.timer.completed", () => {
				this.session = this.refreshSession();
				this.render();
			}),
		);

		// Duration updated — full re-render to update timer display
		this.unsubscribes.push(
			this.eventBus.on("session.duration.updated", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);

		// Session lifecycle changes — full re-render for own session,
		// action bar refresh for other sessions (Start button visibility depends on active session)
		const lifecycleEvents = [
			"session.started", "session.paused", "session.resumed", "session.completed",
		] as const;
		for (const eventType of lifecycleEvents) {
			this.unsubscribes.push(
				this.eventBus.on(eventType, (event) => {
					if (event.payload.session.id === this.session?.id) {
						this.session = event.payload.session;
						this.render();
					} else {
						this.renderActions();
					}
				}),
			);
		}

		// Goal changes — refresh goals panel
		const goalEvents = ["session.goal.added", "session.goal.toggled", "session.goal.removed"] as const;
		for (const eventType of goalEvents) {
			this.unsubscribes.push(
				this.eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === this.session?.id) {
						this.session = this.refreshSession();
						this.goalsPanel?.refreshGoals();
					}
				}),
			);
		}

		// Decision changes — refresh decisions panel
		const decisionEvents = ["session.decision.recorded", "session.decision.removed"] as const;
		for (const eventType of decisionEvents) {
			this.unsubscribes.push(
				this.eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === this.session?.id) {
						this.session = this.refreshSession();
						this.decisionPanel?.refreshList();
					}
				}),
			);
		}

		// Notes updated — update textarea if not focused (avoid overwriting user typing)
		this.unsubscribes.push(
			this.eventBus.on("session.notes.updated", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.notesPanel?.updateNotes(event.payload.notes);
				}
			}),
		);

		// Artifact added — refresh activity list (artifacts are shown in the activity list)
		this.unsubscribes.push(
			this.eventBus.on("session.artifact.added", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.activityPanel?.refreshList();
				}
			}),
		);

		// Notes file set — full re-render (section changes from button to link)
		this.unsubscribes.push(
			this.eventBus.on("session.notesFile.updated", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);

		// Canvas file set — full re-render (section changes from button to link)
		this.unsubscribes.push(
			this.eventBus.on("session.canvasFile.updated", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);

		// Context binding added/removed/changed — full re-render
		this.unsubscribes.push(
			this.eventBus.on("session.context.bound", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("session.context.unbound", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);
		this.unsubscribes.push(
			this.eventBus.on("session.context.typeChanged", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);

		// Activity tracked — incremental update to activity list
		this.unsubscribes.push(
			this.eventBus.on("session.activity.tracked", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.activityPanel?.refreshList();
				}
			}),
		);

		// Activity filter updated — full re-render (filter tags change)
		this.unsubscribes.push(
			this.eventBus.on("session.activity.filter.updated", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);

		// Path reconciliation — re-render when attached files are renamed/moved
		this.unsubscribes.push(
			this.eventBus.on("session.paths.updated", (event) => {
				if (this.session && event.payload.sessionIds.includes(this.session.id)) {
					this.session = this.refreshSession();
					this.render();
				}
			}),
		);

		// Session deleted — show empty state
		this.unsubscribes.push(
			this.eventBus.on("session.deleted", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = null;
					this.render();
				}
			}),
		);
	}

	// ── Helpers ───────────────────────────────────────────────

	private openSaveTemplateModal(session: Session): void {
		new SaveTemplateModal(this.app, {
			sessionTitle: session.title,
			sessionType: SESSION_TYPE_LABELS[session.type] ?? session.type,
			sessionDuration: session.durationMinutes,
			onSubmit: (name) => {
				void this.sessionService.saveTemplateFromSession(session.id, name);
			},
		}).open();
	}

	private openInTab(): void {
		if (!this.session) return;
		const sessionId = this.session.id;
		this.sessionService.workspaceSessionId = sessionId;
		void this.app.workspace.getLeaf("tab").setViewState({
			type: VIEW_TYPE_SESSION_WORKSPACE,
			active: true,
			state: { sessionId },
		});
	}

	private openInSidebar(): void {
		if (!this.session) return;
		const sessionId = this.session.id;
		this.sessionService.workspaceSessionId = sessionId;
		// Defer to next tick so the browser can process mouseup / cursor reset
		// before the heavy sidebar + view instantiation runs.
		setTimeout(() => {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
				.find((l) => l.getRoot() === this.app.workspace.rightSplit);
			const leaf = existing ?? this.app.workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({ type: VIEW_TYPE_SESSION_WORKSPACE, active: true, state: { sessionId } });
				this.app.workspace.revealLeaf(leaf);
			}
		}, 0);
	}

	private revealInFileExplorer(path: string): void {
		const cleanPath = path.replace(/\/$/, "");
		const folder = this.app.vault.getAbstractFileByPath(cleanPath);
		if (!folder) return;

		const explorers = this.app.workspace.getLeavesOfType("file-explorer");
		if (explorers.length > 0) {
			(explorers[0].view as unknown as { revealInFolder: (f: TAbstractFile) => void }).revealInFolder(folder);
			this.app.workspace.revealLeaf(explorers[0]);
		}
	}

	private openInAdjacentLeaf(path: string): void {
		// Reuse our tracked leaf if still attached, otherwise create a new split
		if (!this.adjacentLeaf || !this.adjacentLeaf.parent) {
			this.adjacentLeaf = this.app.workspace.getLeaf("split");
		}
		const target = this.adjacentLeaf;
		this.app.workspace.setActiveLeaf(target, { focus: true });
		void this.app.workspace.openLinkText(path, "", false).then(() => {
			if (target.parent) this.app.workspace.setActiveLeaf(target, { focus: true });
		});
	}

	private getStatusStyle(status: string): string {
		switch (status) {
			case "active": return "background:var(--color-green);color:var(--background-primary);";
			case "paused": return "background:var(--color-yellow);color:var(--background-primary);";
			case "completed": return "background:var(--color-blue);color:var(--background-primary);";
			default: return "background:var(--background-modifier-hover);";
		}
	}
}
