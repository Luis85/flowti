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
import type { ITypedStorage } from "../../utils/TypedStorage";
import { generateUUID } from "../../utils/helpers";
import type { Session, SessionGoal, SessionState, SessionTemplate } from "./types";
import { MAX_SESSIONS, MAX_TEMPLATES, ARTIFACT_DEDUP_WINDOW_MS } from "./types";
import { createSession, createGoal, computeRemainingMs, computeElapsedMs, isTimerExpired } from "./helpers";

/**
 * Configuration options for the SessionService.
 */
export interface SessionServiceOptions {
	storage: ITypedStorage<SessionState>;
	eventBus?: IEventBus;
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
	private unsubscribes: (() => void)[] = [];
	private timerInterval: ReturnType<typeof setInterval> | null = null;

	constructor(options: SessionServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

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

			// Notes command
			this.unsubscribes.push(
				this.eventBus.on("session.notes.update", (event) => {
					void this.handleNotesUpdate(event.payload.sessionId, event.payload.notes);
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
			for (const s of this.state.sessions) {
				if (!s.timeline) {
					s.timeline = [];
				}
				if (!s.goals) {
					s.goals = [];
				}
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
	 * Creates a template from a completed or archived session.
	 */
	async saveTemplateFromSession(sessionId: string, name: string): Promise<SessionTemplate | null> {
		const session = this.findSession(sessionId);
		if (!session || (session.status !== "completed" && session.status !== "archived")) return null;

		return this.saveTemplate({
			name,
			type: session.type,
			durationMinutes: session.durationMinutes,
			focusFile: session.focusFile ?? undefined,
			goals: session.goals.length > 0 ? session.goals.map((g) => g.text) : undefined,
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

	private async handleCreate(payload: { type: string; title: string; durationMinutes: number; focusFile?: string; goals?: string[] }): Promise<Session> {
		const id = `session_${generateUUID()}`;
		const session = createSession(
			id,
			payload.type as Session["type"],
			payload.title,
			payload.durationMinutes,
			payload.focusFile,
		);

		// Populate goals from text strings if provided
		if (payload.goals && payload.goals.length > 0) {
			session.goals = payload.goals.map((text) => createGoal(`goal_${generateUUID()}`, text));
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

	// ── Notes handler ───────────────────────────────────────

	private async handleNotesUpdate(sessionId: string, notes: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session) return;

		session.notes = notes;
		await this.saveState();
		await this.eventBus?.emit("session.notes.updated", { sessionId, notes });
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
