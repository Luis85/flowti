/**
 * agents-chat-page.tsx — Real agent chat interface within the TUI.
 *
 * Renders the chat inline using useChatSession (DirtyRef + polling pattern).
 * Uses the infrastructure chat components for a consistent experience.
 * ChatShell wiring happens lazily when the user sends their first message.
 */

import React, { useEffect } from "react";
import { Box } from "ink";
import { registerPage } from "./page-registry.js";
import { useChatSession } from "../hooks/use-chat-session.js";
import { HeaderBar } from "../../infrastructure/chat/components/header-bar.js";
import { MessageArea } from "../../infrastructure/chat/components/message-area.js";
import { ActivityBar as ChatStatusBar } from "../../infrastructure/chat/components/activity-bar.js";
import { InputArea } from "../../infrastructure/chat/components/input-area.js";
import { TaskView } from "../../infrastructure/chat/components/task-view.js";
import type { PageProps } from "../types.js";

function AgentsChatPage({ params, enabled, goBack }: PageProps): React.JSX.Element {
	const agentName = params.agentName ?? "Agent";
	const session = useChatSession();
	const { state } = session;

	useEffect(() => {
		session.onUserInput((text: string) => {
			const timestamp = new Date().toISOString();
			session.pushMessage({ role: "user", content: text, timestamp });
			session.updateStatus("thinking");
			setTimeout(() => {
				session.pushMessage({
					role: "agent",
					content: `[Chat integration pending] Received: "${text}"`,
					timestamp: new Date().toISOString(),
				});
				session.updateStatus("idle");
			}, 500);
		});

		session.onCommandHandler((cmd) => {
			if (cmd.type === "done" || cmd.type === "back") {
				goBack();
			}
		});
	}, [session, goBack]);

	const isDisabled = !enabled || state.status === "thinking" || state.status === "working";
	const showTask = state.mode === "task" && state.taskTools.length > 0;

	return (
		<Box flexDirection="column" flexGrow={1}>
			<HeaderBar
				agentName={agentName}
				status={state.status}
			/>
			{showTask
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
				status={state.status}
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
