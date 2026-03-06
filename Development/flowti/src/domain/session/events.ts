/**
 * Event types owned by the Session domain.
 */

import type { ClosureResponse, ContextBindingType, EnergyLevel, ExecutionTask, ReflectionEntry, Session, SessionActivity, SessionArtifact, SessionContextBinding, SessionDecision, SessionGoal, SessionIntent, SessionLink, SessionMode, SessionOutputArtifact, SessionOutputTemplate, SessionTemplate, SessionType, SessionTypeConfig, WorkspaceState } from "./types";

export interface SessionEventMap {
	// ── Commands ──────────────────────────────────────────────
	/** Command: create a new session */
	"session.create": { type: SessionType; title: string; durationMinutes: number; focusFile?: string; goals?: string[]; tasks?: string[]; decisions?: string[]; contextBindings?: Array<{ path: string; type: ContextBindingType }>; notes?: string; reflections?: Array<{ type: ReflectionEntry["type"]; content: string }> };
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

	// ── Path reconciliation events ───────────────────────────
	/** Emitted after file/folder paths are updated across sessions due to a rename/move */
	"session.paths.updated": { sessionIds: string[] };

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
	/** Command: reorder goals by new ID sequence */
	"session.goal.reorder": { sessionId: string; goalIds: string[] };

	// ── Goal state events ────────────────────────────────────
	/** Emitted after a goal is added to a session */
	"session.goal.added": { sessionId: string; goal: SessionGoal };
	/** Emitted after a goal's completed state is toggled */
	"session.goal.toggled": { sessionId: string; goalId: string; completed: boolean };
	/** Emitted after a goal is removed from a session */
	"session.goal.removed": { sessionId: string; goalId: string };
	/** Emitted after goals are reordered */
	"session.goal.reordered": { sessionId: string; goalIds: string[] };

	// ── Duration events ──────────────────────────────────────
	/** Command: update a prepared session's duration */
	"session.duration.update": { sessionId: string; durationMinutes: number };
	/** Emitted after a session's duration is updated */
	"session.duration.updated": { sessionId: string; durationMinutes: number };

	// ── Notes events ─────────────────────────────────────────
	/** Command: update a session's notes */
	"session.notes.update": { sessionId: string; notes: string };
	/** Emitted after a session's notes are updated */
	"session.notes.updated": { sessionId: string; notes: string };

	// ── Notes file events ───────────────────────────────────
	/** Command: set the session's dedicated notes file path */
	"session.notesFile.set": { sessionId: string; path: string };
	/** Emitted after a session's notes file path is set */
	"session.notesFile.updated": { sessionId: string; path: string };

	// ── Canvas file events ─────────────────────────────────
	/** Command: set the session's canvas file path */
	"session.canvasFile.set": { sessionId: string; path: string };
	/** Emitted after a session's canvas file path is set */
	"session.canvasFile.updated": { sessionId: string; path: string };

	// ── Notes sync events ───────────────────────────────────
	/** Emitted after session notes file is synced to disk */
	"session.notes.synced": { sessionId: string; path: string };
	/** Emitted when session notes file sync fails */
	"session.notes.syncFailed": { sessionId: string; path: string; error: string };
	/** Emitted after reverse sync from notes file to session */
	"session.notes.reverseSynced": { sessionId: string; path: string; changes: string[] };

	// ── Activity events ─────────────────────────────────────
	/** Emitted when a vault file event is tracked in the session activity log */
	"session.activity.tracked": { sessionId: string; activity: SessionActivity };
	/** Emitted when the per-session activity folder filter is updated */
	"session.activity.filter.updated": { sessionId: string; filter: string[] };

	// ── Link commands ────────────────────────────────────────
	/** Command: add a link to a session */
	"session.link.add": { sessionId: string; path: string };
	/** Command: remove a link from a session */
	"session.link.remove": { sessionId: string; path: string };

	// ── Link state events ───────────────────────────────────
	/** Emitted after a link is added to a session */
	"session.link.added": { sessionId: string; link: SessionLink };
	/** Emitted after a link is removed from a session */
	"session.link.removed": { sessionId: string; path: string };

	// ── Context binding commands ────────────────────────────
	/** Command: bind a context to a session */
	"session.context.bind": { sessionId: string; path: string; type: ContextBindingType };
	/** Command: unbind a context from a session */
	"session.context.unbind": { sessionId: string; bindingId: string };
	/** Command: change the type of an existing context binding */
	"session.context.changeType": { sessionId: string; bindingId: string; type: ContextBindingType };

	// ── Context binding state events ────────────────────────
	/** Emitted after a context binding is added to a session */
	"session.context.bound": { sessionId: string; binding: SessionContextBinding };
	/** Emitted after a context binding is removed from a session */
	"session.context.unbound": { sessionId: string; bindingId: string };
	/** Emitted after a context binding's type is changed */
	"session.context.typeChanged": { sessionId: string; bindingId: string; type: ContextBindingType };

	// ── Decision commands ────────────────────────────────────
	/** Command: record a decision during a session */
	"session.decision.record": { sessionId: string; title: string; description?: string; context?: string };
	/** Command: remove a decision from a session */
	"session.decision.remove": { sessionId: string; decisionId: string };

