/**
 * Talk tab — conversation thread with input field.
 * Pure DOM, calls apiClient.sendMessage() on send.
 */

import type { sendMessage } from "../data/api-client.js";

export interface TalkTabOptions {
	readonly sendMessage: typeof sendMessage;
	readonly baseUrl: string;
}

export function renderTalkTab(
	container: HTMLElement,
	agentName: string,
	options: TalkTabOptions,
): void {
	container.innerHTML = "";

	const thread = document.createElement("div");
	thread.className = "agent-panel-talk-thread";
	thread.setAttribute("data-testid", "talk-thread");
	container.appendChild(thread);

	const inputRow = document.createElement("div");
	inputRow.className = "agent-panel-talk-input";

	const input = document.createElement("input");
	input.type = "text";
	input.placeholder = `Message ${agentName}...`;
	input.setAttribute("data-testid", "talk-input");
	inputRow.appendChild(input);

	const sendBtn = document.createElement("button");
	sendBtn.textContent = "Send";
	sendBtn.setAttribute("data-testid", "talk-send");
	inputRow.appendChild(sendBtn);

	container.appendChild(inputRow);

	function appendTurn(sender: "user" | "agent", text: string): void {
		const turn = document.createElement("div");
		turn.className = "agent-panel-talk-turn";
		turn.setAttribute("data-sender", sender);
		const label = sender === "user" ? "You" : agentName;
		turn.textContent = `${label}: ${text}`;
		thread.appendChild(turn);
		thread.scrollTop = thread.scrollHeight;
	}

	function handleSend(): void {
		const text = input.value.trim();
		if (!text) return;
		appendTurn("user", text);
		input.value = "";
		void options.sendMessage(options.baseUrl, agentName, text);
	}

	sendBtn.addEventListener("click", handleSend);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") handleSend();
	});
}

export function appendAgentResponse(container: HTMLElement, text: string): void {
	const thread = container.querySelector(".agent-panel-talk-thread");
	if (!thread) return;

	const turn = document.createElement("div");
	turn.className = "agent-panel-talk-turn";
	turn.setAttribute("data-sender", "agent");
	turn.textContent = text;
	thread.appendChild(turn);
	(thread as HTMLElement).scrollTop = thread.scrollHeight;
}
