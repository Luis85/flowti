/**
 * llm-types.ts — Unified LLM provider types.
 *
 * Domain-layer contracts for multi-provider LLM support.
 * No I/O, no side effects — pure type definitions and DI interfaces.
 */

import type { AgentAttributes } from "./agent-types.js";

// ── Capabilities ────────────────────────────────────────────────────

/** What a provider+model combination can do. */
export interface ProviderCapabilities {
	readonly streaming: boolean;
	readonly thinking: boolean;
	readonly toolUse: boolean;
	readonly structuredOutput: boolean;
	readonly maxContextTokens?: number;
	/** Whether the provider supports long-running interactive sessions. */
	readonly persistentSession: boolean;
}

// ── Prompt ──────────────────────────────────────────────────────────

/** Agent identity for prompt building. */
export interface AgentIdentity {
	readonly name: string;
	readonly description?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly experience?: number;
}

/** Task context for clarification flows. Domain-layer type. */
export interface LLMTaskContext {
	readonly taskName: string;
	readonly taskDescription: string;
	readonly context?: string;
}

/** Conversation turn for history. */
export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly content: string;
}

export type ResponseFormatHint = "json" | "text" | "auto";

/** Universal prompt structure — decoupled from provider formatting. */
export interface PromptEnvelope {
	readonly system?: string;
	readonly identity?: AgentIdentity;
	readonly history?: readonly ConversationTurn[];
	readonly message: string;
	readonly responseFormat?: ResponseFormatHint;
	readonly taskContext?: LLMTaskContext;
}

// ── Request / Response ──────────────────────────────────────────────

/** What goes to a provider. */
export interface LLMRequest {
	readonly prompt: PromptEnvelope;
	readonly tools?: readonly string[];
	readonly timeout?: number;
	readonly cwd?: string;
}

/** Universal stream event. */
export type LLMEvent =
	| { readonly kind: "thinking"; readonly text: string }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "tool-start"; readonly id: string; readonly name: string }
	| { readonly kind: "tool-input"; readonly index: number; readonly json: string }
	| { readonly kind: "tool-end"; readonly id: string }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "usage"; readonly inputTokens: number; readonly outputTokens: number }
	| { readonly kind: "done" };

/** Accumulated output from an LLM invocation. */
export interface LLMResult {
	readonly text: string;
	readonly thinking: string;
	readonly exitCode: number;
}

/** Handle to a running LLM invocation. */
export interface LLMProcess {
	onEvent(callback: (event: LLMEvent) => void): () => void;
	readonly result: Promise<LLMResult>;
	kill(): void;
}

/** A persistent LLM session that can handle multiple messages. */
export interface LLMSession {
	/** Send a message and get a process handle for this specific response. */
	send(message: string): LLMProcess;
	/** Terminate the underlying process or connection. */
	kill(): void;
	/** Whether the session is still accepting messages. */
	readonly alive: boolean;
}

/** Request to create a persistent session. */
export interface LLMSessionRequest {
	readonly tools?: readonly string[];
	readonly timeout?: number;
	readonly cwd?: string;
}

// ── Provider interface ──────────────────────────────────────────────

/** Contract every LLM adapter implements. DI boundary — like IFileSystem. */
export interface ILLMProvider {
	readonly name: string;
	capabilities(model?: string): ProviderCapabilities;
	execute(request: LLMRequest): LLMProcess;
	/** Create a persistent session. Only when capabilities().persistentSession is true. */
	createSession?(request: LLMSessionRequest): LLMSession;
}

// ── Registry ────────────────────────────────────────────────────────

export type TaskType = "autonomous" | "conversation" | "utility";
export type SelectionReason = "configured" | "routed" | "fallback";

export interface ProviderSelection {
	readonly provider: ILLMProvider;
	readonly reason: SelectionReason;
}

export interface SelectOptions {
	readonly preferred?: string;
	readonly taskType: TaskType;
	readonly required?: Partial<ProviderCapabilities>;
}

/** Manages available providers and selects the right one. DI boundary. */
export interface IProviderRegistry {
	register(provider: ILLMProvider): void;
	get(name: string): ILLMProvider | undefined;
	list(): readonly ILLMProvider[];
	select(options: SelectOptions): ProviderSelection;
}
