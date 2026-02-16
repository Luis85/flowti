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
import type { Session, SessionState } from "./types";
import { MAX_SESSIONS, ARTIFACT_DEDUP_WINDOW_MS } from "./types";
import { createSession, computeRemainingMs, computeElapsedMs, isTimerExpired } from "./helpers";

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
	return { sessions: [], activeSessionId: null };
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

	private async handleCreate(payload: { type: string; title: string; durationMinutes: number }): Promise<void> {
		const id = `session_${generateUUID()}`;
		const session = createSession(
			id,
			payload.type as Session["type"],
			payload.title,
			payload.durationMinutes,
		);

		this.state.sessions.unshift(session);

		// Evict oldest if over capacity
		if (this.state.sessions.length > MAX_SESSIONS) {
			this.state.sessions = this.state.sessions.slice(0, MAX_SESSIONS);
		}

		await this.saveState();
		await this.eventBus?.emit("session.created", { session: { ...session } });
	}

	private async handleStart(sessionId: string): Promise<void> {
		const session = this.findSession(sessionId);
		if (!session || session.status !== "prepared") return;

		// Only one active session at a time
		if (this.state.activeSessionId) return;

		session.status = "active";
		session.startedAt = new Date().toISOString();
		this.state.activeSessionId = session.id;

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
		});
	}
}
