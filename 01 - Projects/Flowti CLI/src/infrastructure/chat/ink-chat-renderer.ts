/**
 * ink-chat-renderer.ts — Ink/React implementation of IChatRenderer.
 *
 * This is the ONLY file in the CLI that imports ink and react directly.
 * All React components are composed via React.createElement (no JSX — .ts not .tsx).
 *
 * Architecture:
 *   - State lives in a plain mutable ref ({ current: ChatAppState }).
 *   - Push methods mutate the ref imperatively.
 *   - A setInterval inside the React component polls the ref and calls setState
 *     to trigger re-renders, decoupling the push API from React's model.
 *   - Render throttle: 80ms on Windows (ConPTY perf), 16ms elsewhere.
 */

import React, { useState, useEffect } from "react";
import { Box, render } from "ink";
import type { Instance } from "ink";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { MenuResult } from "../types.js";
import type {
	IChatRenderer,
	ChatConfig,
	ChatMessage,
	ChatToolCall,
	ChatTurn,
	ChatViewStatus,
	ChatCommand,
} from "./chat-renderer-types.js";
import { HeaderBar } from "./components/header-bar.js";
import { MessageArea } from "./components/message-area.js";
import { ActivityBar } from "./components/activity-bar.js";
import { InputArea } from "./components/input-area.js";
import { TaskView } from "./components/task-view.js";

// ── Render throttle ──────────────────────────────────────────────────

const RENDER_INTERVAL = process.platform === "win32" ? 200 : 50;

// ── App state ────────────────────────────────────────────────────────

interface ChatAppState {
	config: ChatConfig;
	status: ChatViewStatus;
	messages: ChatMessage[];
	summary: string;
	recentTurns: readonly ChatTurn[];
	streamingText: string;
	streamingThinking: string;
	currentTool: string;
	toolsExpanded: boolean;
	taskTools: ChatToolCall[];
	elapsed: number;
	inputTokens: number;
	outputTokens: number;
}

// ── Active tool tracking (mutable, not part of rendered state) ───────

interface ActiveToolEntry {
	id: string;
	startMs: number;
	index: number;
}

// ── Stream event handler context ────────────────────────────────────

interface StreamHandlerContext {
	readonly stateRef: DirtyRef;
	readonly activeTools: ActiveToolEntry[];
	readonly elapsedStartMs: number;
}

function markDirtyCtx(ctx: StreamHandlerContext): void { ctx.stateRef.dirty = true; }

function handleThinking(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "thinking" }): void {
	const s = ctx.stateRef.current;
	ctx.stateRef.current = { ...s, streamingThinking: s.streamingThinking + event.text };
	markDirtyCtx(ctx);
}

function handleText(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "text" }): void {
	const s = ctx.stateRef.current;
	ctx.stateRef.current = { ...s, streamingText: s.streamingText + event.text };
	markDirtyCtx(ctx);
}

function handleToolStart(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "tool-start" }): void {
	const s = ctx.stateRef.current;
	const newTool: ChatToolCall = { name: event.name, status: "active" };
	const entry: ActiveToolEntry = { id: event.id, startMs: Date.now(), index: s.taskTools.length };
	ctx.activeTools.push(entry);
	ctx.stateRef.current = { ...s, taskTools: [...s.taskTools, newTool], currentTool: event.name };
	markDirtyCtx(ctx);
}

function handleToolInput(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "tool-input" }): void {
	const s = ctx.stateRef.current;
	const lastEntry = ctx.activeTools[ctx.activeTools.length - 1];
	if (!lastEntry) return;
	const updated = s.taskTools.map((t, i) =>
		i !== lastEntry.index ? t : { ...t, input: (t.input ?? "") + event.json },
	);
	ctx.stateRef.current = { ...s, taskTools: updated };
	markDirtyCtx(ctx);
}

