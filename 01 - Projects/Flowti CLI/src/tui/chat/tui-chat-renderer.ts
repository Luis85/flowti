/**
 * tui-chat-renderer.ts — Adapter bridging useChatSession to IChatRenderer.
 *
 * ChatShell expects an IChatRenderer object. useChatSession is a React hook
 * returning ChatSessionState. This class delegates every IChatRenderer method
 * to the corresponding ChatSessionState callback.
 */

import type { IChatRenderer, ChatConfig, ChatMessage, ChatTurn, ChatViewStatus, ChatCommand } from "../../infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { ChatSessionState } from "../hooks/use-chat-session.js";

export class TuiChatRenderer implements IChatRenderer {
	constructor(private readonly session: ChatSessionState) {}

	async mount(_config: ChatConfig): Promise<void> {
		// No-op — TUI page is already rendered.
	}

	async unmount(): Promise<MenuResult> {
		return "main";
	}

	pushMessage(message: ChatMessage): void {
		this.session.pushMessage(message);
	}

	pushStreamEvent(event: AgentStreamEvent): void {
		this.session.pushStreamEvent(event);
	}

	updateStatus(status: ChatViewStatus): void {
		this.session.updateStatus(status);
	}

	updateMode(mode: "conversation" | "task"): void {
		this.session.updateMode(mode);
	}

	showHistory(summary: string, recentTurns: readonly ChatTurn[]): void {
		this.session.showHistory(summary, recentTurns);
	}

	onUserInput(callback: (text: string) => void): void {
		this.session.onUserInput(callback);
	}

	onCommand(callback: (cmd: ChatCommand) => void): void {
		this.session.onCommandHandler(callback);
	}
}
