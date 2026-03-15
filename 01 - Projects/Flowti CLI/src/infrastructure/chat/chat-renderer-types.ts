/**
 * chat-renderer-types.ts — Types and interface for the agent chat view.
 *
 * Defines the IChatRenderer contract between ChatShell (UI layer) and
 * InkChatRenderer (infrastructure). No ink/react imports here.
 */

import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { MenuResult } from "../types.js";

// ── Status ──────────────────────────────────────────────────────────

/** Derived from WorkerState with "error" added for chat-specific display. */
export type ChatViewStatus = "idle" | "thinking" | "working" | "waiting" | "error";

// ── Config ──────────────────────────────────────────────────────────

/** Configuration passed to the renderer on mount. */
export interface ChatConfig {
	readonly agentName: string;
	readonly persona?: string;
	readonly topicName?: string;
	readonly mode: "conversation" | "task";
	readonly taskBrief?: string;
}

// ── Messages ────────────────────────────────────────────────────────

/** A completed message in the conversation. */
export interface ChatMessage {
	readonly role: "user" | "agent";
	readonly content: string;
	readonly timestamp: string;
	readonly tools?: readonly ChatToolCall[];
}

/** A tool call summary for the collapsible tool panel. */
export interface ChatToolCall {
	readonly name: string;
	readonly target?: string;
	readonly input?: string;
	readonly output?: string;
	readonly status: "done" | "active" | "error";
	readonly durationMs?: number;
}

/**
 * A conversation turn for history display.
 * Projected from ConversationTurn (agent-conversation-store.ts)
 * to only the fields the renderer needs.
 */
export interface ChatTurn {
	readonly role: "user" | "agent";
	readonly content: string;
	readonly timestamp: string;
	readonly thinking?: string;
}

// ── Commands ────────────────────────────────────────────────────────

/** Discriminated union of slash commands parsed from user input. */
export type ChatCommand =
	| { readonly type: "new" }
	| { readonly type: "done" }
	| { readonly type: "back" }
	| { readonly type: "let-go" }
	| { readonly type: "history" }
	| { readonly type: "topics" }
	| { readonly type: "pick"; readonly name: string }
	| { readonly type: "clear" }
	| { readonly type: "focus" }
	| { readonly type: "talk" };

/** Check if raw input text is a slash command. */
export function isChatCommand(input: string): boolean {
	return input.startsWith("/");
}

// ── Renderer Interface ──────────────────────────────────────────────

/** Contract between ChatShell and any terminal chat renderer implementation. */
export interface IChatRenderer {
	mount(config: ChatConfig): Promise<void>;
	unmount(): Promise<MenuResult>;

	pushMessage(message: ChatMessage): void;
	pushStreamEvent(event: AgentStreamEvent): void;
	updateStatus(status: ChatViewStatus): void;
	updateMode(mode: "conversation" | "task"): void;
	showHistory(summary: string, recentTurns: readonly ChatTurn[]): void;

	onUserInput(callback: (text: string) => void): void;
	onCommand(callback: (cmd: ChatCommand) => void): void;
}
