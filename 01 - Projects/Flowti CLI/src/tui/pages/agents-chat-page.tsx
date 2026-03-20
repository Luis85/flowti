/**
 * agents-chat-page.tsx — Agent chat interface wired to ChatShell.
 *
 * Renders the chat inline using useChatSession. On mount, resolves the agent,
 * checks for Claude CLI, creates a ChatShell, and starts the conversation.
 * Gracefully disables input when Claude CLI is not available.
 */

import React, { useEffect, useState, useRef } from "react";
import { Box, Text } from "ink";
import { registerPage } from "./page-registry.js";
import { useTuiContext } from "../context.js";
import { useChatSession } from "../hooks/use-chat-session.js";
import { TuiChatRenderer } from "../chat/tui-chat-renderer.js";
import { HeaderBar } from "../../infrastructure/chat/components/header-bar.js";
import { hasLLMProvider } from "../../domain/agents/llm-availability.js";
import { MessageArea } from "../../infrastructure/chat/components/message-area.js";
import { ActivityBar as ChatStatusBar } from "../../infrastructure/chat/components/activity-bar.js";
import { InputArea } from "../../infrastructure/chat/components/input-area.js";
import { TaskView } from "../../infrastructure/chat/components/task-view.js";
import type { PageProps } from "../types.js";

type ConnectionStatus = "connecting" | "connected" | "error";

function AgentsChatPage({ params, enabled, goBack }: PageProps): React.JSX.Element {
	const agentName = params.agentName ?? "Agent";
	const tui = useTuiContext();
	const session = useChatSession();
	const { state } = session;
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
	const [connectionError, setConnectionError] = useState("");
	const shellRef = useRef<{ started: boolean }>({ started: false });

	useEffect(() => {
		if (shellRef.current.started) return;
		shellRef.current.started = true;

		let cancelled = false;

		(async () => {
			// 1. Check Claude CLI
			if (!hasLLMProvider(tui.providerRegistry)) {
				if (!cancelled) {
					setConnectionError("No LLM provider available. Install Claude CLI or Cursor.");
					setConnectionStatus("error");
				}
				return;
			}

			// 2. Resolve agent
			const { findAgent } = await import("../../domain/agents/agent-store.js");
			const agent = findAgent(tui.deps, tui.vaultRoot, agentName, tui.agentsConfig);
			if (!agent) {
				if (!cancelled) {
					setConnectionError(`Agent "${agentName}" not found.`);
					setConnectionStatus("error");
				}
				return;
			}

			// 3. Create ChatShell
			const { ChatShell } = await import("../../ui/menus/chat-shell.js");
			const renderer = new TuiChatRenderer(session);
			const chatDeps = {
				disk: tui.deps.disk,
				paths: tui.deps.paths,
				clock: tui.deps.clock,
				shell: tui.deps.shell,
				log: tui.deps.log,
				processRunner: tui.processRunner,
			};
			const shell = new ChatShell(renderer, agent, chatDeps, tui.vaultRoot, tui.projectPath);

			if (!cancelled) {
				setConnectionStatus("connected");
			}

			// 4. Start — resolves when ChatShell exits (/done, /back)
			await shell.start();

			// 5. ChatShell exited — navigate back
			if (!cancelled) {
				goBack();
			}
		})();

		return () => { cancelled = true; };
	}, [agentName, tui, session, goBack]);

	const isDisabled = !enabled || connectionStatus !== "connected" || state.status === "thinking" || state.status === "working";
	const showTask = state.mode === "task" && state.taskTools.length > 0;

	const statusMessage = connectionStatus === "connecting"
		? "Connecting..."
		: connectionStatus === "error"
			? connectionError
			: "";

	return (
		<Box flexDirection="column" flexGrow={1}>
			<HeaderBar
				agentName={agentName}
				status={connectionStatus === "connected" ? state.status : "idle"}
			/>
			{statusMessage !== ""
				? <Box flexGrow={1} alignItems="center" justifyContent="center">
					<Text color={connectionStatus === "error" ? "red" : "yellow"}>{statusMessage}</Text>
				</Box>
				: showTask
					? <TaskView
						brief={agentName}
						tools={state.taskTools}
						status={state.status}
						elapsed={state.elapsed}
					/>
					: <MessageArea
						summary={state.summary}
						recentTurns={state.recentTurns}
						messages={state.messages}
						streamingText={state.streamingText}
						streamingThinking={state.streamingThinking}
						agentName={agentName}
						agentStatus={state.status}
						toolsExpanded={state.toolsExpanded}
					/>
			}
			<ChatStatusBar
				status={connectionStatus === "connected" ? state.status : "idle"}
				elapsed={state.elapsed}
				inputTokens={state.inputTokens}
				outputTokens={state.outputTokens}
				currentTool={state.currentTool !== "" ? state.currentTool : undefined}
			/>
			<InputArea
				disabled={isDisabled}
				onSubmit={session.submit}
				onCommand={session.command}
			/>
		</Box>
	);
}

registerPage("agents-chat", AgentsChatPage);
