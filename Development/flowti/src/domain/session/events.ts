/**
 * Event types owned by the Session domain.
 */

import type { Session, SessionArtifact, SessionGoal, SessionTemplate, SessionType } from "./types";

export interface SessionEventMap {
	// ── Commands ──────────────────────────────────────────────
	/** Command: create a new session */
	"session.create": { type: SessionType; title: string; durationMinutes: number; focusFile?: string; goals?: string[] };
	/** Command: start the timer for a prepared session */
	"session.start": { sessionId: string };
	/** Command: pause an active session */
	"session.pause": { sessionId: string };
	/** Command: resume a paused session */
	"session.resume": { sessionId: string };
	/** Command: manually complete a session */
	"session.complete": { sessionId: string };
	/** Command: archive a completed session */
	"session.archive": { sessionId: string };
	/** Command: delete a session */
	"session.delete": { sessionId: string };
	/** Command: request re-emit of current session state */
	"session.refresh": Record<string, never>;

	// ── State events ─────────────────────────────────────────
	/** Emitted after a session is created */
	"session.created": { session: Session };
	/** Emitted after a session timer is started */
	"session.started": { session: Session };
	/** Emitted after a session is paused */
	"session.paused": { session: Session };
	/** Emitted after a session is resumed */
	"session.resumed": { session: Session };
	/** Emitted after a session is completed */
	"session.completed": { session: Session };
	/** Emitted after a session is archived */
	"session.archived": { session: Session };
	/** Emitted after a session is deleted */
	"session.deleted": { sessionId: string };
	/** Emitted after session state is loaded from storage */
	"session.loaded": { sessions: Session[]; activeSessionId: string | null; savedTemplates: SessionTemplate[] };

	// ── Timer events ─────────────────────────────────────────
	/** Emitted every second while a session timer is running */
	"session.timer.tick": { sessionId: string; remainingMs: number; elapsedMs: number };
	/** Emitted when the session timer reaches zero */
	"session.timer.completed": { sessionId: string };

	// ── Artifact events ──────────────────────────────────────
	/** Emitted when an artifact is recorded during an active session */
	"session.artifact.added": { sessionId: string; artifact: SessionArtifact };

	// ── Goal commands ────────────────────────────────────────
	/** Command: add a goal to a session */
	"session.goal.add": { sessionId: string; text: string };
	/** Command: toggle a goal's completed state */
	"session.goal.toggle": { sessionId: string; goalId: string };
	/** Command: remove a goal from a session */
	"session.goal.remove": { sessionId: string; goalId: string };

	// ── Goal state events ────────────────────────────────────
	/** Emitted after a goal is added to a session */
	"session.goal.added": { sessionId: string; goal: SessionGoal };
	/** Emitted after a goal's completed state is toggled */
	"session.goal.toggled": { sessionId: string; goalId: string; completed: boolean };
	/** Emitted after a goal is removed from a session */
	"session.goal.removed": { sessionId: string; goalId: string };

	// ── Notes events ─────────────────────────────────────────
	/** Command: update a session's notes */
	"session.notes.update": { sessionId: string; notes: string };
	/** Emitted after a session's notes are updated */
	"session.notes.updated": { sessionId: string; notes: string };
}
