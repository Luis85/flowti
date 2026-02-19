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
import type { ClosureResponse, ContextBindingType, EnergyLevel, ExecutionTask, Session, SessionActivity, SessionActivityAction, SessionContextBinding, SessionGoal, SessionIntent, SessionLink, SessionOutputArtifact, SessionOutputTemplate, SessionState, SessionStatusV2, SessionTemplate, SessionTemplateExport, SessionTypeConfig, WorkspaceState } from "./types";
import { MAX_SESSIONS, MAX_TEMPLATES, ARTIFACT_DEDUP_WINDOW_MS, SESSION_NOTES_FOLDER, MAX_SESSION_ACTIVITY, ACTIVITY_DEDUP_WINDOW_MS, MAX_CONTEXT_BINDINGS, MAX_SESSION_DECISIONS, MAX_OUTPUT_ARTIFACTS, SESSION_TYPE_CONFIGS } from "./types";
import { createSession, createGoal, createDecision, createContextBinding, computeRemainingMs, computeElapsedMs, isTimerExpired, isExcluded, isValidTransition, resolveTypeConfig, generateSessionOutput, updateSessionPathsForFileMove, updateSessionPathsForFolderMove, updateTemplatePathForFileMove, updateTemplatePathForFolderMove, mergeSessionNotes, reverseParseSessionNotes, computeReverseSyncDiff, detectCognitiveOverload } from "./helpers";
import { SESSION_NOTES_SYNC_DELAY_MS } from "./types";

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
	private noteSyncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private lastSyncedContent: Map<string, string> = new Map();
	private reverseSyncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private lastOverloadReasons: Map<string, string> = new Map();
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

			// Reverse sync: note file edits → session state
			this.unsubscribes.push(
				this.eventBus.on("file.modified", (event) => {
					const session = this.findSessionByNotesFile(event.payload.path);
					if (session) {
						this.scheduleReverseSync(session.id, event.payload.path);
					}
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
			this.unsubscribes.push(
				this.eventBus.on("session.goal.reorder", (event) => {
					void this.handleGoalReorder(event.payload.sessionId, event.payload.goalIds);
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

			// v2: Intent command (ADR-031)
			this.unsubscribes.push(
				this.eventBus.on("session.intent.set", (event) => {
					void this.handleSetIntent(event.payload.sessionId, event.payload.intent);
				}),
			);

			// v2: Energy command (ADR-031, FR-11)
			this.unsubscribes.push(
				this.eventBus.on("session.energy.set", (event) => {
					void this.handleEnergyChange(event.payload.sessionId, event.payload.level);
				}),
			);

			// v2: Execution task commands (ADR-031, FR-12)
			this.unsubscribes.push(
				this.eventBus.on("session.task.add", (event) => {
					void this.handleTaskAdd(event.payload.sessionId, event.payload.label);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.task.toggle", (event) => {
					void this.handleTaskToggle(event.payload.sessionId, event.payload.taskId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.task.remove", (event) => {
					void this.handleTaskRemove(event.payload.sessionId, event.payload.taskId);
				}),
			);
			this.unsubscribes.push(
				this.eventBus.on("session.task.reorder", (event) => {
					void this.handleTaskReorder(event.payload.sessionId, event.payload.taskIds);
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
				// v2 backward compat (ADR-031): map "active" → "running", init v2 fields
				if (s.status === "active") {
					s.status = "running";
				}
				if (s.intent === undefined) {
					s.intent = null;
				}
				if (s.energy === undefined) {
					s.energy = null;
				}
				if (!s.executionTasks) {
					s.executionTasks = [];
				}
				if (!s.reflections) {
					s.reflections = [];
				}
				if (s.closureResponse === undefined) {
					s.closureResponse = null;
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
			if (session && session.status === "running") {
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
			tasks: session.executionTasks.length > 0 ? session.executionTasks.map((t) => t.label) : undefined,
			contextBindings: session.contextBindings.length > 0
				? session.contextBindings.map((b) => ({ path: b.path, type: b.type }))
				: undefined,
			notes: session.notes.trim() || undefined,
		});
	}

	// ── Template Import/Export ──────────────────────────────

	/**
	 * Exports a template as a JSON-serializable object.
	 * Returns null if the template is not found.
	 */
	exportTemplate(id: string): SessionTemplateExport | null {
		const tmpl = this.getTemplate(id);
		if (!tmpl) return null;

		const exportData: SessionTemplateExport = {
			version: 1,
			template: {
				name: tmpl.name,
				type: tmpl.type,
				durationMinutes: tmpl.durationMinutes,
				...(tmpl.description !== undefined && { description: tmpl.description }),
				...(tmpl.focusFile !== undefined && { focusFile: tmpl.focusFile }),
				...(tmpl.goals !== undefined && { goals: tmpl.goals }),
				...(tmpl.decisions !== undefined && { decisions: tmpl.decisions }),
				...(tmpl.tasks !== undefined && { tasks: tmpl.tasks }),
				...(tmpl.contextBindings !== undefined && { contextBindings: tmpl.contextBindings }),
				...(tmpl.notes !== undefined && { notes: tmpl.notes }),
			},
		};

		void this.eventBus?.emit("session.template.exported", { template: tmpl });
		return exportData;
	}

	/**
	 * Imports a template from a JSON object.
	 * Validates the shape, checks for duplicate names, and saves.
	 * Returns the saved template or null if validation fails.
	 */
	async importTemplate(data: unknown): Promise<SessionTemplate | null> {
		if (!isValidTemplateExport(data)) return null;

		const existing = this.getSavedTemplates();
		if (existing.some((t) => t.name === data.template.name)) return null;

		const saved = await this.saveTemplate(data.template);
		void this.eventBus?.emit("session.template.imported", { template: saved });
		return saved;
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
			tasks: session.executionTasks.map((t) => t.label),
			contextBindings: session.contextBindings.map((b) => ({ path: b.path, type: b.type })),
			notes: session.notes.trim() || undefined,
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
			tasks: tmpl.tasks,
			contextBindings: tmpl.contextBindings,
			notes: tmpl.notes,
		});
	}

	// ── Cognitive Overload Detection (FR-16) ────────────────

	/**
	 * Runs cognitive overload detection and emits event if reasons changed.
	 * Only emits when the set of reasons differs from the previous check
	 * to avoid flooding listeners with duplicate events.
	 */
	private checkCognitiveOverload(sessionId: string): void {
		const session = this.findSession(sessionId);
		if (!session || (session.status !== "running" && session.status !== "paused")) return;

		const result = detectCognitiveOverload(session);
		const key = result.reasons.join("|");
		const prev = this.lastOverloadReasons.get(sessionId) ?? "";

		if (key !== prev) {
			this.lastOverloadReasons.set(sessionId, key);
			if (result.overloaded) {
				void this.eventBus?.emit("session.overload.detected", {
					sessionId,
					reasons: result.reasons,
				});
			}
		}
	}

	/**
	 * Unsubscribes from event bus listeners and stops the timer.
	 */
	dispose(): void {
		this.stopTimer();
		for (const timer of this.noteSyncTimers.values()) clearTimeout(timer);
		this.noteSyncTimers.clear();
		for (const timer of this.reverseSyncTimers.values()) clearTimeout(timer);
		this.reverseSyncTimers.clear();
		this.lastSyncedContent.clear();
		this.lastOverloadReasons.clear();
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	// ── Notes file sync ──────────────────────────────────────

	/**
	 * Schedules a debounced sync of the session's notes file.
	 * Multiple calls within the delay window coalesce into a single write.
	 */
	private scheduleSyncNotesFile(sessionId: string): void {
		if (!this.fileSystem) return;
		const session = this.findSession(sessionId);
		if (!session?.notesFile) return;

		const existing = this.noteSyncTimers.get(sessionId);
		if (existing) clearTimeout(existing);

		this.noteSyncTimers.set(
			sessionId,
			setTimeout(() => {
				this.noteSyncTimers.delete(sessionId);
				void this.syncNotesFile(sessionId);
			}, SESSION_NOTES_SYNC_DELAY_MS),
		);
	}

	/**
	 * Reads the session's notes file, merges current session state, and writes it back.
	 * Only syncs if the file already exists (user must create it first).
	 */
	private async syncNotesFile(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session?.notesFile || !this.fileSystem) return;

		try {
			const exists = await this.fileSystem.fileExists(session.notesFile);
			if (!exists) return;

			const existing = await this.fileSystem.readFile(session.notesFile);
			const merged = mergeSessionNotes(existing, session);
			await this.fileSystem.updateFile(session.notesFile, merged);
			this.lastSyncedContent.set(session.notesFile, merged);
			await this.eventBus?.emit("session.notes.synced", { sessionId, path: session.notesFile });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await this.eventBus?.emit("session.notes.syncFailed", { sessionId, path: session.notesFile ?? "", error: msg });
		}
	}

	// ── Reverse sync (note file → session) ──────────────────

	private findSessionByNotesFile(path: string): Session | undefined {
		return this.state.sessions.find(s => s.notesFile === path);
	}

	private scheduleReverseSync(sessionId: string, path: string): void {
		if (!this.fileSystem) return;

		const existing = this.reverseSyncTimers.get(sessionId);
		if (existing) clearTimeout(existing);

		this.reverseSyncTimers.set(
			sessionId,
			setTimeout(() => {
				this.reverseSyncTimers.delete(sessionId);
				void this.executeReverseSync(sessionId, path);
			}, SESSION_NOTES_SYNC_DELAY_MS),
		);
	}

	private async executeReverseSync(sessionId: string, path: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session?.notesFile || session.notesFile !== path || !this.fileSystem) return;

		try {
			const content = await this.fileSystem.readFile(path);

			// Skip if file content matches what we last wrote (our own forward sync)
			if (content === this.lastSyncedContent.get(path)) return;

			const parsed = reverseParseSessionNotes(content);
			const diff = computeReverseSyncDiff(session, parsed);
			if (diff.changes.length === 0) return;

			for (const toggle of diff.goalToggles) {
				const goal = session.goals.find(g => g.id === toggle.goalId);
				if (goal) goal.completed = toggle.completed;
			}
			for (const ng of diff.newGoals) {
				const goal = createGoal(`goal_${generateUUID()}`, ng.label);
				if (ng.checked) goal.completed = true;
				session.goals.push(goal);
			}
			for (const toggle of diff.taskToggles) {
				const task = session.executionTasks.find(t => t.id === toggle.taskId);
				if (task) task.completed = toggle.completed;
			}
			for (const nt of diff.newTasks) {
				const task: ExecutionTask = {
					id: `task_${generateUUID()}`,
					label: nt.label,
					completed: nt.checked,
					order: session.executionTasks.length,
				};
				session.executionTasks.push(task);
			}
			if (diff.notesUpdate !== null) {
				session.notes = diff.notesUpdate;
			}

			await this.saveState();
			await this.eventBus?.emit("session.notes.reverseSynced", { sessionId, path, changes: diff.changes });

			// Forward sync only when structural changes need normalization (new items added).
			// Simple toggles and text edits already match the note — rewriting would cause editor flicker.
			if (diff.newGoals.length > 0 || diff.newTasks.length > 0) {
				this.scheduleSyncNotesFile(sessionId);
			}
		} catch {
			// Reverse sync errors are non-critical — silently ignore
		}
	}

	// ── Command handlers ─────────────────────────────────────

	private async handleCreate(payload: { type: string; title: string; durationMinutes: number; focusFile?: string; goals?: string[]; decisions?: string[]; tasks?: string[]; contextBindings?: Array<{ path: string; type: ContextBindingType }>; notes?: string }): Promise<Session> {
		const id = `session_${generateUUID()}`;
		const session = createSession(
			id,
			payload.type as Session["type"],
			payload.title,
			payload.durationMinutes,
			payload.focusFile,
		);

		// Auto-set notes file path (ISO date prefix + short ID suffix to avoid collisions)
		const datePrefix = new Date().toISOString().split("T")[0];
		const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
		const shortId = id.slice(-6);
		session.notesFile = `${SESSION_NOTES_FOLDER}/${datePrefix} ${safeName} (${shortId}).md`;

		// Default focusFile to notesFile if not explicitly set
		if (!session.focusFile) {
			session.focusFile = session.notesFile;
		}

		// Populate goals from text strings if provided
		if (payload.goals && payload.goals.length > 0) {
			session.goals = payload.goals.map((text) => createGoal(`goal_${generateUUID()}`, text));
		}

		// Populate decisions from titles if provided (from template/rerun)
		if (payload.decisions && payload.decisions.length > 0) {
			session.decisions = payload.decisions.map((title) => createDecision(`dec_${generateUUID()}`, title, ""));
		}

		// Populate execution tasks from labels if provided (from template/rerun)
		if (payload.tasks && payload.tasks.length > 0) {
			session.executionTasks = payload.tasks.map((label, i): ExecutionTask => ({
				id: `task_${generateUUID()}`,
				label,
				completed: false,
				order: i,
			}));
		}

		// Populate context bindings from paths if provided (from template/rerun)
		if (payload.contextBindings && payload.contextBindings.length > 0) {
			session.contextBindings = payload.contextBindings.map((cb) =>
				createContextBinding(`ctx_${generateUUID()}`, cb.type, cb.path),
			);
		}

		// Populate notes if provided (from template/rerun)
		if (payload.notes) {
			session.notes = payload.notes;
		}

		this.state.sessions.unshift(session);

		// Evict oldest if over capacity
		if (this.state.sessions.length > MAX_SESSIONS) {
			this.state.sessions = this.state.sessions.slice(0, MAX_SESSIONS);
		}

		await this.saveState();
		this.scheduleSyncNotesFile(session.id);
		await this.eventBus?.emit("session.created", { session: { ...session } });
		return { ...session };
	}

	private async handleStart(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "prepared") return;

		// Only one active session at a time
		if (this.state.activeSessionId) return;

		session.status = "running";
		session.startedAt = new Date().toISOString();
		this.state.activeSessionId = session.id;
		session.timeline.push({ action: "started", timestamp: session.startedAt });

		this.startTimer(session);
		await this.saveState();
		await this.eventBus?.emit("session.started", { session: { ...session } });
		this.scheduleSyncNotesFile(sessionId);
	}

	private async handlePause(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "running") return;

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
		this.scheduleSyncNotesFile(sessionId);
	}

	private async handleResume(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "paused") return;

		// Only one active session at a time
		if (this.state.activeSessionId && this.state.activeSessionId !== session.id) return;

		session.status = "running";
		session.startedAt = new Date().toISOString();
		session.pausedAt = null;
		this.state.activeSessionId = session.id;
		session.timeline.push({ action: "resumed", timestamp: session.startedAt });

		this.startTimer(session);
		await this.saveState();
		await this.eventBus?.emit("session.resumed", { session: { ...session } });
		this.scheduleSyncNotesFile(sessionId);
		// Restore workspace state if previously saved
		if (session.workspaceState) {
			await this.eventBus?.emit("session.state.restore", { sessionId: session.id, state: session.workspaceState });
		}
	}

	private async handleComplete(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status === "completed" || session.status === "archived" || session.status === "reviewing") return;

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
		this.scheduleSyncNotesFile(sessionId);
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
		this.scheduleSyncNotesFile(sessionId);
	}

	private async handleGoalRemove(sessionId: string, goalId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const index = session.goals.findIndex((g) => g.id === goalId);
		if (index === -1) return;

		session.goals.splice(index, 1);
		await this.saveState();
		await this.eventBus?.emit("session.goal.removed", { sessionId, goalId });
		this.scheduleSyncNotesFile(sessionId);
	}

	private async handleGoalReorder(sessionId: string, goalIds: string[]): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		if (goalIds.length !== session.goals.length) return;
		const goalMap = new Map(session.goals.map((g) => [g.id, g]));
		const reordered: SessionGoal[] = [];
		for (const id of goalIds) {
			const goal = goalMap.get(id);
			if (!goal) return;
			reordered.push(goal);
		}

		session.goals = reordered;
		await this.saveState();
		await this.eventBus?.emit("session.goal.reordered", { sessionId, goalIds });
		this.scheduleSyncNotesFile(sessionId);
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
		this.scheduleSyncNotesFile(sessionId);
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
		this.scheduleSyncNotesFile(sessionId);
		this.checkCognitiveOverload(sessionId);
	}

	private async handleContextUnbind(sessionId: string, bindingId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const index = session.contextBindings.findIndex((b) => b.id === bindingId);
		if (index === -1) return;

		session.contextBindings.splice(index, 1);
		await this.saveState();
		await this.eventBus?.emit("session.context.unbound", { sessionId, bindingId });
		this.scheduleSyncNotesFile(sessionId);
		this.checkCognitiveOverload(sessionId);
	}

	private async handleContextChangeType(sessionId: string, bindingId: string, type: ContextBindingType): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const binding = session.contextBindings.find((b) => b.id === bindingId);
		if (!binding) return;

		binding.type = type;
		await this.saveState();
		await this.eventBus?.emit("session.context.typeChanged", { sessionId, bindingId, type });
		this.scheduleSyncNotesFile(sessionId);
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
		this.scheduleSyncNotesFile(sessionId);
	}

	private async handleDecisionRemove(sessionId: string, decisionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		const idx = session.decisions.findIndex((d) => d.id === decisionId);
		if (idx === -1) return;

		session.decisions.splice(idx, 1);
		await this.saveState();
		await this.eventBus?.emit("session.decision.removed", { sessionId, decisionId });
		this.scheduleSyncNotesFile(sessionId);
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

	// ── v2: Intent & Energy handlers (ADR-031) ────────────────

	/**
	 * Sets or updates the intent for a session.
	 * Only allowed in `prepared` or `paused` states (locked during running).
	 */
	private async handleSetIntent(sessionId: string, intent: SessionIntent): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;
		if (session.status !== "prepared" && session.status !== "paused") return;

		const previous = session.intent;
		session.intent = { ...intent };
		await this.saveState();
		await this.eventBus?.emit("session.intent.updated", { sessionId, intent: { ...intent }, previous });
		if (intent.mode && (!previous || previous.mode !== intent.mode)) {
			await this.eventBus?.emit("session.mode.set", { sessionId, mode: intent.mode });
		}
	}

	/**
	 * Changes the energy level for a session.
	 * Only allowed in `running` or `paused` states.
	 */
	async handleEnergyChange(sessionId: string, level: EnergyLevel): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;
		if (session.status !== "running" && session.status !== "paused") return;

		const before = session.energy;
		session.energy = level;
		await this.saveState();
		await this.eventBus?.emit("session.energy.changed", { sessionId, before, after: level });
		this.scheduleSyncNotesFile(sessionId);
		this.checkCognitiveOverload(sessionId);
	}

	// ── v2: Execution Task event delegates ─────────────────────

	private async handleTaskAdd(sessionId: string, label: string): Promise<void> {
		await this.addTask(sessionId, label);
	}

	private async handleTaskToggle(sessionId: string, taskId: string): Promise<void> {
		await this.toggleTask(sessionId, taskId);
	}

	private async handleTaskRemove(sessionId: string, taskId: string): Promise<void> {
		await this.removeTask(sessionId, taskId);
	}

	private async handleTaskReorder(sessionId: string, taskIds: string[]): Promise<void> {
		await this.reorderTasks(sessionId, taskIds);
	}

	// ── v2: Execution Task handlers (ADR-031, FR-12) ───────────

	/** Allowed states for task operations. */
	private static readonly TASK_ALLOWED_STATES: readonly string[] = ["prepared", "running", "paused"];

	/**
	 * Adds a new execution task to a session.
	 * Only allowed in prepared, running, or paused states.
	 */
	async addTask(sessionId: string, label: string): Promise<ExecutionTask | null> {
		const session = this.findSession(sessionId);
		if (!session || !SessionService.TASK_ALLOWED_STATES.includes(session.status)) return null;

		const task: ExecutionTask = {
			id: `task_${generateUUID()}`,
			label,
			completed: false,
			order: session.executionTasks.length,
		};
		session.executionTasks.push(task);
		await this.saveState();
		await this.eventBus?.emit("session.task.added", { sessionId, task: { ...task } });
		this.scheduleSyncNotesFile(sessionId);
		this.checkCognitiveOverload(sessionId);
		return task;
	}

	/**
	 * Toggles an execution task's completed state.
	 * Only allowed in prepared, running, or paused states.
	 */
	async toggleTask(sessionId: string, taskId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || !SessionService.TASK_ALLOWED_STATES.includes(session.status)) return;

		const task = session.executionTasks.find((t) => t.id === taskId);
		if (!task) return;

		task.completed = !task.completed;
		task.completedAt = task.completed ? new Date().toISOString() : undefined;
		await this.saveState();
		await this.eventBus?.emit("session.task.completed", { sessionId, taskId });
		this.scheduleSyncNotesFile(sessionId);
	}

	/**
	 * Removes an execution task and re-indexes order values.
	 * Only allowed in prepared, running, or paused states.
	 */
	async removeTask(sessionId: string, taskId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || !SessionService.TASK_ALLOWED_STATES.includes(session.status)) return;

		const index = session.executionTasks.findIndex((t) => t.id === taskId);
		if (index === -1) return;

		session.executionTasks.splice(index, 1);
		// Re-index order values
		for (let i = 0; i < session.executionTasks.length; i++) {
			session.executionTasks[i].order = i;
		}
		await this.saveState();
		await this.eventBus?.emit("session.task.removed", { sessionId, taskId });
		this.scheduleSyncNotesFile(sessionId);
		this.checkCognitiveOverload(sessionId);
	}

	/**
	 * Reorders execution tasks by the given ID sequence.
	 * All provided IDs must exist in the session.
	 * Only allowed in prepared, running, or paused states.
	 */
	async reorderTasks(sessionId: string, taskIds: string[]): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || !SessionService.TASK_ALLOWED_STATES.includes(session.status)) return;

		// Validate: all IDs must exist and count must match
		if (taskIds.length !== session.executionTasks.length) return;
		const taskMap = new Map(session.executionTasks.map((t) => [t.id, t]));
		const reordered: ExecutionTask[] = [];
		for (const id of taskIds) {
			const task = taskMap.get(id);
			if (!task) return; // Invalid ID — abort
			reordered.push(task);
		}

		// Apply new order
		for (let i = 0; i < reordered.length; i++) {
			reordered[i].order = i;
		}
		session.executionTasks = reordered;
		await this.saveState();
		await this.eventBus?.emit("session.task.reordered", { sessionId, taskIds });
		this.scheduleSyncNotesFile(sessionId);
	}

	/**
	 * Generic state transition handler (ADR-031).
	 * Validates the transition and delegates to the appropriate handler.
	 */
	async handleStateTransition(sessionId: string, targetState: SessionStatusV2): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;
		const currentStatus = session.status as SessionStatusV2;
		if (!isValidTransition(currentStatus, targetState)) return;

		switch (targetState) {
			case "running":
				if (currentStatus === "prepared") await this.handleStart(sessionId);
				else if (currentStatus === "paused") await this.handleResume(sessionId);
				break;
			case "paused":
				await this.handlePause(sessionId);
				break;
			case "reviewing":
				await this.handleComplete(sessionId);
				break;
			case "completed":
				if (session.status === "reviewing") await this.finishReview(session);
				break;
			case "archived":
				await this.handleArchive(sessionId);
				break;
		}
	}

	// ── Timer ────────────────────────────────────────────────

	private startTimer(session: Session): void {
		this.stopTimer();
		// No timer for sessions without a duration
		if (session.durationMinutes <= 0) return;
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
		if (this.state.activeSessionId) {
			await this.trackArtifactToSession(this.state.activeSessionId, path, action);
		}
	}

	private async trackArtifactToSession(sessionId: string, path: string, action: "created" | "modified"): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "running") return;

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
		// Track to focused session (activeSessionId) with standard dedup window
		if (this.state.activeSessionId) {
			await this.trackActivityToSession(this.state.activeSessionId, path, action, oldPath, ACTIVITY_DEDUP_WINDOW_MS);
		}

	}

	private async trackActivityToSession(
		sessionId: string, path: string, action: SessionActivityAction,
		oldPath: string | undefined, dedupWindowMs: number,
	): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "running") return;

		// Apply folder filters (ADR-026)
		if (isExcluded(path, this.globalActivityFilter, session.activityFilter)) return;

		// Deduplicate: same path+action within dedupWindowMs
		const now = Date.now();
		const isDuplicate = session.activity.some(
			(a) => a.path === path && a.action === action &&
				(now - Date.parse(a.timestamp)) < dedupWindowMs,
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
			if (updateSessionPathsForFileMove(session, oldPath, newPath)) {
				affectedIds.add(session.id);
			}
		}

		for (const tmpl of this.state.savedTemplates ?? []) {
			updateTemplatePathForFileMove(tmpl, oldPath, newPath);
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

		for (const session of this.state.sessions) {
			if (updateSessionPathsForFolderMove(session, oldPath, newPath)) {
				affectedIds.add(session.id);
			}
		}

		for (const tmpl of this.state.savedTemplates ?? []) {
			updateTemplatePathForFolderMove(tmpl, oldPath, newPath);
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

		if (this.state.activeSessionId === session.id) {
			this.stopTimer();
			this.state.activeSessionId = null;
		}
		session.pausedAt = null;

		// FR-14 (Closure Ritual): stop at "reviewing" — the closure overlay
		// gates the reviewing→completed transition on user input.
		session.status = "reviewing";
		session.timeline.push({ action: "reviewing", timestamp: new Date().toISOString() });

		await this.saveState();
		await this.eventBus?.emit("session.closure.started", { sessionId: session.id });
		this.scheduleSyncNotesFile(session.id);
	}

	/**
	 * Transitions a session from reviewing → completed.
	 * Internal helper shared by completeClosure(), skipClosure(), and finishReview().
	 */
	private async transitionToCompleted(session: Session): Promise<void> {
		session.status = "completed";
		session.completedAt = new Date().toISOString();
		session.timeline.push({ action: "completed", timestamp: session.completedAt });

		await this.saveState();
		await this.eventBus?.emit("session.completed", { session: { ...session } });
		await this.eventBus?.emit("session.state.save", { sessionId: session.id });
	}

	/**
	 * Transitions a session from reviewing → completed.
	 * Gated: requires closureResponse to be non-null (FR-14).
	 * Use completeClosure() or skipClosure() instead of calling directly.
	 */
	async finishReview(session: Session): Promise<void> {
		if (session.status !== "reviewing") return;
		if (!session.closureResponse) return; // gate: closure must be completed first
		await this.transitionToCompleted(session);
	}

	/**
	 * Completes the closure ritual by saving the user's response
	 * and transitioning from reviewing → completed.
	 */
	async completeClosure(sessionId: string, response: ClosureResponse): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "reviewing") return;
		session.closureResponse = response;
		await this.transitionToCompleted(session);
		await this.eventBus?.emit("session.closure.completed", { sessionId, response });
		this.scheduleSyncNotesFile(sessionId);
	}

	/**
	 * Skips the closure ritual and transitions directly
	 * from reviewing → completed without a closure response.
	 */
	async skipClosure(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "reviewing") return;
		await this.transitionToCompleted(session);
		this.scheduleSyncNotesFile(sessionId);
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

