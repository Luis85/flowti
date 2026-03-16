/**
 * agents-chat-page.tsx — Agent chat interface stub.
 *
 * Full chat implementation requires streaming infrastructure (Phase 5+).
 * For now, shows a placeholder directing users to the CLI chat command.
 */

import React from "react";
import { Box, Text } from "ink";
import { registerPage } from "./page-registry.js";
import type { PageProps } from "../types.js";

function AgentsChatPage({ params }: PageProps): React.JSX.Element {
	const agentName = params.agentName ?? "";
	return (
		<Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
			<Text bold color="cyan">{agentName ? `Chat with ${agentName}` : "Agent Chat"}</Text>
			<Text dimColor>Interactive chat is available via the CLI:</Text>
			<Text color="yellow">  flowti agents:chat --agent="{agentName || "<name>"}"</Text>
			<Text dimColor>Press Esc to go back.</Text>
		</Box>
	);
}

registerPage("agents-chat", AgentsChatPage);
