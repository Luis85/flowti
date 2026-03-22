/**
 * Agent domain types for the sidepanel view.
 * Pure types — no I/O, no dependencies.
 */

export type ConversationMode = "document" | "conversational" | "canvas";

export interface AgentCard {
	readonly name: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly intStat?: number;
	readonly chaStat?: number;
	/** LLM provider from companion JSON (`ai.provider`), e.g. cursor / anthropic. */
	readonly provider?: string;
	readonly activity: "idle" | "thinking" | "speaking" | "using-tool";
	readonly suggestedTasks?: readonly { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }[];
}

export interface ToolCall {
	readonly id: string;
	readonly name: string;
	readonly status: "started" | "completed";
}

export interface ConversationTurn {
	readonly id: string;
	readonly role: "user" | "agent";
	readonly agentName?: string;
	readonly persona?: string;
	readonly content: string;
	readonly thinking?: string;
	readonly toolCalls?: ToolCall[];
	readonly timestamp: string;
	readonly mode: ConversationMode;
}

export type AgentServiceEvent =
	| { readonly kind: "status-changed"; readonly agent: string; readonly activity: AgentCard["activity"] }
	| { readonly kind: "message-received"; readonly agent: string; readonly turn: ConversationTurn }
	| { readonly kind: "thinking"; readonly agent: string; readonly text: string }
	| { readonly kind: "tool-started"; readonly agent: string; readonly tool: string; readonly id: string }
	| { readonly kind: "tool-completed"; readonly agent: string; readonly id: string }
	| { readonly kind: "error"; readonly agent: string; readonly error: string };

export interface IAgentService {
	listAgents(): AgentCard[];
	getAgent(name: string): AgentCard | undefined;
	sendMessage(agent: string, message: string, mode: ConversationMode, signal?: AbortSignal): Promise<void>;
	stopGeneration(agent: string): Promise<void>;
	getConversation(agent: string): ConversationTurn[];
	getTeamConversation(): ConversationTurn[];
	onEvent(callback: (event: AgentServiceEvent) => void): () => void;
	connect(): Promise<void>;
	disconnect(): void;
}
