import type { Result } from '../shared/result.js';
import type { Unsubscribe } from '../shared/unsubscribe.js';
import type { AppError } from '../shared/app-error.js';
import type {
	AgentDescriptor,
	AgentId,
	AgentMessage,
	AgentSession,
	AgentStatus,
	SessionId,
	Task,
	TaskId,
} from './agent-types.js';

/**
 * Abstraction over the agent runtime.  Modules interact with agents
 * exclusively through this port so the underlying runtime (local LLM,
 * remote API, mock) can change without rewriting callers.
 *
 * Status: STUB.  Concrete implementations will land in follow-up work;
 * this file locks the contract now so feature modules can code against it.
 */
export interface AgentPort {
	/** Enumerate every agent the runtime knows about. */
	list(): Promise<Result<readonly AgentDescriptor[], AppError>>;

	/** Current runtime status of a single agent. */
	getStatus(agentId: AgentId): Promise<Result<AgentStatus, AppError>>;

	/** Start a new session with an agent.  Returns the session id. */
	openSession(agentId: AgentId): Promise<Result<SessionId, AppError>>;

	/** Fetch an existing session record (messages, tasks). */
	getSession(sessionId: SessionId): Promise<Result<AgentSession, AppError>>;

	/** End a session; subsequent sendMessage calls will err. */
	closeSession(sessionId: SessionId): Promise<Result<void, AppError>>;

	/** Send a message to an agent within a session.  Resolves with the agent's response. */
	sendMessage(sessionId: SessionId, content: string): Promise<Result<AgentMessage, AppError>>;

	/** Subscribe to status changes for an agent (status + session + task lifecycle). */
	subscribeStatus(agentId: AgentId, listener: (status: AgentStatus) => void): Unsubscribe;
}

/**
 * Task queue abstraction.  Agents receive work through Tasks; the queue
 * owns scheduling, retry, cancellation, and lifecycle events.
 *
 * Status: STUB.
 */
export interface TaskPort {
	/** Enqueue a new task.  Returns the task id (ready, not yet run). */
	enqueue(input: { agentId: AgentId; sessionId: SessionId; prompt: string }): Promise<Result<TaskId, AppError>>;

	/** Fetch a task record. */
	getTask(taskId: TaskId): Promise<Result<Task, AppError>>;

	/** Cancel a pending or running task. */
	cancel(taskId: TaskId): Promise<Result<void, AppError>>;

	/** Subscribe to task updates (status transitions, result, error). */
	subscribe(taskId: TaskId, listener: (task: Task) => void): Unsubscribe;

	/** List tasks for a session (ordered by createdAt). */
	listBySession(sessionId: SessionId): Promise<Result<readonly Task[], AppError>>;
}
