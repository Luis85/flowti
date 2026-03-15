/**
 * chat-shell.ts — UI-layer orchestrator for agent chat sessions.
 *
 * Wires the domain (processRunner, conversation store) to the renderer (IChatRenderer).
 * Owns the conversation lifecycle: mount, send, stream, persist, unmount.
 */

import type { IChatRenderer, ChatCommand, ChatTurn } from "../../infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import type { IAgentProcessRunner, AgentProcess } from "../../domain/agents/worker-types.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { IFileSystem, IPaths, IClock, IShell } from "../../infrastructure/types.js";
import type { ConversationFile } from "../../domain/agents/agent-conversation-store.js";
import { loadConversation, saveConversation, createThread, appendTurn, getActiveHistory } from "../../domain/agents/agent-conversation-store.js";
import { buildConversationPrompt, parseAgentResponse } from "../../domain/agents/agent-conversation.js";
import type { AgentCharacter } from "../../domain/agents/agent-conversation.js";
import { readSystemPrompt } from "../../domain/agents/agent-store.js";

// ── Deps ──────────────────────────────────────────────────────────────

export interface ChatShellDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
	readonly shell: IShell;
	readonly log: (msg?: string) => void;
	readonly processRunner: IAgentProcessRunner;
}

// ── ChatShell ─────────────────────────────────────────────────────────

/** Threshold: switch to task mode when this many tool-starts have been observed. */
const TASK_MODE_TOOL_THRESHOLD = 2;

/**
 * Orchestrates the agent chat session.
 * Mounts a renderer, handles user input and slash commands, persists conversation.
 */
export class ChatShell {
	private readonly renderer: IChatRenderer;
	private readonly agent: AgentSummary;
	private readonly deps: ChatShellDeps;
	private readonly vaultRoot: string;
	private readonly projectPath: string;

	private conversation: ConversationFile = { agent: "", threads: [], activeThread: null };
	private varDir: string = "";
	private systemPrompt: string | null = null;
	private character: AgentCharacter = {};
	private activeProcess: AgentProcess | null = null;
	private toolStartCount: number = 0;
	private currentMode: "conversation" | "task" = "conversation";

	private resolveExit: ((result: MenuResult) => void) | null = null;

	constructor(
		renderer: IChatRenderer,
		agent: AgentSummary,
		deps: ChatShellDeps,
		vaultRoot: string,
		projectPath: string,
	) {
		this.renderer = renderer;
		this.agent = agent;
		this.deps = deps;
		this.vaultRoot = vaultRoot;
		this.projectPath = projectPath;
	}

	/** Mount the renderer, register callbacks, load history, return a Promise that resolves on exit. */
	async start(): Promise<MenuResult> {
		this.varDir = this.deps.paths.join(this.vaultRoot, ".flowti", "var");
		this.systemPrompt = readSystemPrompt(this.deps, this.projectPath, this.agent.name);
		this.character = {
			description: this.agent.description,
			persona: this.agent.persona,
			mood: this.agent.mood,
			personality: this.agent.personality,
			attributes: this.agent.attributes,
			experience: this.agent.experience,
		};

		this.conversation = loadConversation(this.deps, this.varDir, this.agent.name);

		await this.renderer.mount({
			agentName: this.agent.name,
			persona: this.agent.persona,
			mode: this.currentMode,
		});

		this.renderer.onUserInput((text: string) => { void this.handleUserInput(text); });
		this.renderer.onCommand((cmd: ChatCommand) => { void this.handleCommand(cmd); });

		// Show recent history on start
		if (this.conversation.activeThread) {
			const history = getActiveHistory(this.conversation);
			const turns: ChatTurn[] = history.map((t) => ({
				role: t.role,
				content: t.content,
				timestamp: t.ts,
				thinking: t.thinking,
			}));
			if (turns.length > 0) {
				this.renderer.showHistory("Resuming conversation", turns);
			}
		}

		return new Promise<MenuResult>((resolve) => {
			this.resolveExit = resolve;
		});
	}

