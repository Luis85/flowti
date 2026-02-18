/**
 * Session domain service.
 *
 * Manages time-boxed documentation sessions with Pomodoro-style timer,
 * artifact tracking, and lifecycle state management. The timer lives
 * in the domain layer (not UI) so it survives window minimize and
 * modal close. On load(), resumes an active session if one exists.
 *
 * Follows the same pattern as InboxService/SubscriptionService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import { generateUUID } from "../../utils/helpers";
import type { ContextBindingType, Session, SessionActivity, SessionActivityAction, SessionContextBinding, SessionGoal, SessionLink, SessionOutputArtifact, SessionOutputTemplate, SessionState, SessionTemplate, SessionTypeConfig, WorkspaceState } from "./types";
import { MAX_SESSIONS, MAX_TEMPLATES, ARTIFACT_DEDUP_WINDOW_MS, SESSION_NOTES_FOLDER, MAX_SESSION_ACTIVITY, ACTIVITY_DEDUP_WINDOW_MS, MAX_CONTEXT_BINDINGS, MAX_SESSION_DECISIONS, MAX_OUTPUT_ARTIFACTS, SESSION_TYPE_CONFIGS } from "./types";
import { createSession, createGoal, createDecision, createContextBinding, computeRemainingMs, computeElapsedMs, isTimerExpired, isExcluded, resolveTypeConfig, generateSessionOutput } from "./helpers";

/**
 * Configuration options for the SessionService.
 */
export interface SessionServiceOptions {
	storage: ITypedStorage<SessionState>;
	eventBus?: IEventBus;
	fileSystem?: IFileSystemClient;
}

/**
 * Creates a fresh default session state.
 */
function createDefaultState(): SessionState {
	return { sessions: [], activeSessionId: null, savedTemplates: [] };
}

/**
 * Service for managing documentation sessions.
 *
 * Handles session CRUD, timer management, and artifact tracking.
 * Persists state via TypedStorage and communicates through the EventBus.
 */
export class SessionService {
	private state: SessionState = createDefaultState();
	private storage: ITypedStorage<SessionState>;
	private eventBus?: IEventBus;
	private fileSystem?: IFileSystemClient;
	private unsubscribes: (() => void)[] = [];
	private timerInterval: ReturnType<typeof setInterval> | null = null;
	/** Global activity filter folders — injected from SettingsService. */
	globalActivityFilter: string[] = [];
	/** Custom session type configs — injected from SettingsService. */
	customSessionTypes: Record<string, SessionTypeConfig> = {};

