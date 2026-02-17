/**
 * Session Workspace View — a dedicated focused leaf for active sessions.
 *
 * Extends ItemView directly (not BaseHubView) because it renders a
 * single-session workspace rather than a tabbed hub shell.
 *
 * Layout: header → timer → goals → notes → focus file → artifacts.
 * All mutations go through the EventBus; the view is purely reactive.
 */

import { FuzzySuggestModal, ItemView, Notice, setIcon } from "obsidian";
import type { App, TAbstractFile, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { SessionService } from "../domain/session/SessionService";
import type { ContextBindingType, Session, SessionGoal } from "../domain/session/types";
import { BINDING_TYPES, MAX_CONTEXT_BINDINGS } from "../domain/session/types";
import { formatDuration, computeRemainingMs, generateSessionSummary } from "../domain/session/helpers";
import { SESSION_TYPE_LABELS, SESSION_STATUS_LABELS } from "./userHub/types";
import { SaveTemplateModal } from "./modals";
import { attachFolderSuggest } from "./FolderSuggest";

export const VIEW_TYPE_SESSION_WORKSPACE = "flowti-session-workspace";

const NOTES_DEBOUNCE_MS = 500;

export class SessionWorkspaceView extends ItemView {
	private eventBus: IEventBus;
	private sessionService: SessionService;
	private unsubscribes: (() => void)[] = [];
	private session: Session | null = null;

	// DOM refs for incremental updates
	private timerEl: HTMLElement | null = null;
	private goalsEl: HTMLElement | null = null;
	private notesTextarea: HTMLTextAreaElement | null = null;
	private activityEl: HTMLElement | null = null;
	private contextBindingsEl: HTMLElement | null = null;
	private headerStatusEl: HTMLElement | null = null;
	private actionsEl: HTMLElement | null = null;
	private goalCountEl: HTMLElement | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
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

	async onClose(): Promise<void> {
		// Clear workspace tracking
		if (this.session && this.sessionService.workspaceSessionId === this.session.id) {
			this.sessionService.workspaceSessionId = null;
		}
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	/**
	 * Re-fetches the current session from the service.
	 * Falls back to the existing session reference if the service no longer knows the ID.
	 */
	private refreshSession(): Session {
		return (this.session
			? this.sessionService.getSessionById(this.session.id)
			: this.sessionService.getActiveSession()) ?? this.session!;
	}

	// ── Rendering ────────────────────────────────────────────

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("ft-session-workspace");

		if (!this.session) {
			this.renderEmptyState(container);
			return;
		}

		this.renderHeader(container);
		this.renderTimer(container);
		this.renderGoals(container);
		this.renderNotes(container);
		this.renderFocusFile(container);
		this.renderNotesFile(container);
		this.renderCanvasFile(container);
		this.renderContextBindings(container);
		this.renderActivity(container);
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
		} else if (session.status === "prepared") {
			this.createActionButton(this.actionsEl, "play", "Start", () => {
				void this.eventBus.emit("session.start", { sessionId: session.id });
			});
		}

		this.createActionButton(this.actionsEl, "bookmark", "Save as Template", () => {
			this.openSaveTemplateModal(session);
		});

		// Only show "Sidebar" when this view is NOT already in the right sidebar
		if (this.leaf.getRoot() !== this.app.workspace.rightSplit) {
			this.createActionButton(this.actionsEl, "panel-right", "Sidebar", () => {
				this.openInSidebar();
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

	// ── Context Bindings ────────────────────────────────────

	private renderContextBindings(container: HTMLElement): void {
		const session = this.session!;
		const section = container.createDiv({ cls: "ft-session-workspace-context ft-section" });

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
		headerRow.createEl("strong", { text: "Context" });
		headerRow.createEl("span", {
			text: `(${session.contextBindings.length}/${MAX_CONTEXT_BINDINGS})`,
			cls: "ft-text-muted",
		}).style.cssText = "color:var(--text-muted);font-size:12px;";

		this.contextBindingsEl = section.createDiv({ cls: "ft-context-bindings-list" });
		this.renderContextBindingsList();

		if (session.contextBindings.length < MAX_CONTEXT_BINDINGS) {
			const addBtn = section.createEl("button", { text: "Add Context", cls: "ft-context-add" });
			addBtn.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:13px;margin-top:8px;background:var(--interactive-normal);border:1px solid var(--background-modifier-border);color:var(--text-normal);";
			const iconEl = addBtn.createSpan();
			setIcon(iconEl, "plus");
			addBtn.prepend(iconEl);
			addBtn.addEventListener("click", () => {
				this.openContextBindingPicker(addBtn);
			});
		}
	}

	private renderContextBindingsList(): void {
		if (!this.contextBindingsEl || !this.session) return;
		this.contextBindingsEl.empty();

		if (this.session.contextBindings.length === 0) {
			this.contextBindingsEl.createDiv({ text: "No context bindings", cls: "ft-text-muted ft-text-sm" })
				.style.cssText = "color:var(--text-muted);font-size:12px;padding:4px 0;";
			return;
		}

		for (const binding of this.session.contextBindings) {
			const row = this.contextBindingsEl.createDiv({ cls: "ft-context-row" });
			row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;";

			const badge = row.createEl("span", { text: binding.type, cls: "ft-context-badge" });
			badge.style.cssText = "background:var(--background-modifier-hover);padding:1px 6px;border-radius:3px;font-size:11px;color:var(--text-muted);cursor:pointer;user-select:none;";
			badge.title = "Click to change type";
			badge.addEventListener("click", () => {
				const currentIdx = BINDING_TYPES.indexOf(binding.type);
				const nextType = BINDING_TYPES[(currentIdx + 1) % BINDING_TYPES.length];
				void this.eventBus.emit("session.context.changeType", {
					sessionId: this.session!.id,
					bindingId: binding.id,
					type: nextType,
				});
			});

			const anchor = row.createEl("a", { text: binding.label, cls: "ft-context-link" });
			anchor.title = binding.path;
			anchor.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);flex:1;";
			anchor.addEventListener("click", (e) => {
				e.preventDefault();
				if (binding.type === "folder") {
					this.revealInFileExplorer(binding.path);
				} else {
					this.openInAdjacentLeaf(binding.path);
				}
			});

			const removeBtn = row.createEl("button", { cls: "ft-context-remove clickable-icon" });
			removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.eventBus.emit("session.context.unbind", {
					sessionId: this.session!.id,
					bindingId: binding.id,
				});
			});
		}
	}

	private openContextBindingPicker(triggerBtn?: HTMLButtonElement): void {
		const items = this.app.vault.getAllLoadedFiles();
		const choices: Array<{ path: string; type: ContextBindingType }> = [];

		for (const item of items) {
			if ("children" in item && item.path) {
				choices.push({ path: item.path + "/", type: "folder" });
			} else if ("extension" in item) {
				choices.push({ path: (item as TAbstractFile).path, type: "file" });
			}
		}

		choices.sort((a, b) => a.path.localeCompare(b.path));

		new ContextBindingPickerModal(this.app, choices, (choice) => {
			void this.eventBus.emit("session.context.bind", {
				sessionId: this.session!.id,
				path: choice.path,
				type: choice.type,
			});
			const name = choice.path.replace(/\/$/, "").split("/").pop() ?? choice.path;
			if (triggerBtn) {
				triggerBtn.setText(`Added "${name}"`);
				triggerBtn.disabled = true;
			}
			new Notice(`Added "${name}" as ${choice.type} context`);
		}).open();
	}

	private renderTimer(container: HTMLElement): void {
		const session = this.session!;
		const section = container.createDiv({ cls: "ft-session-workspace-timer ft-section" });
		section.style.cssText = "text-align:center;";

		this.timerEl = section.createDiv({ cls: "ft-timer-display" });
		this.timerEl.style.cssText = "font-size:36px;font-weight:700;font-family:var(--font-monospace);letter-spacing:2px;";

		this.timerEl.textContent = formatDuration(computeRemainingMs(session));

		if (session.status === "prepared") {
			const editRow = section.createDiv({ cls: "ft-duration-edit" });
			editRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;";

			const input = editRow.createEl("input", { type: "number", cls: "ft-duration-input" });
			input.value = String(session.durationMinutes);
			input.min = "1";
			input.style.cssText = "width:60px;padding:4px 8px;text-align:center;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);font-family:var(--font-monospace);";

			editRow.createEl("span", { text: "minutes", cls: "ft-text-muted ft-text-sm" }).style.cssText = "color:var(--text-muted);font-size:12px;";

			input.addEventListener("change", () => {
				const value = parseInt(input.value, 10);
				if (value >= 1) {
					void this.eventBus.emit("session.duration.update", {
						sessionId: session.id,
						durationMinutes: value,
					});
				}
			});
		} else {
			section.createDiv({ text: "Time Remaining", cls: "ft-text-muted ft-text-sm" }).style.cssText = "margin-top:4px;color:var(--text-muted);font-size:12px;";
		}
	}

	private renderGoals(container: HTMLElement): void {
		const session = this.session!;
		const section = container.createDiv({ cls: "ft-session-workspace-goals ft-section" });

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

		const labelRow = headerRow.createDiv();
		labelRow.style.cssText = "display:flex;align-items:center;gap:8px;";
		labelRow.createEl("strong", { text: "Goals" });
		this.goalCountEl = labelRow.createEl("span", {
			text: this.formatGoalCount(session.goals),
			cls: "ft-text-muted ft-text-sm",
		});
		this.goalCountEl.style.cssText = "color:var(--text-muted);font-size:12px;";

		this.goalsEl = section.createDiv({ cls: "ft-goals-list" });
		this.renderGoalsList();

		// Add goal input
		const addRow = section.createDiv();
		addRow.style.cssText = "display:flex;gap:8px;margin-top:8px;";
		const input = addRow.createEl("input", { type: "text" });
		input.placeholder = "Add goal...";
		input.style.cssText = "flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				void this.eventBus.emit("session.goal.add", { sessionId: session.id, text: input.value.trim() });
				input.value = "";
			}
		});
	}

	private renderGoalsList(): void {
		if (!this.goalsEl || !this.session) return;
		this.goalsEl.empty();

		for (const goal of this.session.goals) {
			const row = this.goalsEl.createDiv({ cls: "ft-goal-row" });
			row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0;";

			const checkbox = row.createEl("input", { type: "checkbox" }) as HTMLInputElement;
			checkbox.checked = goal.completed;
			checkbox.addEventListener("change", () => {
				void this.eventBus.emit("session.goal.toggle", { sessionId: this.session!.id, goalId: goal.id });
			});

			const textEl = row.createEl("span", { text: goal.text });
			textEl.style.cssText = "flex:1;" + (goal.completed ? "text-decoration:line-through;opacity:0.6;" : "");

			const removeBtn = row.createEl("button", { cls: "ft-goal-remove" });
			removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;color:var(--text-muted);";
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				void this.eventBus.emit("session.goal.remove", { sessionId: this.session!.id, goalId: goal.id });
			});
		}
	}

	private renderNotes(container: HTMLElement): void {
		const session = this.session!;
		const section = container.createDiv({ cls: "ft-session-workspace-notes ft-section" });

		section.createEl("strong", { text: "Notes" }).style.cssText = "display:block;margin-bottom:8px;";

		this.notesTextarea = section.createEl("textarea");
		this.notesTextarea.value = session.notes;
		this.notesTextarea.placeholder = "Session notes...";
		this.notesTextarea.style.cssText = "width:100%;min-height:100px;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);resize:vertical;font-family:inherit;";

		this.notesTextarea.addEventListener("input", () => {
			this.debouncedNotesUpdate();
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

	private debouncedNotesUpdate(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			if (this.session && this.notesTextarea) {
				void this.eventBus.emit("session.notes.update", {
					sessionId: this.session.id,
					notes: this.notesTextarea.value,
				});
			}
		}, NOTES_DEBOUNCE_MS);
	}

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

	private renderActivity(container: HTMLElement): void {
		const session = this.session!;
		const section = container.createDiv({ cls: "ft-session-workspace-activity ft-section" });

		const headerRow = section.createDiv();
		headerRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
		headerRow.createEl("strong", { text: "Activity" });
		headerRow.createEl("span", {
			text: `(${session.activity.length})`,
			cls: "ft-text-muted",
		}).style.cssText = "color:var(--text-muted);font-size:12px;";

		this.renderActivityFilter(section, session);

		this.activityEl = section.createDiv({ cls: "ft-activity-list" });
		this.renderActivityList();
	}

	private renderActivityFilter(parent: HTMLElement, session: Session): void {
		const filterSection = parent.createDiv({ cls: "ft-activity-filter" });
		filterSection.style.cssText = "margin-bottom:8px;";

		if (session.activityFilter.length > 0) {
			const tagList = filterSection.createDiv({ cls: "ft-activity-filter-tags" });
			tagList.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;";

			for (const folder of session.activityFilter) {
				const tag = tagList.createDiv({ cls: "ft-activity-filter-tag" });
				tag.style.cssText = "display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:3px;font-size:11px;background:var(--background-modifier-hover);color:var(--text-muted);";
				tag.createSpan({ text: folder });

				const removeBtn = tag.createEl("button", { cls: "ft-activity-filter-remove" });
				removeBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:0 2px;opacity:0.6;color:var(--text-muted);font-size:11px;";
				setIcon(removeBtn, "x");
				removeBtn.addEventListener("click", () => {
					const updated = session.activityFilter.filter((f) => f !== folder);
					void this.sessionService.updateActivityFilter(session.id, updated);
				});
			}
		}

		const addRow = filterSection.createDiv();
		addRow.style.cssText = "display:flex;gap:4px;";
		const input = addRow.createEl("input", { type: "text", cls: "ft-activity-filter-input" });
		input.placeholder = "Exclude folder...";
		input.style.cssText = "flex:1;padding:2px 6px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);font-size:12px;";
		attachFolderSuggest(input, this.app);
		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && input.value.trim()) {
				const updated = [...session.activityFilter, input.value.trim()];
				void this.sessionService.updateActivityFilter(session.id, updated);
				input.value = "";
			}
		});
	}

	private renderActivityList(): void {
		if (!this.activityEl || !this.session) return;
		this.activityEl.empty();

		if (this.session.activity.length === 0) {
			this.activityEl.createDiv({ text: "No activity yet", cls: "ft-text-muted ft-text-sm" }).style.cssText = "color:var(--text-muted);font-size:12px;padding:4px 0;";
			return;
		}

		// Show newest first
		const entries = [...this.session.activity].reverse();
		for (const entry of entries) {
			const row = this.activityEl.createDiv({ cls: "ft-activity-row" });
			row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;";

			const iconEl = row.createSpan();
			setIcon(iconEl, this.getActivityIcon(entry.action));

			const name = entry.path.split("/").pop() ?? entry.path;
			const link = row.createEl("a", { text: name, cls: "ft-activity-link" });
			link.title = entry.path;
			link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);flex:1;";
			link.addEventListener("click", (e) => {
				e.preventDefault();
				if (entry.action !== "deleted") {
					this.openInAdjacentLeaf(entry.path);
				}
			});

			row.createEl("span", {
				text: entry.action,
				cls: "ft-badge",
			}).style.cssText = "background:var(--background-modifier-hover);padding:1px 6px;border-radius:3px;font-size:11px;color:var(--text-muted);";

			row.createEl("span", {
				text: this.formatActivityTime(entry.timestamp),
				cls: "ft-text-muted",
			}).style.cssText = "color:var(--text-muted);font-size:11px;font-family:var(--font-monospace);";
		}
	}

	// ── Event subscriptions ──────────────────────────────────

	private subscribeToEvents(): void {
		// Timer tick — incremental DOM update only
		this.unsubscribes.push(
			this.eventBus.on("session.timer.tick", (event) => {
				if (this.timerEl && this.session && event.payload.sessionId === this.session.id) {
					this.timerEl.textContent = formatDuration(event.payload.remainingMs);
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

		// Session lifecycle changes — full re-render
		const lifecycleEvents = [
			"session.started", "session.paused", "session.resumed", "session.completed",
		] as const;
		for (const eventType of lifecycleEvents) {
			this.unsubscribes.push(
				this.eventBus.on(eventType, (event) => {
					if (event.payload.session.id === this.session?.id) {
						this.session = event.payload.session;
						this.render();
					}
				}),
			);
		}

		// Goal changes — refresh from service and re-render goals section
		const goalEvents = ["session.goal.added", "session.goal.toggled", "session.goal.removed"] as const;
		for (const eventType of goalEvents) {
			this.unsubscribes.push(
				this.eventBus.on(eventType, (event) => {
					if (event.payload.sessionId === this.session?.id) {
						this.session = this.refreshSession();
						this.renderGoalsList();
						this.updateGoalCount();
					}
				}),
			);
		}

		// Notes updated — update textarea if not focused (avoid overwriting user typing)
		this.unsubscribes.push(
			this.eventBus.on("session.notes.updated", (event) => {
				if (event.payload.sessionId === this.session?.id && this.notesTextarea) {
					this.session = this.refreshSession();
					if (document.activeElement !== this.notesTextarea) {
						this.notesTextarea.value = event.payload.notes;
					}
				}
			}),
		);

		// Artifact added — refresh activity log (artifacts are shown in the activity list)
		this.unsubscribes.push(
			this.eventBus.on("session.artifact.added", (event) => {
				if (event.payload.sessionId === this.session?.id) {
					this.session = this.refreshSession();
					this.renderActivityList();
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
					this.renderActivityList();
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

	private updateGoalCount(): void {
		if (this.goalCountEl && this.session) {
			this.goalCountEl.textContent = this.formatGoalCount(this.session.goals);
		}
	}

	private formatGoalCount(goals: SessionGoal[]): string {
		const done = goals.filter((g) => g.completed).length;
		return `(${done}/${goals.length})`;
	}

	/**
	 * Opens a file in an adjacent split leaf, reusing an existing one if available.
	 * Avoids replacing the workspace view itself.
	 */
	private openInSidebar(): void {
		if (!this.session) return;
		this.sessionService.workspaceSessionId = this.session.id;
		// Defer to next tick so the browser can process mouseup / cursor reset
		// before the heavy sidebar + view instantiation runs.
		setTimeout(() => {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
				.find((l) => l.getRoot() === this.app.workspace.rightSplit);
			const leaf = existing ?? this.app.workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({ type: VIEW_TYPE_SESSION_WORKSPACE, active: true });
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

	private getActivityIcon(action: string): string {
		switch (action) {
			case "created": return "file-plus";
			case "modified": return "file-edit";
			case "deleted": return "file-minus";
			case "renamed": return "file-symlink";
			case "opened": return "file-search";
			default: return "file";
		}
	}

	private formatActivityTime(timestamp: string): string {
		const d = new Date(timestamp);
		return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	}

	private getStatusStyle(status: string): string {
		switch (status) {
			case "active": return "background:var(--color-green);color:var(--background-primary);";
			case "paused": return "background:var(--color-yellow);color:var(--background-primary);";
			case "completed": return "background:var(--color-blue);color:var(--background-primary);";
			default: return "background:var(--background-modifier-hover);";
		}
	}

	/**
	 * Updates the timer display without a full re-render.
	 * Called externally (e.g. from main.ts wiring) for direct DOM updates.
	 */
	updateTimerDisplay(remainingMs: number): void {
		if (this.timerEl) {
			this.timerEl.textContent = formatDuration(remainingMs);
		}
	}
}

// ─────────────────────────────────────────────────────────────
// Picker modal (private to this module)
// ─────────────────────────────────────────────────────────────

interface ContextPickerChoice {
	path: string;
	type: ContextBindingType;
}

class ContextBindingPickerModal extends FuzzySuggestModal<ContextPickerChoice> {
	private choices: ContextPickerChoice[];
	private onChoose: (choice: ContextPickerChoice) => void;

	constructor(app: App, choices: ContextPickerChoice[], onChoose: (choice: ContextPickerChoice) => void) {
		super(app);
		this.choices = choices;
		this.onChoose = onChoose;
		this.setPlaceholder("Search for a file or folder to bind...");
	}

	getItems(): ContextPickerChoice[] {
		return this.choices;
	}

	getItemText(item: ContextPickerChoice): string {
		return item.path;
	}

	onChooseItem(item: ContextPickerChoice): void {
		this.onChoose(item);
	}
}