function handleToolEnd(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "tool-end" }): void {
	const s = ctx.stateRef.current;
	const entryIdx = ctx.activeTools.findIndex((e) => e.id === event.id);
	if (entryIdx === -1) return;
	const entry = ctx.activeTools[entryIdx];
	const durationMs = Date.now() - entry.startMs;
	const updated = s.taskTools.map((t, i) =>
		i !== entry.index ? t : { ...t, status: "done" as const, durationMs },
	);
	ctx.activeTools.splice(entryIdx, 1);
	const stillActive = ctx.activeTools.length > 0
		? s.taskTools[ctx.activeTools[ctx.activeTools.length - 1].index]?.name ?? ""
		: "";
	ctx.stateRef.current = { ...s, taskTools: updated, currentTool: stillActive };
	markDirtyCtx(ctx);
}

function handleError(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "error" }): void {
	const s = ctx.stateRef.current;
	ctx.stateRef.current = { ...s, streamingText: s.streamingText + event.message };
	markDirtyCtx(ctx);
}

function handleUsage(ctx: StreamHandlerContext, event: AgentStreamEvent & { kind: "usage" }): void {
	const s = ctx.stateRef.current;
	ctx.stateRef.current = { ...s, inputTokens: event.inputTokens, outputTokens: event.outputTokens };
	markDirtyCtx(ctx);
}

function handleDone(ctx: StreamHandlerContext): void {
	const s = ctx.stateRef.current;
	ctx.stateRef.current = { ...s, elapsed: Date.now() - ctx.elapsedStartMs };
	markDirtyCtx(ctx);
}

// ── ChatApp component (no JSX — .ts file) ────────────────────────────

interface DirtyRef {
	current: ChatAppState;
	dirty: boolean;
}

interface ChatAppProps {
	readonly stateRef: DirtyRef;
	readonly onSubmit: (text: string) => void;
	readonly onCommand: (cmd: ChatCommand) => void;
}

function ChatApp({ stateRef, onSubmit, onCommand }: ChatAppProps): React.JSX.Element {
	const [state, setState] = useState<ChatAppState>(() => stateRef.current);

	useEffect(() => {
		const id = setInterval(() => {
			if (stateRef.dirty) {
				stateRef.dirty = false;
				setState({ ...stateRef.current });
			}
		}, RENDER_INTERVAL);
		return () => clearInterval(id);
	}, [stateRef]);

	const isDisabled = state.status === "thinking" || state.status === "working";
	const showTask = state.config.mode === "task" && state.config.taskBrief !== undefined;

	return React.createElement(
		Box,
		{ flexDirection: "column", height: process.stdout.rows },
		React.createElement(HeaderBar, {
			agentName: state.config.agentName,
			persona: state.config.persona,
			status: state.status,
			topicName: state.config.topicName,
		}),
		showTask
			? React.createElement(TaskView, {
				brief: state.config.taskBrief as string,
				tools: state.taskTools,
				status: state.status,
				elapsed: state.elapsed,
			})
			: React.createElement(MessageArea, {
				summary: state.summary,
				recentTurns: state.recentTurns,
				messages: state.messages,
				streamingText: state.streamingText,
				streamingThinking: state.streamingThinking,
				agentName: state.config.agentName,
				agentStatus: state.status,
				toolsExpanded: state.toolsExpanded,
			}),
		React.createElement(ActivityBar, {
			status: state.status,
			elapsed: state.elapsed,
			inputTokens: state.inputTokens,
			outputTokens: state.outputTokens,
			currentTool: state.currentTool !== "" ? state.currentTool : undefined,
		}),
		React.createElement(InputArea, {
			disabled: isDisabled,
			onSubmit,
			onCommand,
		}),
	);
}

// ── InkChatRenderer ──────────────────────────────────────────────────

export class InkChatRenderer implements IChatRenderer {
	private stateRef: DirtyRef | null = null;
	private inkInstance: Instance | null = null;
	private elapsedTimer: ReturnType<typeof setInterval> | null = null;
	private elapsedStartMs = 0;
	private activeTools: ActiveToolEntry[] = [];

	private userInputCallback: ((text: string) => void) | null = null;
	private commandCallback: ((cmd: ChatCommand) => void) | null = null;

	// ── IChatRenderer: lifecycle ─────────────────────────────────────