	constructor(options: SessionServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("session.create", (event) => {
					void this.handleCreate(event.payload);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.start", (event) => {
					void this.handleStart(event.payload.sessionId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.pause", (event) => {
					void this.handlePause(event.payload.sessionId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.resume", (event) => {
					void this.handleResume(event.payload.sessionId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.complete", (event) => {
					void this.handleComplete(event.payload.sessionId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.archive", (event) => {
					void this.handleArchive(event.payload.sessionId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.delete", (event) => {
					void this.handleDelete(event.payload.sessionId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.refresh", () => {
					void this.emitLoaded();
				}),
			);

			// Artifact tracking: listen to file events
			this.unsubscribes.push(
				this.eventBus.on("file.created", (event) => {
					void this.onFileEvent(event.payload.path, "created");
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("file.modified", (event) => {
					void this.onFileEvent(event.payload.path, "modified");
				}),
			);

			// Activity tracking: listen to all file events (ADR-025)
			this.unsubscribes.push(
				this.eventBus.on("file.created", (event) => {
					void this.onActivityEvent(event.payload.path, "created");
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("file.modified", (event) => {
					void this.onActivityEvent(event.payload.path, "modified");
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("file.deleted", (event) => {
					void this.onActivityEvent(event.payload.path, "deleted");
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("file.renamed", (event) => {
					void this.onActivityEvent(event.payload.newPath, "renamed", event.payload.oldPath);
				}),
			);

			// Path reconciliation: update stale paths when files/folders move
			this.unsubscribes.push(
				this.eventBus.on("file.renamed", (event) => {
					void this.handleFileRenamed(event.payload.oldPath, event.payload.newPath);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("folder.renamed", (event) => {
					void this.handleFolderRenamed(event.payload.oldPath, event.payload.newPath);
				}),
			);

			// Goal commands
			this.unsubscribes.push(
				this.eventBus.on("session.goal.add", (event) => {
					void this.handleGoalAdd(event.payload.sessionId, event.payload.text);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.goal.toggle", (event) => {
					void this.handleGoalToggle(event.payload.sessionId, event.payload.goalId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.goal.remove", (event) => {
					void this.handleGoalRemove(event.payload.sessionId, event.payload.goalId);
				}),
			);

			// Duration command
			this.unsubscribes.push(
				this.eventBus.on("session.duration.update", (event) => {
					void this.handleDurationUpdate(event.payload.sessionId, event.payload.durationMinutes);
				}),
			);

			// Notes command
			this.unsubscribes.push(
				this.eventBus.on("session.notes.update", (event) => {
					void this.handleNotesUpdate(event.payload.sessionId, event.payload.notes);
				}),
			);

			// Notes file command
			this.unsubscribes.push(
				this.eventBus.on("session.notesFile.set", (event) => {
					void this.handleNotesFileSet(event.payload.sessionId, event.payload.path);
				}),
			);

			// Canvas file command
			this.unsubscribes.push(
				this.eventBus.on("session.canvasFile.set", (event) => {
					void this.handleCanvasFileSet(event.payload.sessionId, event.payload.path);
				}),
			);

			// Link commands
			this.unsubscribes.push(
				this.eventBus.on("session.link.add", (event) => {
					void this.handleLinkAdd(event.payload.sessionId, event.payload.path);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.link.remove", (event) => {
					void this.handleLinkRemove(event.payload.sessionId, event.payload.path);
				}),
			);

			// Context binding commands
			this.unsubscribes.push(
				this.eventBus.on("session.context.bind", (event) => {
					void this.handleContextBind(event.payload.sessionId, event.payload.path, event.payload.type);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.context.unbind", (event) => {
					void this.handleContextUnbind(event.payload.sessionId, event.payload.bindingId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.context.changeType", (event) => {
					void this.handleContextChangeType(event.payload.sessionId, event.payload.bindingId, event.payload.type);
				}),
			);

			// Decision commands
			this.unsubscribes.push(
				this.eventBus.on("session.decision.record", (event) => {
					void this.handleDecisionRecord(event.payload.sessionId, event.payload.title, event.payload.description, event.payload.context);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.decision.remove", (event) => {
					void this.handleDecisionRemove(event.payload.sessionId, event.payload.decisionId);
				}),
			);

			// Workspace state: persist when view reports capture
			this.unsubscribes.push(
				this.eventBus.on("session.state.saved", (event) => {
					void this.handleStateSaved(event.payload.sessionId, event.payload.state);
				}),
			);

			// Output artifact command
			this.unsubscribes.push(
				this.eventBus.on("session.output.generate", (event) => {
					void this.handleOutputGenerate(event.payload.sessionId, event.payload.template);
				}),
			);

			// Type configuration commands
			this.unsubscribes.push(
				this.eventBus.on("session.type.create", (event) => {
					void this.handleTypeCreate(event.payload.config);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.type.configure", (event) => {
					void this.handleTypeConfigure(event.payload.type, event.payload.config);
				}),
			);
		}
	}

	// ── Public API ───────────────────────────────────────────

	/**
	 * Loads session state from storage.
	 * If an active session exists, resumes or completes it.
	 */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
			// Backward compat: initialize savedTemplates if missing
			if (!this.state.savedTemplates) {
				this.state.savedTemplates = [];
			}
			// Backward compat: initialize timeline and goals for legacy sessions
			let migrated = false;
			for (const s of this.state.sessions) {
				if (!s.timeline) {
					s.timeline = [];
				}
				if (!s.goals) {
					s.goals = [];
				}
				if (!s.links) {
					s.links = [];
				}
				if (s.notesFile === undefined) {
					s.notesFile = null;
				}
				if (s.canvasFile === undefined) {
					s.canvasFile = null;
				}
				if (!s.activity) {
					s.activity = [];
				}
				if (!s.activityFilter) {
					s.activityFilter = [];
				}
				if (!s.contextBindings) {
					s.contextBindings = [];
				}
				if (!s.type) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(s as any).type = "documentation";
				}
				if (!s.decisions) {
					s.decisions = [];
				}
				if (s.workspaceState === undefined) {
					s.workspaceState = null;
				}
				if (!s.outputArtifacts) {
					s.outputArtifacts = [];
				}
				// Migrate legacy links → context bindings
				if (s.links.length > 0) {
					for (const link of s.links) {
						if (!s.contextBindings.some((b) => b.path === link.path)) {
							s.contextBindings.push(createContextBinding(`ctx_${generateUUID()}`, "file", link.path));
						}
					}
					s.links = [];
					migrated = true;
				}
			}
			if (migrated) {
				await this.saveState();
			}
		}

		// Resume or expire active session
		if (this.state.activeSessionId) {
			const session = this.findSession(this.state.activeSessionId);
			if (session && session.status === "active") {
				if (isTimerExpired(session)) {
					await this.completeSession(session);
				} else {
					this.startTimer(session);
				}
			}
		}

		await this.emitLoaded();
	}

	/**
	 * Returns a copy of all sessions (newest first).
	 */
	getSessions(): Session[] {
		return [...this.state.sessions];
	}

	/**
	 * Returns the active session, or null if none.
	 */
	getActiveSession(): Session | null {
		if (!this.state.activeSessionId) return null;
		return this.findSession(this.state.activeSessionId) ?? null;
	}

	/**
	 * Returns a session by ID, or null if not found.
	 */
	getSessionById(id: string): Session | null {
		return this.findSession(id) ?? null;
	}

	/**
	 * Transient ID of the session currently shown in the workspace view.
	 * Not persisted — used to link the context menu to a prepared session.
	 */
	workspaceSessionId: string | null = null;

	/**
	 * Returns the current session: workspace session first, then active.
	 * Prefers the session the user is viewing over the one with a running timer.
	 */
	getCurrentSession(): Session | null {
		return (this.workspaceSessionId ? this.getSessionById(this.workspaceSessionId) : null)
			?? this.getActiveSession();
	}

	// ── Template CRUD ───────────────────────────────────────

	/**
	 * Returns all saved templates.
	 */
	getSavedTemplates(): SessionTemplate[] {
		return [...(this.state.savedTemplates ?? [])];
	}

	/**
	 * Returns a single template by ID, or undefined.
	 */
	getTemplate(id: string): SessionTemplate | undefined {
		return this.state.savedTemplates?.find((t) => t.id === id);
	}

	/**
	 * Saves a new template. Evicts oldest if over MAX_TEMPLATES.
	 */
	async saveTemplate(template: Omit<SessionTemplate, "id" | "createdAt">): Promise<SessionTemplate> {
		const saved: SessionTemplate = {
			...template,
			id: `tmpl_${generateUUID()}`,
			createdAt: Date.now(),
		};

		if (!this.state.savedTemplates) this.state.savedTemplates = [];
		this.state.savedTemplates.push(saved);

		// Evict oldest if over capacity
		if (this.state.savedTemplates.length > MAX_TEMPLATES) {
			this.state.savedTemplates = this.state.savedTemplates
				.sort((a, b) => b.createdAt - a.createdAt)
				.slice(0, MAX_TEMPLATES);
		}

		await this.saveState();
		return { ...saved };
	}

	/**
	 * Partially updates an existing template.
	 */
	async updateTemplate(id: string, updates: Partial<Pick<SessionTemplate, "name" | "type" | "durationMinutes" | "description">>): Promise<void> {
		const tmpl = this.state.savedTemplates?.find((t) => t.id === id);
		if (!tmpl) return;
		Object.assign(tmpl, updates);
		await this.saveState();
	}

	/**
	 * Deletes a template by ID.
	 */
	async deleteTemplate(id: string): Promise<void> {
		if (!this.state.savedTemplates) return;
		const index = this.state.savedTemplates.findIndex((t) => t.id === id);
		if (index === -1) return;
		this.state.savedTemplates.splice(index, 1);
		await this.saveState();
	}

	/**
	 * Creates a template from any session.
	 */
	async saveTemplateFromSession(sessionId: string, name: string): Promise<SessionTemplate | null> {
		const session = this.findSession(sessionId);
		if (!session) return null;

		return this.saveTemplate({
			name,
			type: session.type,
			durationMinutes: session.durationMinutes,
			focusFile: session.focusFile ?? undefined,
			goals: session.goals.length > 0 ? session.goals.map((g) => g.text) : undefined,
			decisions: session.decisions.length > 0 ? session.decisions.map((d) => d.title) : undefined,
		});
	}

	// ── Rerun & Create from Template ────────────────────────

	/**
	 * Creates a new "prepared" session from a completed or archived session.
	 * Appends (N) suffix to the title.
	 */
	async rerunSession(sessionId: string): Promise<Session | null> {
		const session = this.findSession(sessionId);
		if (!session || (session.status !== "completed" && session.status !== "archived")) return null;

		return this.handleCreate({
			type: session.type,
			title: generateRerunTitle(session.title),
			durationMinutes: session.durationMinutes,
			focusFile: session.focusFile ?? undefined,
			goals: session.goals.map((g) => g.text),
			decisions: session.decisions.map((d) => d.title),
		});
	}

	/**
	 * Creates a new session from a saved template.
	 */
	async createFromTemplate(templateId: string, titleOverride?: string): Promise<void> {
		const tmpl = this.getTemplate(templateId);
		if (!tmpl) return;

		await this.handleCreate({
			type: tmpl.type,
			title: titleOverride ?? tmpl.name,
			durationMinutes: tmpl.durationMinutes,
			focusFile: tmpl.focusFile,
			goals: tmpl.goals,
			decisions: tmpl.decisions,
		});
	}

	/**
	 * Unsubscribes from event bus listeners and stops the timer.
	 */
	dispose(): void {
		this.stopTimer();
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	// ── Command handlers ─────────────────────────────────────

	private async handleCreate(payload: { type: string; title: string; durationMinutes: number; focusFile?: string; goals?: string[]; decisions?: string[] }): Promise<Session> {
		const id = `session_${generateUUID()}`;
		const session = createSession(
			id,
			payload.type as Session["type"],
			payload.title,
			payload.durationMinutes,
			payload.focusFile,
		);

		// Auto-set notes file path (include short ID suffix to avoid case-insensitive collisions)
		const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
		const shortId = id.slice(-6);
		session.notesFile = `${SESSION_NOTES_FOLDER}/${safeName} (${shortId}).md`;

		// Populate goals from text strings if provided
		if (payload.goals && payload.goals.length > 0) {
			session.goals = payload.goals.map((text) => createGoal(`goal_${generateUUID()}`, text));
		}

		// Populate decisions from titles if provided (from template/rerun)
		if (payload.decisions && payload.decisions.length > 0) {
			session.decisions = payload.decisions.map((title) => createDecision(`dec_${generateUUID()}`, title, ""));
		}

		this.state.sessions.unshift(session);

		// Evict oldest if over capacity
		if (this.state.sessions.length > MAX_SESSIONS) {
			this.state.sessions = this.state.sessions.slice(0, MAX_SESSIONS);
		}

		await this.saveState();
		await this.eventBus?.emit("session.created", { session: { ...session } });
		return { ...session };
	}

	private async handleStart(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "prepared") return;

		// Only one active session at a time
		if (this.state.activeSessionId) return;

		session.status = "active";
		session.startedAt = new Date().toISOString();
		this.state.activeSessionId = session.id;
		session.timeline.push({ action: "started", timestamp: session.startedAt });

		this.startTimer(session);
		await this.saveState();
		await this.eventBus?.emit("session.started", { session: { ...session } });
	}

	private async handlePause(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "active") return;

		const now = Date.now();
		if (session.startedAt) {
			session.elapsedBeforePauseMs += now - Date.parse(session.startedAt);
		}
		session.status = "paused";
		session.pausedAt = new Date(now).toISOString();
		session.startedAt = null;
		session.timeline.push({ action: "paused", timestamp: session.pausedAt });

		this.stopTimer();
		await this.saveState();
		await this.eventBus?.emit("session.paused", { session: { ...session } });
		// Request workspace state capture from view
		await this.eventBus?.emit("session.state.save", { sessionId: session.id });
	}

	private async handleResume(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "paused") return;

		// Only one active session at a time
		if (this.state.activeSessionId && this.state.activeSessionId !== session.id) return;

		session.status = "active";
		session.startedAt = new Date().toISOString();
		session.pausedAt = null;
		this.state.activeSessionId = session.id;
		session.timeline.push({ action: "resumed", timestamp: session.startedAt });

		this.startTimer(session);
		await this.saveState();
		await this.eventBus?.emit("session.resumed", { session: { ...session } });
		// Restore workspace state if previously saved
		if (session.workspaceState) {
			await this.eventBus?.emit("session.state.restore", { sessionId: session.id, state: session.workspaceState });
		}
	}

	private async handleComplete(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status === "completed" || session.status === "archived") return;

		await this.completeSession(session);
	}

	private async handleArchive(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "completed") return;

		session.status = "archived";
		// Clear activity on archive — operational data, not session record
		session.activity = [];
		await this.saveState();
		await this.eventBus?.emit("session.archived", { session: { ...session } });
	}

	private async handleDelete(sessionId: string): Promise<void> {
		const index = this.state.sessions.findIndex((s) => s.id === sessionId);
		if (index === -1) return;

		if (this.state.activeSessionId === sessionId) {
			this.stopTimer();
			this.state.activeSessionId = null;
		}

		this.state.sessions.splice(index, 1);
		await this.saveState();
		await this.eventBus?.emit("session.deleted", { sessionId });
	}

	// ── Goal handlers ───────────────────────────────────────

	private async handleGoalAdd(sessionId: string, text: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const goal: SessionGoal = createGoal(`goal_${generateUUID()}`, text);
		session.goals.push(goal);
		await this.saveState();
		await this.eventBus?.emit("session.goal.added", { sessionId, goal: { ...goal } });
	}

	private async handleGoalToggle(sessionId: string, goalId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const goal = session.goals.find((g) => g.id === goalId);
		if (!goal) return;

		goal.completed = !goal.completed;
		goal.completedAt = goal.completed ? new Date().toISOString() : null;
		await this.saveState();
		await this.eventBus?.emit("session.goal.toggled", { sessionId, goalId, completed: goal.completed });
	}

	private async handleGoalRemove(sessionId: string, goalId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const index = session.goals.findIndex((g) => g.id === goalId);
		if (index === -1) return;

		session.goals.splice(index, 1);
		await this.saveState();
		await this.eventBus?.emit("session.goal.removed", { sessionId, goalId });
	}

	// ── Duration handler ────────────────────────────────────

	private async handleDurationUpdate(sessionId: string, durationMinutes: number): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "prepared") return;
		if (durationMinutes < 1) return;

		session.durationMinutes = durationMinutes;
		await this.saveState();
		await this.eventBus?.emit("session.duration.updated", { sessionId, durationMinutes });
	}

	// ── Notes handler ───────────────────────────────────────

	private async handleNotesUpdate(sessionId: string, notes: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		session.notes = notes;
		await this.saveState();
		await this.eventBus?.emit("session.notes.updated", { sessionId, notes });
	}

	// ── Notes file handler ──────────────────────────────────

	private async handleNotesFileSet(sessionId: string, path: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		session.notesFile = path;
		await this.saveState();
		await this.eventBus?.emit("session.notesFile.updated", { sessionId, path });
	}

	// ── Canvas file handler ────────────────────────────────

	private async handleCanvasFileSet(sessionId: string, path: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		session.canvasFile = path;
		await this.saveState();
		await this.eventBus?.emit("session.canvasFile.updated", { sessionId, path });
	}

	// ── Link handlers ───────────────────────────────────────

	private async handleLinkAdd(sessionId: string, path: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		// Deduplicate by path
		if (session.links.some((l) => l.path === path)) return;

		const link: SessionLink = { path, addedAt: new Date().toISOString() };
		session.links.push(link);
		await this.saveState();
		await this.eventBus?.emit("session.link.added", { sessionId, link: { ...link } });
	}

	private async handleLinkRemove(sessionId: string, path: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const index = session.links.findIndex((l) => l.path === path);
		if (index === -1) return;

		session.links.splice(index, 1);
		await this.saveState();
		await this.eventBus?.emit("session.link.removed", { sessionId, path });
	}

	// ── Context binding handlers ────────────────────────────

	private async handleContextBind(sessionId: string, path: string, type: ContextBindingType): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		if (session.contextBindings.some((b) => b.path === path)) return;
		if (session.contextBindings.length >= MAX_CONTEXT_BINDINGS) return;

		const binding: SessionContextBinding = createContextBinding(`ctx_${generateUUID()}`, type, path);
		session.contextBindings.push(binding);
		await this.saveState();
		await this.eventBus?.emit("session.context.bound", { sessionId, binding: { ...binding } });
	}

	private async handleContextUnbind(sessionId: string, bindingId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const index = session.contextBindings.findIndex((b) => b.id === bindingId);
		if (index === -1) return;

		session.contextBindings.splice(index, 1);
		await this.saveState();
		await this.eventBus?.emit("session.context.unbound", { sessionId, bindingId });
	}

	private async handleContextChangeType(sessionId: string, bindingId: string, type: ContextBindingType): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const binding = session.contextBindings.find((b) => b.id === bindingId);
		if (!binding) return;

		binding.type = type;
		await this.saveState();
		await this.eventBus?.emit("session.context.typeChanged", { sessionId, bindingId, type });
	}

	// ── Decision handlers ─────────────────────────────────────

	private async handleDecisionRecord(sessionId: string, title: string, description?: string, context?: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || !title.trim()) return;
		if (session.decisions.length >= MAX_SESSION_DECISIONS) return;

		const decision = createDecision(`dec_${generateUUID()}`, title.trim(), description?.trim() || undefined, context?.trim() || undefined);
		session.decisions.push(decision);
		await this.saveState();
		await this.eventBus?.emit("session.decision.recorded", { sessionId, decision: { ...decision } });
	}

	private async handleDecisionRemove(sessionId: string, decisionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const idx = session.decisions.findIndex((d) => d.id === decisionId);
		if (idx === -1) return;

		session.decisions.splice(idx, 1);
		await this.saveState();
		await this.eventBus?.emit("session.decision.removed", { sessionId, decisionId });
	}

	// ── Type configuration handlers ─────────────────────────

	private async handleTypeCreate(config: SessionTypeConfig): Promise<void> {
		if (!config.type || !config.label) return;
		// Don't allow overwriting built-in types via create
		if (SESSION_TYPE_CONFIGS[config.type as keyof typeof SESSION_TYPE_CONFIGS]) return;

		this.customSessionTypes[config.type] = { ...config };
		await this.eventBus?.emit("settings.updateCustomSessionTypes", { types: { ...this.customSessionTypes } });
		await this.eventBus?.emit("session.type.created", { config: { ...config } });
	}

	private async handleTypeConfigure(type: string, updates: Partial<SessionTypeConfig>): Promise<void> {
		const existing = resolveTypeConfig(type as Session["type"], this.customSessionTypes);
		const merged: SessionTypeConfig = { ...existing, ...updates, type: type as Session["type"] };
		this.customSessionTypes[type] = merged;
		await this.eventBus?.emit("settings.updateCustomSessionTypes", { types: { ...this.customSessionTypes } });
		await this.eventBus?.emit("session.type.configured", { type: type as Session["type"], config: { ...merged } });
	}

	// ── Workspace state handlers ────────────────────────────

	private async handleStateSaved(sessionId: string, state: WorkspaceState): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		session.workspaceState = state;
		await this.saveState();
	}

	// ── Output artifact handler ─────────────────────────────

	private async handleOutputGenerate(sessionId: string, template: SessionOutputTemplate): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;
		// Only allow output generation for completed/archived sessions
		if (session.status !== "completed" && session.status !== "archived") return;
		// Enforce max cap
		if (session.outputArtifacts.length >= MAX_OUTPUT_ARTIFACTS) return;

		const content = generateSessionOutput(session, template);
		const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
		const shortId = session.id.slice(-6);
		const path = `${SESSION_NOTES_FOLDER}/${safeName} - ${template.title} (${shortId}).md`;

		// Create file if FileSystemClient is available
		if (this.fileSystem) {
			try {
				await this.fileSystem.createFile(path, content);
			} catch {
				// File may already exist — continue to persist artifact
			}
		}

		// Append wikilink to session notes file if it exists
		if (session.notesFile && this.fileSystem) {
			const date = new Date().toISOString().split("T")[0];
			const wikilink = `- [[${path}]] *(generated ${date})*`;
			try {
				const existing = await this.fileSystem.readFile(session.notesFile);
				if (existing !== null && !existing.includes(`[[${path}]]`)) {
					const section = existing.includes("## Output Artifacts")
						? ""
						: "\n## Output Artifacts\n";
					await this.fileSystem.updateFile(session.notesFile, existing + section + wikilink + "\n");
				}
			} catch {
				// Notes file doesn't exist or can't be read — skip gracefully
			}
		}

		const artifact: SessionOutputArtifact = {
			type: template.type,
			path,
			generatedAt: new Date().toISOString(),
		};
		session.outputArtifacts.push(artifact);
		await this.saveState();
		await this.eventBus?.emit("session.output.generated", { sessionId, artifact });
	}

	// ── Timer ────────────────────────────────────────────────

	private startTimer(session: Session): void {
		this.stopTimer();
		this.timerInterval = setInterval(() => {
			const now = Date.now();
			const remaining = computeRemainingMs(session, now);
			const elapsed = computeElapsedMs(session, now);

			if (remaining <= 0) {
				this.stopTimer();
				void this.completeSession(session);
				void this.eventBus?.emit("session.timer.completed", { sessionId: session.id });
			} else {
				void this.eventBus?.emit("session.timer.tick", {
					sessionId: session.id,
					remainingMs: remaining,
					elapsedMs: elapsed,
				});
			}
		}, 1000);
	}

	private stopTimer(): void {
		if (this.timerInterval !== null) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	// ── Artifact tracking ────────────────────────────────────

	private async onFileEvent(path: string, action: "created" | "modified"): Promise<void> {
		if (!this.state.activeSessionId) return;

		const session = this.findSession(this.state.activeSessionId);
		if (!session || session.status !== "active") return;

		// Deduplicate: same path+action within ARTIFACT_DEDUP_WINDOW_MS
		const now = Date.now();
		const isDuplicate = session.artifacts.some(
			(a) => a.path === path && a.action === action &&
				(now - Date.parse(a.timestamp)) < ARTIFACT_DEDUP_WINDOW_MS,
		);
		if (isDuplicate) return;

		const artifact = { path, action, timestamp: new Date(now).toISOString() };
		session.artifacts.push(artifact);
		await this.saveState();
		await this.eventBus?.emit("session.artifact.added", { sessionId: session.id, artifact });
	}

	// ── Activity tracking (ADR-025, ADR-026) ────────────────

	private async onActivityEvent(path: string, action: SessionActivityAction, oldPath?: string): Promise<void> {
		if (!this.state.activeSessionId) return;

		const session = this.findSession(this.state.activeSessionId);
		if (!session || session.status !== "active") return;

		// Apply folder filters (ADR-026)
		if (isExcluded(path, this.globalActivityFilter, session.activityFilter)) return;

		// Deduplicate: same path+action within ACTIVITY_DEDUP_WINDOW_MS
		const now = Date.now();
		const isDuplicate = session.activity.some(
			(a) => a.path === path && a.action === action &&
				(now - Date.parse(a.timestamp)) < ACTIVITY_DEDUP_WINDOW_MS,
		);
		if (isDuplicate) return;

		const entry: SessionActivity = { timestamp: new Date(now).toISOString(), action, path };
		if (oldPath !== undefined) entry.oldPath = oldPath;

		session.activity.push(entry);

		// Cap at MAX_SESSION_ACTIVITY — evict oldest
		if (session.activity.length > MAX_SESSION_ACTIVITY) {
			session.activity = session.activity.slice(-MAX_SESSION_ACTIVITY);
		}

		await this.saveState();
		await this.eventBus?.emit("session.activity.tracked", { sessionId: session.id, activity: { ...entry } });
	}

	async updateActivityFilter(sessionId: string, filter: string[]): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		session.activityFilter = [...filter];
		await this.saveState();
		await this.eventBus?.emit("session.activity.filter.updated", { sessionId, filter: [...filter] });
	}

	// ── Path reconciliation (file/folder rename) ────────────

	/**
	 * Updates all session and template paths when a file is renamed/moved.
	 * Covers: focusFile, notesFile, canvasFile, contextBindings, artifacts, links.
	 */
	private async handleFileRenamed(oldPath: string, newPath: string): Promise<void> {
		const affectedIds = new Set<string>();

		for (const session of this.state.sessions) {
			let hit = false;
			if (session.focusFile === oldPath) { session.focusFile = newPath; hit = true; }
			if (session.notesFile === oldPath) { session.notesFile = newPath; hit = true; }
			if (session.canvasFile === oldPath) { session.canvasFile = newPath; hit = true; }
			for (const binding of session.contextBindings) {
				if (binding.path === oldPath) { binding.path = newPath; hit = true; }
			}
			for (const artifact of session.artifacts) {
				if (artifact.path === oldPath) { artifact.path = newPath; hit = true; }
			}
			for (const link of session.links) {
				if (link.path === oldPath) { link.path = newPath; hit = true; }
			}
			if (hit) affectedIds.add(session.id);
		}

		for (const tmpl of this.state.savedTemplates ?? []) {
			if (tmpl.focusFile === oldPath) { tmpl.focusFile = newPath; }
		}

		if (affectedIds.size > 0) {
			await this.saveState();
			await this.eventBus?.emit("session.paths.updated", { sessionIds: [...affectedIds] });
		}
	}

	/**
	 * Updates all session and template paths when a folder is renamed/moved.
	 * Uses prefix matching to catch all children under the renamed folder.
	 */
	private async handleFolderRenamed(oldPath: string, newPath: string): Promise<void> {
		const affectedIds = new Set<string>();
		const oldPrefix = oldPath + "/";

		for (const session of this.state.sessions) {
			let hit = false;
			if (session.focusFile && session.focusFile.startsWith(oldPrefix)) {
				session.focusFile = newPath + session.focusFile.slice(oldPath.length); hit = true;
			}
			if (session.notesFile && session.notesFile.startsWith(oldPrefix)) {
				session.notesFile = newPath + session.notesFile.slice(oldPath.length); hit = true;
			}
			if (session.canvasFile && session.canvasFile.startsWith(oldPrefix)) {
				session.canvasFile = newPath + session.canvasFile.slice(oldPath.length); hit = true;
			}
			for (const binding of session.contextBindings) {
				if (binding.path === oldPath + "/" || binding.path.startsWith(oldPrefix)) {
					binding.path = newPath + binding.path.slice(oldPath.length); hit = true;
				}
			}
			for (const artifact of session.artifacts) {
				if (artifact.path.startsWith(oldPrefix)) {
					artifact.path = newPath + artifact.path.slice(oldPath.length); hit = true;
				}
			}
			for (const link of session.links) {
				if (link.path.startsWith(oldPrefix)) {
					link.path = newPath + link.path.slice(oldPath.length); hit = true;
				}
			}
			for (let i = 0; i < session.activityFilter.length; i++) {
				if (session.activityFilter[i] === oldPath || session.activityFilter[i].startsWith(oldPrefix)) {
					session.activityFilter[i] = newPath + session.activityFilter[i].slice(oldPath.length); hit = true;
				}
			}
			if (hit) affectedIds.add(session.id);
		}

		for (const tmpl of this.state.savedTemplates ?? []) {
			if (tmpl.focusFile && tmpl.focusFile.startsWith(oldPrefix)) {
				tmpl.focusFile = newPath + tmpl.focusFile.slice(oldPath.length);
			}
		}

		if (affectedIds.size > 0) {
			await this.saveState();
			await this.eventBus?.emit("session.paths.updated", { sessionIds: [...affectedIds] });
		}
	}

	// ── Shared helpers ───────────────────────────────────────

	private async completeSession(session: Session): Promise<void> {
		// Accumulate final elapsed time if still active
		if (session.startedAt) {
			session.elapsedBeforePauseMs += Date.now() - Date.parse(session.startedAt);
			session.startedAt = null;
		}

		session.status = "completed";
		session.completedAt = new Date().toISOString();
		session.pausedAt = null;
		session.timeline.push({ action: "completed", timestamp: session.completedAt });

		if (this.state.activeSessionId === session.id) {
			this.stopTimer();
			this.state.activeSessionId = null;
		}

		await this.saveState();
		await this.eventBus?.emit("session.completed", { session: { ...session } });
		// Request workspace state capture from view
		await this.eventBus?.emit("session.state.save", { sessionId: session.id });
	}

	private findSession(id: string): Session | undefined {
		return this.state.sessions.find((s) => s.id === id);
	}

	private async saveState(): Promise<void> {
		await this.storage.save(this.state);
	}

	private async emitLoaded(): Promise<void> {
		await this.eventBus?.emit("session.loaded", {
			sessions: this.getSessions(),
			activeSessionId: this.state.activeSessionId,
			savedTemplates: this.getSavedTemplates(),
		});
	}
}

/**
 * Generates a rerun title by appending or incrementing a `(N)` suffix.
 * "Sprint 12" → "Sprint 12 (2)"
 * "Sprint 12 (2)" → "Sprint 12 (3)"
 */
export function generateRerunTitle(title: string): string {
	const match = title.match(/^(.+?)\s*\((\d+)\)$/);
	if (match) {
		return `${match[1]} (${Number(match[2]) + 1})`;
	}
	return `${title} (2)`;
}
