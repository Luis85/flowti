/**
 * Shared context passed to all extracted handler functions.
 *
 * The SessionService creates a single context instance that delegates
 * back to its own fields and methods, keeping the handlers decoupled
 * from the service class itself.
 */

import type { IEventBus } from "../../../infrastructure/events/types";
import type { IFileSystemClient } from "../../../infrastructure/filesystem/types";
import type { Session, SessionState, SessionTypeConfig } from "../types";

export interface SessionHandlerContext {
	/** EventBus for emitting domain events. */
	readonly eventBus: IEventBus | undefined;

	/** FileSystem client for note sync operations. */
	readonly fileSystem: IFileSystemClient | undefined;

	/** Global activity filter folders (from SettingsService). */
	globalActivityFilter: string[];

	/** Custom session type configs (from SettingsService). */
	customSessionTypes: Record<string, SessionTypeConfig>;

	// ── Timers and caches (mutable, shared by reference) ──

	readonly noteSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
	readonly lastSyncedContent: Map<string, string>;
	readonly reverseSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
	readonly lastOverloadReasons: Map<string, string>;

	// ── Methods delegating back to SessionService ──

	/** Find a session by ID (returns mutable reference). */
	findSession(id: string): Session | undefined;

	/** Returns the mutable session state. */
	getState(): SessionState;

	/** Persist current state to storage. */
	saveState(): Promise<void>;

	/** Schedule debounced forward note sync. */
	scheduleSyncNotesFile(sessionId: string): void;

	/** Run cognitive overload detection. */
	checkCognitiveOverload(sessionId: string): void;

	/** Start the Pomodoro timer for a session. */
	startTimer(session: Session): void;

	/** Stop the currently running timer. */
	stopTimer(): void;
}