	async mount(config: ChatConfig): Promise<void> {
		const initialState: ChatAppState = {
			config,
			status: "idle",
			messages: [],
			summary: "",
			recentTurns: [],
			streamingText: "",
			streamingThinking: "",
			currentTool: "",
			toolsExpanded: false,
			taskTools: [],
			elapsed: 0,
			inputTokens: 0,
			outputTokens: 0,
		};

		this.stateRef = { current: initialState, dirty: true };
		this.activeTools = [];

		const handleSubmit = (text: string): void => {
			this.userInputCallback?.(text);
		};

		const handleCommand = (cmd: ChatCommand): void => {
			this.commandCallback?.(cmd);
		};

		// Ensure stdin is active — readline.close() from the menu system pauses it
		const { stdin } = process;
		if (stdin.isTTY && typeof stdin.setRawMode === "function") {
			stdin.setRawMode(true);
			stdin.resume();
		}

		this.inkInstance = render(
			React.createElement(ChatApp, {
				stateRef: this.stateRef,
				onSubmit: handleSubmit,
				onCommand: handleCommand,
			}),
		);
	}

	async unmount(): Promise<MenuResult> {
		this.stopElapsedTimer();
		this.inkInstance?.unmount();
		this.inkInstance = null;
		this.stateRef = null;

		// Restore stdin for the menu system
		const { stdin } = process;
		if (stdin.isTTY && typeof stdin.setRawMode === "function") {
			stdin.setRawMode(false);
			stdin.pause();
		}
		return "main";
	}

	// ── IChatRenderer: push API ──────────────────────────────────────

	private markDirty(): void {
		if (this.stateRef) this.stateRef.dirty = true;
	}

	pushMessage(message: ChatMessage): void {
		if (!this.stateRef) return;
		this.stateRef.current = {
			...this.stateRef.current,
			messages: [...this.stateRef.current.messages, message],
			streamingText: "",
			streamingThinking: "",
		};
		this.markDirty();
	}

	pushStreamEvent(event: AgentStreamEvent): void {
		if (!this.stateRef) return;
		const ctx: StreamHandlerContext = {
			stateRef: this.stateRef,
			activeTools: this.activeTools,
			elapsedStartMs: this.elapsedStartMs,
		};
		switch (event.kind) {
			case "thinking": handleThinking(ctx, event); break;
			case "text": handleText(ctx, event); break;
			case "tool-start": handleToolStart(ctx, event); break;
			case "tool-input": handleToolInput(ctx, event); break;
			case "tool-end": handleToolEnd(ctx, event); break;
			case "error": handleError(ctx, event); break;
			case "usage": handleUsage(ctx, event); break;
			case "done": handleDone(ctx); break;
		}
	}

	updateStatus(status: ChatViewStatus): void {
		if (!this.stateRef) return;
		this.stateRef.current = { ...this.stateRef.current, status };
		this.markDirty();

		if (status === "thinking" || status === "working") {
			this.startElapsedTimer();
		} else {
			this.stopElapsedTimer();
		}
	}

	updateMode(mode: "conversation" | "task"): void {
		if (!this.stateRef) return;
		this.stateRef.current = {
			...this.stateRef.current,
			config: { ...this.stateRef.current.config, mode },
		};
		this.markDirty();
	}

	showHistory(summary: string, recentTurns: readonly ChatTurn[]): void {
		if (!this.stateRef) return;
		this.stateRef.current = {
			...this.stateRef.current,
			summary,
			recentTurns,
			messages: [],
		};
		this.markDirty();
	}

	// ── IChatRenderer: callbacks ─────────────────────────────────────

	onUserInput(callback: (text: string) => void): void {
		this.userInputCallback = callback;
	}

	onCommand(callback: (cmd: ChatCommand) => void): void {
		this.commandCallback = callback;
	}

	// ── Private helpers ──────────────────────────────────────────────

	private startElapsedTimer(): void {
		if (this.elapsedTimer !== null) return;
		this.elapsedStartMs = Date.now();
		this.elapsedTimer = setInterval(() => {
			if (!this.stateRef) return;
			this.stateRef.current = {
				...this.stateRef.current,
				elapsed: Date.now() - this.elapsedStartMs,
			};
			this.markDirty();
		}, 1000);
	}

	private stopElapsedTimer(): void {
		if (this.elapsedTimer === null) return;
		clearInterval(this.elapsedTimer);
		this.elapsedTimer = null;
	}
}