/**
 * Type guard validating an unknown value is a valid SessionTemplateExport.
 */
function isValidTemplateExport(data: unknown): data is SessionTemplateExport {
	if (typeof data !== "object" || data === null) return false;
	const obj = data as Record<string, unknown>;
	if (obj.version !== 1) return false;
	if (typeof obj.template !== "object" || obj.template === null) return false;

	const tmpl = obj.template as Record<string, unknown>;
	if (typeof tmpl.name !== "string" || tmpl.name.trim().length === 0) return false;
	if (typeof tmpl.type !== "string" || tmpl.type.trim().length === 0) return false;
	if (typeof tmpl.durationMinutes !== "number" || tmpl.durationMinutes <= 0) return false;

	if (tmpl.description !== undefined && typeof tmpl.description !== "string") return false;
	if (tmpl.focusFile !== undefined && typeof tmpl.focusFile !== "string") return false;
	if (tmpl.goals !== undefined && !Array.isArray(tmpl.goals)) return false;
	if (tmpl.decisions !== undefined && !Array.isArray(tmpl.decisions)) return false;
	if (tmpl.tasks !== undefined && !Array.isArray(tmpl.tasks)) return false;
	if (tmpl.contextBindings !== undefined && !Array.isArray(tmpl.contextBindings)) return false;
	if (tmpl.notes !== undefined && typeof tmpl.notes !== "string") return false;

	return true;
}
