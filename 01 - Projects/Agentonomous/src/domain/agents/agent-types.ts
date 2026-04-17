/**
 * Core agent types.  Platform-neutral data describing autonomous-agent
 * work — modules can code against these before any runtime implementation
 * lands, and swap implementations without touching callers.
 */

export type AgentId = string;
export type SessionId = string;
export type TaskId = string;

export type AgentStatus = 'idle' | 'busy' | 'errored' | 'offline';

export type AgentDescriptor = {
	readonly id: AgentId;
	readonly name: string;
	readonly description?: string;
	readonly capabilities: readonly string[];
};

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type Task = {
	readonly id: TaskId;
	readonly agentId: AgentId;
	readonly sessionId: SessionId;
	readonly prompt: string;
	readonly status: TaskStatus;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly result?: unknown;
	readonly error?: string;
};

export type AgentMessage = {
	readonly role: 'user' | 'agent' | 'system' | 'tool';
	readonly content: string;
	readonly timestamp: number;
};

export type AgentSession = {
	readonly id: SessionId;
	readonly agentId: AgentId;
	readonly startedAt: number;
	readonly endedAt?: number;
	readonly messages: readonly AgentMessage[];
	readonly tasks: readonly TaskId[];
};