	// ── Decision state events ────────────────────────────────
	/** Emitted after a decision is recorded */
	"session.decision.recorded": { sessionId: string; decision: SessionDecision };
	/** Emitted after a decision is removed */
	"session.decision.removed": { sessionId: string; decisionId: string };

	// ── Workspace state events ─────────────────────────────
	/** Command: request workspace state capture (emitted by service, handled by view) */
	"session.state.save": { sessionId: string };
	/** Emitted after workspace state is captured by the view */
	"session.state.saved": { sessionId: string; state: WorkspaceState };
	/** Command: request workspace state restoration (emitted by service, handled by view) */
	"session.state.restore": { sessionId: string; state: WorkspaceState };
	/** Emitted after workspace state is restored by the view */
	"session.state.restored": { sessionId: string };

	// ── Output artifact events ─────────────────────────────
	/** Command: generate an output artifact from a completed session */
	"session.output.generate": { sessionId: string; template: SessionOutputTemplate };
	/** Emitted after an output artifact is generated and persisted */
	"session.output.generated": { sessionId: string; artifact: SessionOutputArtifact };

	// ── Template import/export events ─────────────────────
	/** Emitted after a template is exported to JSON */
	"session.template.exported": { template: SessionTemplate };
	/** Emitted after a template is imported from JSON */
	"session.template.imported": { template: SessionTemplate };

	// ── Type configuration commands ────────────────────────
	/** Command: configure (update) a session type's config */
	"session.type.configure": { type: SessionType; config: Partial<SessionTypeConfig> };
	/** Command: create a custom session type */
	"session.type.create": { config: SessionTypeConfig };

	// ── Type configuration state events ────────────────────
	/** Emitted after a session type config is updated */
	"session.type.configured": { type: SessionType; config: SessionTypeConfig };
	/** Emitted after a custom session type is created */
	"session.type.created": { config: SessionTypeConfig };

	// ── v2: Intent events (ADR-031, FR-10) ─────────────────
	/** Command: set session intent (prepared/paused only) */
	"session.intent.set": { sessionId: string; intent: SessionIntent };
	/** Emitted after a session's intent is set or updated */
	"session.intent.updated": { sessionId: string; intent: SessionIntent; previous: SessionIntent | null };
	/** Emitted after a session's mode is set */
	"session.mode.set": { sessionId: string; mode: SessionMode };

	// ── v2: Energy events (ADR-031, FR-11) ─────────────────
	/** Command: set energy level for a session */
	"session.energy.set": { sessionId: string; level: EnergyLevel };
	/** Emitted after energy level is changed (running/paused only) */
	"session.energy.changed": { sessionId: string; before: EnergyLevel | null; after: EnergyLevel };

	// ── v2: Execution task commands (ADR-031, FR-12) ────────
	/** Command: add a task to the execution plan */
	"session.task.add": { sessionId: string; label: string };
	/** Command: toggle a task's completed state */
	"session.task.toggle": { sessionId: string; taskId: string };
	/** Command: remove a task from the execution plan */
	"session.task.remove": { sessionId: string; taskId: string };
	/** Command: reorder tasks by new ID sequence */
	"session.task.reorder": { sessionId: string; taskIds: string[] };

	// ── v2: Execution task state events (ADR-031, FR-12) ────
	/** Emitted after a task is added to the execution plan */
	"session.task.added": { sessionId: string; task: ExecutionTask };
	/** Emitted after a task's completed state is toggled */
	"session.task.completed": { sessionId: string; taskId: string };
	/** Emitted after a task is removed from the execution plan */
	"session.task.removed": { sessionId: string; taskId: string };
	/** Emitted after tasks are reordered */
	"session.task.reordered": { sessionId: string; taskIds: string[] };

	// ── v2: Reflection commands (ADR-031, FR-13) ────────────
	/** Command: add a reflection entry to a session */
	"session.reflection.add": { sessionId: string; type: ReflectionEntry["type"]; content: string };
	/** Command: remove a reflection entry from a session */
	"session.reflection.remove": { sessionId: string; entryId: string };

	// ── v2: Reflection state events (ADR-031, FR-13) ─────────
	/** Emitted after a reflection entry is added */
	"session.reflection.added": { sessionId: string; entry: ReflectionEntry };
	/** Emitted after a reflection entry is removed */
	"session.reflection.removed": { sessionId: string; entryId: string };

	// ── v2: Cap reached events ───────────────────────────────
	/** Emitted when reflection cap is reached (MAX_REFLECTIONS) */
	"session.reflection.capReached": { sessionId: string; limit: number };
	/** Emitted when execution task cap is reached (MAX_EXECUTION_TASKS) */
	"session.task.capReached": { sessionId: string; limit: number };

	// ── v2: Lifecycle & closure events (ADR-031, FR-09/14) ──
	/** Emitted when session enters reviewing state */
	"session.review.started": { sessionId: string };
	/** Emitted when closure ritual begins (reviewing state) */
	"session.closure.started": { sessionId: string };
	/** Emitted after closure ritual is completed */
	"session.closure.completed": { sessionId: string; response: ClosureResponse };

	// ── v2: Cognitive overload (ADR-031, FR-16) ─────────────
	/** Emitted when cognitive overload thresholds are exceeded */
	"session.overload.detected": { sessionId: string; reasons: string[] };

	// ── Documentation ────────────────────────────────────────
	/** Emitted after a session completion summary document is generated */
	"session.documentation.generated": { sessionId: string; path: string };
}
