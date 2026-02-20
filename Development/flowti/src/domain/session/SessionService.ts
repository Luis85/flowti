/**
 * Session domain service.
 *
 * Manages time-boxed documentation sessions with Pomodoro-style timer,
 * artifact tracking, and lifecycle state management. The timer lives
 * in the domain layer (not UI) so it survives window minimize and
 * modal close. On load(), resumes an active session if one exists.
 *
 * Handler logic is extracted to `handlers/` modules (TD-101).
 * This file retains the constructor, public API, event wiring,
 * timer management, and the handler context.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import { generateUUID } from "../../utils/helpers";
import type { ClosureResponse, EnergyLevel, ExecutionTask, Session, SessionState, SessionStatusV2, SessionTemplate, SessionTemplateExport, SessionTypeConfig } from "./types";
import { MAX_TEMPLATES } from "./types";
import { createContextBinding, computeRemainingMs, computeElapsedMs, isTimerExpired, isValidTransition } from "./helpers";
import type { SessionHandlerContext } from "./handlers/types";
import { lifecycleHandlers, fieldHandlers, taskHandlers, closureHandlers, syncHandlers, trackingHandlers } from "./handlers";

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

	/** Handler context — delegates back to service fields and methods. */
	private ctx: SessionHandlerContext;

	constructor(options: SessionServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;

		// Build handler context — arrow functions capture `this` lexically.
		// Uses a wrapper class to satisfy no-this-alias via property accessors.
		this.ctx = new HandlerContextProxy(this as unknown as SessionServiceInternals);

		if (this.eventBus) {
			this.wireEventSubscriptions();
		}
	}

	// ── Event wiring ─────────────────────────────────────────

	private wireEventSubscriptions(): void {
		const bus = this.eventBus!;
		const sub = (unsub: () => void) => this.unsubscribes.push(unsub);

		// Lifecycle
		sub(bus.on("session.create", (e) => { void lifecycleHandlers.handleCreate(this.ctx, e.payload); }));
		sub(bus.on("session.start", (e) => { void lifecycleHandlers.handleStart(this.ctx, e.payload.sessionId); }));
		sub(bus.on("session.pause", (e) => { void lifecycleHandlers.handlePause(this.ctx, e.payload.sessionId); }));
		sub(bus.on("session.resume", (e) => { void lifecycleHandlers.handleResume(this.ctx, e.payload.sessionId); }));
		sub(bus.on("session.complete", (e) => { void lifecycleHandlers.handleComplete(this.ctx, e.payload.sessionId); }));
		sub(bus.on("session.archive", (e) => { void lifecycleHandlers.handleArchive(this.ctx, e.payload.sessionId); }));
		sub(bus.on("session.delete", (e) => { void lifecycleHandlers.handleDelete(this.ctx, e.payload.sessionId); }));
		sub(bus.on("session.refresh", () => { void this.emitLoaded(); }));

		// Artifact tracking
		sub(bus.on("file.created", (e) => { void trackingHandlers.onFileEvent(this.ctx, e.payload.path, "created"); }));
		sub(bus.on("file.modified", (e) => { void trackingHandlers.onFileEvent(this.ctx, e.payload.path, "modified"); }));

		// Activity tracking (ADR-025)
		sub(bus.on("file.created", (e) => { void trackingHandlers.onActivityEvent(this.ctx, e.payload.path, "created"); }));
		sub(bus.on("file.modified", (e) => { void trackingHandlers.onActivityEvent(this.ctx, e.payload.path, "modified"); }));
		sub(bus.on("file.deleted", (e) => { void trackingHandlers.onActivityEvent(this.ctx, e.payload.path, "deleted"); }));
		sub(bus.on("file.renamed", (e) => { void trackingHandlers.onActivityEvent(this.ctx, e.payload.newPath, "renamed", e.payload.oldPath); }));

		// Path reconciliation
		sub(bus.on("file.renamed", (e) => { void trackingHandlers.handleFileRenamed(this.ctx, e.payload.oldPath, e.payload.newPath); }));
		sub(bus.on("folder.renamed", (e) => { void trackingHandlers.handleFolderRenamed(this.ctx, e.payload.oldPath, e.payload.newPath); }));

		// Reverse sync
		sub(bus.on("file.modified", (e) => {
			const session = syncHandlers.findSessionByNotesFile(this.ctx, e.payload.path);
			if (session) {
				syncHandlers.scheduleReverseSync(this.ctx, session.id, e.payload.path);
			}
		}));

		// Goal commands
		sub(bus.on("session.goal.add", (e) => { void taskHandlers.handleGoalAdd(this.ctx, e.payload.sessionId, e.payload.text); }));
		sub(bus.on("session.goal.toggle", (e) => { void taskHandlers.handleGoalToggle(this.ctx, e.payload.sessionId, e.payload.goalId); }));
		sub(bus.on("session.goal.remove", (e) => { void taskHandlers.handleGoalRemove(this.ctx, e.payload.sessionId, e.payload.goalId); }));
		sub(bus.on("session.goal.reorder", (e) => { void taskHandlers.handleGoalReorder(this.ctx, e.payload.sessionId, e.payload.goalIds); }));

		// Duration & notes
		sub(bus.on("session.duration.update", (e) => { void fieldHandlers.handleDurationUpdate(this.ctx, e.payload.sessionId, e.payload.durationMinutes); }));
		sub(bus.on("session.notes.update", (e) => { void fieldHandlers.handleNotesUpdate(this.ctx, e.payload.sessionId, e.payload.notes); }));
		sub(bus.on("session.notesFile.set", (e) => { void fieldHandlers.handleNotesFileSet(this.ctx, e.payload.sessionId, e.payload.path); }));
		sub(bus.on("session.canvasFile.set", (e) => { void fieldHandlers.handleCanvasFileSet(this.ctx, e.payload.sessionId, e.payload.path); }));

		// Link commands
		sub(bus.on("session.link.add", (e) => { void fieldHandlers.handleLinkAdd(this.ctx, e.payload.sessionId, e.payload.path); }));
		sub(bus.on("session.link.remove", (e) => { void fieldHandlers.handleLinkRemove(this.ctx, e.payload.sessionId, e.payload.path); }));

		// Context binding commands
		sub(bus.on("session.context.bind", (e) => { void fieldHandlers.handleContextBind(this.ctx, e.payload.sessionId, e.payload.path, e.payload.type); }));
		sub(bus.on("session.context.unbind", (e) => { void fieldHandlers.handleContextUnbind(this.ctx, e.payload.sessionId, e.payload.bindingId); }));
		sub(bus.on("session.context.changeType", (e) => { void fieldHandlers.handleContextChangeType(this.ctx, e.payload.sessionId, e.payload.bindingId, e.payload.type); }));

		// Decision commands
		sub(bus.on("session.decision.record", (e) => { void fieldHandlers.handleDecisionRecord(this.ctx, e.payload.sessionId, e.payload.title, e.payload.description, e.payload.context); }));
		sub(bus.on("session.decision.remove", (e) => { void fieldHandlers.handleDecisionRemove(this.ctx, e.payload.sessionId, e.payload.decisionId); }));

		// Reflection commands
		sub(bus.on("session.reflection.add", (e) => { void fieldHandlers.handleReflectionAdd(this.ctx, e.payload.sessionId, e.payload.type, e.payload.content); }));
		sub(bus.on("session.reflection.remove", (e) => { void fieldHandlers.handleReflectionRemove(this.ctx, e.payload.sessionId, e.payload.entryId); }));

		// Workspace state
		sub(bus.on("session.state.saved", (e) => { void fieldHandlers.handleStateSaved(this.ctx, e.payload.sessionId, e.payload.state); }));

		// Output artifacts
		sub(bus.on("session.output.generate", (e) => { void fieldHandlers.handleOutputGenerate(this.ctx, e.payload.sessionId, e.payload.template); }));

		// Type configuration
		sub(bus.on("session.type.create", (e) => { void fieldHandlers.handleTypeCreate(this.ctx, e.payload.config); }));
		sub(bus.on("session.type.configure", (e) => { void fieldHandlers.handleTypeConfigure(this.ctx, e.payload.type, e.payload.config); }));

		// v2: Intent & Energy (ADR-031)
		sub(bus.on("session.intent.set", (e) => { void fieldHandlers.handleSetIntent(this.ctx, e.payload.sessionId, e.payload.intent); }));
		sub(bus.on("session.energy.set", (e) => { void fieldHandlers.handleEnergyChange(this.ctx, e.payload.sessionId, e.payload.level); }));

		// v2: Execution task commands (ADR-031, FR-12)
		sub(bus.on("session.task.add", (e) => { void taskHandlers.addTask(this.ctx, e.payload.sessionId, e.payload.label); }));
		sub(bus.on("session.task.toggle", (e) => { void taskHandlers.toggleTask(this.ctx, e.payload.sessionId, e.payload.taskId); }));
		sub(bus.on("session.task.remove", (e) => { void taskHandlers.removeTask(this.ctx, e.payload.sessionId, e.payload.taskId); }));
		sub(bus.on("session.task.reorder", (e) => { void taskHandlers.reorderTasks(this.ctx, e.payload.sessionId, e.payload.taskIds); }));
	}

	// ── Public API ───────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
			if (!this.state.savedTemplates) {
				this.state.savedTemplates = [];
			}
			let migrated = false;
			for (const s of this.state.sessions) {
				if (!s.timeline) s.timeline = [];
				if (!s.goals) s.goals = [];
				if (!s.links) s.links = [];
				if (s.notesFile === undefined) s.notesFile = null;
				if (s.canvasFile === undefined) s.canvasFile = null;
				if (!s.activity) s.activity = [];
				if (!s.activityFilter) s.activityFilter = [];
				if (!s.contextBindings) s.contextBindings = [];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				if (!s.type) (s as any).type = "documentation";
				if (!s.decisions) s.decisions = [];
				if (s.workspaceState === undefined) s.workspaceState = null;
				if (!s.outputArtifacts) s.outputArtifacts = [];
				// v2 backward compat (ADR-031)
				if (s.status === "active") s.status = "running";
				if (s.intent === undefined) s.intent = null;
				if (s.energy === undefined) s.energy = null;
				if (!s.executionTasks) s.executionTasks = [];
				if (!s.reflections) s.reflections = [];
				if (s.closureResponse === undefined) s.closureResponse = null;
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

		if (this.state.activeSessionId) {
			const session = this.findSession(this.state.activeSessionId);
			if (session && session.status === "running") {
				if (isTimerExpired(session)) {
					await lifecycleHandlers.completeSession(this.ctx, session);
				} else {
					this.startTimer(session);
				}
			}
		}

		await this.emitLoaded();
	}

	getSessions(): Session[] {
		return [...this.state.sessions];
	}

	getActiveSession(): Session | null {
		if (!this.state.activeSessionId) return null;
		return this.findSession(this.state.activeSessionId) ?? null;
	}

	getSessionById(id: string): Session | null {
		return this.findSession(id) ?? null;
	}

	workspaceSessionId: string | null = null;

	getCurrentSession(): Session | null {
		return (this.workspaceSessionId ? this.getSessionById(this.workspaceSessionId) : null)
			?? this.getActiveSession();
	}

	// ── Template CRUD ───────────────────────────────────────

	getSavedTemplates(): SessionTemplate[] {
		return [...(this.state.savedTemplates ?? [])];
	}

	getTemplate(id: string): SessionTemplate | undefined {
		return this.state.savedTemplates?.find((t) => t.id === id);
	}

	async saveTemplate(template: Omit<SessionTemplate, "id" | "createdAt">): Promise<SessionTemplate> {
		const saved: SessionTemplate = {
			...template,
			id: `tmpl_${generateUUID()}`,
			createdAt: Date.now(),
		};

		if (!this.state.savedTemplates) this.state.savedTemplates = [];
		this.state.savedTemplates.push(saved);

		if (this.state.savedTemplates.length > MAX_TEMPLATES) {
			this.state.savedTemplates = this.state.savedTemplates
				.sort((a, b) => b.createdAt - a.createdAt)
				.slice(0, MAX_TEMPLATES);
		}

		await this.saveState();
		return { ...saved };
	}

	async updateTemplate(id: string, updates: Partial<Pick<SessionTemplate, "name" | "type" | "durationMinutes" | "description">>): Promise<void> {
		const tmpl = this.state.savedTemplates?.find((t) => t.id === id);
		if (!tmpl) return;
		Object.assign(tmpl, updates);
		await this.saveState();
	}

	async deleteTemplate(id: string): Promise<void> {
		if (!this.state.savedTemplates) return;
		const index = this.state.savedTemplates.findIndex((t) => t.id === id);
		if (index === -1) return;
		this.state.savedTemplates.splice(index, 1);
		await this.saveState();
	}

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
			reflections: session.reflections.length > 0
				? session.reflections.map((r) => ({ type: r.type, content: r.content }))
				: undefined,
		});
	}

	// ── Template Import/Export ──────────────────────────────

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
				...(tmpl.reflections !== undefined && { reflections: tmpl.reflections }),
			},
		};

		void this.eventBus?.emit("session.template.exported", { template: tmpl });
		return exportData;
	}

	async importTemplate(data: unknown): Promise<SessionTemplate | null> {
		if (!isValidTemplateExport(data)) return null;

		const existing = this.getSavedTemplates();
		if (existing.some((t) => t.name === data.template.name)) return null;

		const saved = await this.saveTemplate(data.template);
		void this.eventBus?.emit("session.template.imported", { template: saved });
		return saved;
	}

	// ── Rerun & Create from Template ────────────────────────

	async rerunSession(sessionId: string): Promise<Session | null> {
		const session = this.findSession(sessionId);
		if (!session || (session.status !== "completed" && session.status !== "archived")) return null;

		return lifecycleHandlers.handleCreate(this.ctx, {
			type: session.type,
			title: generateRerunTitle(session.title),
			durationMinutes: session.durationMinutes,
			focusFile: session.focusFile ?? undefined,
			goals: session.goals.map((g) => g.text),
			decisions: session.decisions.map((d) => d.title),
			tasks: session.executionTasks.map((t) => t.label),
			contextBindings: session.contextBindings.map((b) => ({ path: b.path, type: b.type })),
			notes: session.notes.trim() || undefined,
			reflections: session.reflections.length > 0
				? session.reflections.map((r) => ({ type: r.type, content: r.content }))
				: undefined,
		});
	}

	async createFromTemplate(templateId: string, titleOverride?: string): Promise<void> {
		const tmpl = this.getTemplate(templateId);
		if (!tmpl) return;

		await lifecycleHandlers.handleCreate(this.ctx, {
			type: tmpl.type,
			title: titleOverride ?? tmpl.name,
			durationMinutes: tmpl.durationMinutes,
			focusFile: tmpl.focusFile,
			goals: tmpl.goals,
			decisions: tmpl.decisions,
			tasks: tmpl.tasks,
			contextBindings: tmpl.contextBindings,
			notes: tmpl.notes,
			reflections: tmpl.reflections,
		});
	}

	// ── Public task API (exposed for direct calls) ──────────

	async addTask(sessionId: string, label: string): Promise<ExecutionTask | null> {
		return taskHandlers.addTask(this.ctx, sessionId, label);
	}

	async toggleTask(sessionId: string, taskId: string): Promise<void> {
		return taskHandlers.toggleTask(this.ctx, sessionId, taskId);
	}

	async removeTask(sessionId: string, taskId: string): Promise<void> {
		return taskHandlers.removeTask(this.ctx, sessionId, taskId);
	}

	async reorderTasks(sessionId: string, taskIds: string[]): Promise<void> {
		return taskHandlers.reorderTasks(this.ctx, sessionId, taskIds);
	}

	// ── Public closure API ──────────────────────────────────

	async handleEnergyChange(sessionId: string, level: EnergyLevel): Promise<void> {
		return fieldHandlers.handleEnergyChange(this.ctx, sessionId, level);
	}

	async handleStateTransition(sessionId: string, targetState: SessionStatusV2): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;
		const currentStatus = session.status as SessionStatusV2;
		if (!isValidTransition(currentStatus, targetState)) return;

		switch (targetState) {
			case "running":
				if (currentStatus === "prepared") await lifecycleHandlers.handleStart(this.ctx, sessionId);
				else if (currentStatus === "paused") await lifecycleHandlers.handleResume(this.ctx, sessionId);
				break;
			case "paused":
				await lifecycleHandlers.handlePause(this.ctx, sessionId);
				break;
			case "reviewing":
				await lifecycleHandlers.handleComplete(this.ctx, sessionId);
				break;
			case "completed":
				if (session.status === "reviewing") await closureHandlers.finishReview(this.ctx, session);
				break;
			case "archived":
				await lifecycleHandlers.handleArchive(this.ctx, sessionId);
				break;
		}
	}

	async finishReview(session: Session): Promise<void> {
		return closureHandlers.finishReview(this.ctx, session);
	}

	async completeClosure(sessionId: string, response: ClosureResponse): Promise<void> {
		return closureHandlers.completeClosure(this.ctx, sessionId, response);
	}

	async skipClosure(sessionId: string): Promise<void> {
		return closureHandlers.skipClosure(this.ctx, sessionId);
	}

	// ── Public activity filter API ──────────────────────────

	async updateActivityFilter(sessionId: string, filter: string[]): Promise<void> {
		return trackingHandlers.updateActivityFilter(this.ctx, sessionId, filter);
	}

	// ── Dispose ─────────────────────────────────────────────

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

	// ── Timer ────────────────────────────────────────────────

	private startTimer(session: Session): void {
		this.stopTimer();
		if (session.durationMinutes <= 0) return;
		this.timerInterval = setInterval(() => {
			const now = Date.now();
			const remaining = computeRemainingMs(session, now);
			const elapsed = computeElapsedMs(session, now);

			if (remaining <= 0) {
				this.stopTimer();
				void lifecycleHandlers.completeSession(this.ctx, session);
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

	// ── Private helpers ─────────────────────────────────────

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
 * Internal interface for the fields/methods that the handler context
 * needs from SessionService. Keeps the proxy decoupled from the class.
 */
interface SessionServiceInternals {
	eventBus: IEventBus | undefined;
	fileSystem: IFileSystemClient | undefined;
	globalActivityFilter: string[];
	customSessionTypes: Record<string, SessionTypeConfig>;
	noteSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
	lastSyncedContent: Map<string, string>;
	reverseSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
	lastOverloadReasons: Map<string, string>;
	ctx: SessionHandlerContext;
	findSession(id: string): Session | undefined;
	state: SessionState;
	saveState(): Promise<void>;
	startTimer(session: Session): void;
	stopTimer(): void;
}

/**
 * Proxy that implements SessionHandlerContext by delegating to SessionService.
 * Uses constructor injection to avoid `no-this-alias` violations.
 */
class HandlerContextProxy implements SessionHandlerContext {
	private svc: SessionServiceInternals;

	constructor(svc: SessionServiceInternals) {
		this.svc = svc;
	}

	get eventBus() { return this.svc.eventBus; }
	get fileSystem() { return this.svc.fileSystem; }
	get globalActivityFilter() { return this.svc.globalActivityFilter; }
	set globalActivityFilter(v: string[]) { this.svc.globalActivityFilter = v; }
	get customSessionTypes() { return this.svc.customSessionTypes; }
	set customSessionTypes(v: Record<string, SessionTypeConfig>) { this.svc.customSessionTypes = v; }
	get noteSyncTimers() { return this.svc.noteSyncTimers; }
	get lastSyncedContent() { return this.svc.lastSyncedContent; }
	get reverseSyncTimers() { return this.svc.reverseSyncTimers; }
	get lastOverloadReasons() { return this.svc.lastOverloadReasons; }

	findSession = (id: string) => this.svc.findSession(id);
	getState = () => this.svc.state;
	saveState = () => this.svc.saveState();
	scheduleSyncNotesFile = (id: string) => syncHandlers.scheduleSyncNotesFile(this.svc.ctx, id);
	checkCognitiveOverload = (id: string) => trackingHandlers.checkCognitiveOverload(this.svc.ctx, id);
	startTimer = (s: Session) => this.svc.startTimer(s);
	stopTimer = () => this.svc.stopTimer();
}

/**
 * Generates a rerun title by appending or incrementing a `(N)` suffix.
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