	/** Send user message to processRunner, stream events to renderer, persist turn. */
	async handleUserInput(text: string): Promise<void> {
		const trimmed = text.trim();
		if (!trimmed) return;

		// Ensure active thread
		if (!this.conversation.activeThread) {
			this.conversation = createThread(this.conversation, `thread-${this.deps.clock.ms()}`, this.deps.clock.iso());
		}

		// Append user turn
		this.conversation = appendTurn(this.conversation, {
			role: "user",
			content: trimmed,
			ts: this.deps.clock.iso(),
		});

		// Build prompt
		const history = getActiveHistory(this.conversation);
		const historyForPrompt = history.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));
		const prompt = buildConversationPrompt(
			this.agent.name,
			this.systemPrompt,
			historyForPrompt,
			trimmed,
			this.character,
		);

		// Reset tool count for this exchange
		this.toolStartCount = 0;

		// Spawn process
		this.renderer.updateStatus("thinking");
		const proc = this.deps.processRunner.spawn(this.agent, prompt);
		this.activeProcess = proc;

		const unsubscribe = proc.onEvent((event: AgentStreamEvent) => {
			this.handleStreamEvent(event);
		});

		let resultText = "";
		let resultThinking = "";
		try {
			const result = await proc.result;
			resultText = result.text;
			resultThinking = result.thinking;
		} finally {
			unsubscribe();
			this.activeProcess = null;
		}

		// Parse and persist agent response
		const parsed = parseAgentResponse(resultText);
		if (parsed.message) {
			const agentTs = this.deps.clock.iso();
			this.conversation = appendTurn(this.conversation, {
				role: "agent",
				content: parsed.message,
				ts: agentTs,
				thinking: resultThinking || undefined,
			});
			saveConversation(this.deps, this.varDir, this.agent.name, this.conversation);

			this.renderer.pushMessage({
				role: "agent",
				content: parsed.message,
				timestamp: agentTs,
			});
		}

		this.renderer.updateStatus("idle");
	}

	/** Forward stream event to renderer; track tool-starts for mode switching. */
	handleStreamEvent(event: AgentStreamEvent): void {
		this.renderer.pushStreamEvent(event);

		if (event.kind === "tool-start") {
			this.toolStartCount++;
			this.renderer.updateStatus("working");
			if (this.toolStartCount >= TASK_MODE_TOOL_THRESHOLD && this.currentMode !== "task") {
				this.currentMode = "task";
				this.renderer.updateMode("task");
			}
		} else if (event.kind === "text") {
			this.renderer.updateStatus("thinking");
		} else if (event.kind === "error") {
			this.renderer.updateStatus("error");
		}
	}

	/** Dispatch slash commands. */
	async handleCommand(cmd: ChatCommand): Promise<void> {
		switch (cmd.type) {
			case "done":
			case "back":
				await this.exitSession();
				break;

			case "let-go":
				// Detach without killing the process
				await this.detachSession();
				break;

			case "new":
				await this.newThread();
				break;

			case "history":
				await this.showFullHistory();
				break;

			case "topics":
				this.showTopics();
				break;

			case "pick":
				await this.pickThread(cmd.name);
				break;

			case "clear":
				// Clear is display-only; renderer handles it via pushStreamEvent or similar
				// Nothing to do at the shell level
				break;

			case "talk":
				this.currentMode = "conversation";
				this.renderer.updateMode("conversation");
				break;

			case "focus":
				this.currentMode = "task";
				this.renderer.updateMode("task");
				break;
		}
	}

	// ── Private helpers ───────────────────────────────────────────────

	private async exitSession(): Promise<void> {
		if (this.activeProcess) {
			this.activeProcess.kill();
			this.activeProcess = null;
		}
		const result = await this.renderer.unmount();
		this.resolveExit?.(result);
	}

	private async detachSession(): Promise<void> {
		// Let the process keep running; just unmount
		const result = await this.renderer.unmount();
		this.resolveExit?.(result);
	}

	private async newThread(): Promise<void> {
		const id = `thread-${this.deps.clock.ms()}`;
		this.conversation = createThread(this.conversation, id, this.deps.clock.iso());
		saveConversation(this.deps, this.varDir, this.agent.name, this.conversation);
		this.renderer.showHistory("New conversation started", []);
	}

	private async showFullHistory(): Promise<void> {
		const history = getActiveHistory(this.conversation, 100);
		const turns: ChatTurn[] = history.map((t) => ({
			role: t.role,
			content: t.content,
			timestamp: t.ts,
			thinking: t.thinking,
		}));
		this.renderer.showHistory("Conversation history", turns);
	}

	private showTopics(): void {
		const ids = this.conversation.threads.map((t) => t.id);
		for (const id of ids) {
			this.deps.log(id);
		}
	}

	private async pickThread(name: string): Promise<void> {
		const thread = this.conversation.threads.find((t) => t.id === name);
		if (!thread) return;
		this.conversation = { ...this.conversation, activeThread: name };
		const history = getActiveHistory(this.conversation);
		const turns: ChatTurn[] = history.map((t) => ({
			role: t.role,
			content: t.content,
			timestamp: t.ts,
			thinking: t.thinking,
		}));
		this.renderer.showHistory(`Switched to: ${name}`, turns);
	}
}
