/**
 * use-chat-session.ts — Chat session state management for TUI integration.
 *
 * Implements IChatRenderer inline within the React tree using a DirtyRef +
 * polling pattern (same approach as InkChatRenderer, but embedded in the TUI).
 *
 * The hook manages:
 *   - Mutable state ref (push API for ChatShell)
 *   - Polling interval that syncs to React state
 *   - Submit/command callbacks for InputArea
 *   - Cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage, ChatTurn, ChatViewStatus, ChatCommand, ChatToolCall } from "../../infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";

const RENDER_INTERVAL = process.platform === "win32" ? 200 : 50;

export interface ChatAppState {
	readonly status: ChatViewStatus;
	readonly messages: readonly ChatMessage[];
	readonly summary: string;
	readonly recentTurns: readonly ChatTurn[];
	readonly streamingText: string;
	readonly streamingThinking: string;
	readonly currentTool: string;
	readonly toolsExpanded: boolean;
	readonly taskTools: readonly ChatToolCall[];
	readonly elapsed: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly mode: "conversation" | "task";
}

export interface ChatSessionState {
	readonly state: ChatAppState;
	readonly submit: (text: string) => void;
	readonly command: (cmd: ChatCommand) => void;
	readonly pushMessage: (msg: ChatMessage) => void;
	readonly pushStreamEvent: (event: AgentStreamEvent) => void;
	readonly updateStatus: (status: ChatViewStatus) => void;
	readonly updateMode: (mode: "conversation" | "task") => void;
	readonly showHistory: (summary: string, turns: readonly ChatTurn[]) => void;
	readonly onUserInput: (callback: (text: string) => void) => void;
	readonly onCommandHandler: (callback: (cmd: ChatCommand) => void) => void;
}

interface DirtyRef {
	current: ChatAppState;
	dirty: boolean;
}

interface ActiveToolEntry {
	id: string;
	startMs: number;
	index: number;
}

const INITIAL_STATE: ChatAppState = {
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
	mode: "conversation",
};

export function useChatSession(): ChatSessionState {
	const [state, setState] = useState<ChatAppState>(INITIAL_STATE);
	const dirtyRef = useRef<DirtyRef>({ current: INITIAL_STATE, dirty: false });
	const activeToolsRef = useRef<ActiveToolEntry[]>([]);
	const submitRef = useRef<((text: string) => void) | null>(null);
	const commandRef = useRef<((cmd: ChatCommand) => void) | null>(null);

	// Polling interval — syncs mutable ref to React state
	useEffect(() => {
		const id = setInterval(() => {
			if (dirtyRef.current.dirty) {
				dirtyRef.current.dirty = false;
				setState({ ...dirtyRef.current.current });
			}
		}, RENDER_INTERVAL);
		return () => clearInterval(id);
	}, []);

	const markDirty = useCallback(() => { dirtyRef.current.dirty = true; }, []);

	const pushMessage = useCallback((msg: ChatMessage) => {
		const s = dirtyRef.current.current;
		dirtyRef.current.current = {
			...s,
			messages: [...s.messages, msg],
			streamingText: "",
			streamingThinking: "",
		};
		markDirty();
	}, [markDirty]);

	const pushStreamEvent = useCallback((event: AgentStreamEvent) => {
		const s = dirtyRef.current.current;
		const tools = activeToolsRef.current;

		switch (event.kind) {
			case "thinking":
				dirtyRef.current.current = { ...s, streamingThinking: s.streamingThinking + event.text };
				break;
			case "text":
				dirtyRef.current.current = { ...s, streamingText: s.streamingText + event.text };
				break;
			case "tool-start": {
				const newTool: ChatToolCall = { name: event.name, status: "active" };
				const entry: ActiveToolEntry = { id: event.id, startMs: Date.now(), index: s.taskTools.length };
				tools.push(entry);
				dirtyRef.current.current = { ...s, taskTools: [...s.taskTools, newTool], currentTool: event.name };
				break;
			}
			case "tool-input": {
				const lastEntry = tools[tools.length - 1];
				if (!lastEntry) break;
				const updated = s.taskTools.map((t, i) =>
					i !== lastEntry.index ? t : { ...t, input: (t.input ?? "") + event.json },
				);
				dirtyRef.current.current = { ...s, taskTools: updated };
				break;
			}
			case "tool-end": {
				const entryIdx = tools.findIndex((e) => e.id === event.id);
				if (entryIdx === -1) break;
				const entry = tools[entryIdx];
				const durationMs = Date.now() - entry.startMs;
				const updated = s.taskTools.map((t, i) =>
					i !== entry.index ? t : { ...t, status: "done" as const, durationMs },
				);
				tools.splice(entryIdx, 1);
				const stillActive = tools.length > 0 ? s.taskTools[tools[tools.length - 1].index]?.name ?? "" : "";
				dirtyRef.current.current = { ...s, taskTools: updated, currentTool: stillActive };
				break;
			}
			case "error":
				dirtyRef.current.current = { ...s, streamingText: s.streamingText + event.message };
				break;
			case "usage":
				dirtyRef.current.current = { ...s, inputTokens: event.inputTokens, outputTokens: event.outputTokens };
				break;
			case "done":
				break;
		}
		markDirty();
	}, [markDirty]);

	const updateStatus = useCallback((status: ChatViewStatus) => {
		dirtyRef.current.current = { ...dirtyRef.current.current, status };
		markDirty();
	}, [markDirty]);

	const updateMode = useCallback((mode: "conversation" | "task") => {
		dirtyRef.current.current = { ...dirtyRef.current.current, mode };
		markDirty();
	}, [markDirty]);

	const showHistory = useCallback((summary: string, turns: readonly ChatTurn[]) => {
		dirtyRef.current.current = { ...dirtyRef.current.current, summary, recentTurns: turns, messages: [] };
		markDirty();
	}, [markDirty]);

	const submit = useCallback((text: string) => { submitRef.current?.(text); }, []);
	const command = useCallback((cmd: ChatCommand) => { commandRef.current?.(cmd); }, []);

	const onUserInput = useCallback((callback: (text: string) => void) => {
		submitRef.current = callback;
	}, []);

	const onCommandHandler = useCallback((callback: (cmd: ChatCommand) => void) => {
		commandRef.current = callback;
	}, []);

	return {
		state,
		submit,
		command,
		pushMessage,
		pushStreamEvent,
		updateStatus,
		updateMode,
		showHistory,
		onUserInput,
		onCommandHandler,
	};
}
