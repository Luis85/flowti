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
		showThinkingIndicator(container);
		void options.sendMessage(options.baseUrl, agentName, text);
	}

	sendBtn.addEventListener("click", handleSend);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") handleSend();
	});
}

/** Strip markdown code fences and extract message from JSON agent responses. */
export function extractAgentMessage(raw: string): string {
	// Strip ```json ... ``` or ``` ... ``` wrappers
	let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

	// Try to parse as JSON and extract "message" field
	try {
		const parsed: unknown = JSON.parse(cleaned);
		if (parsed && typeof parsed === "object" && "message" in parsed) {
			const msg = (parsed as { message: unknown }).message;
			if (typeof msg === "string") return msg;
		}
	} catch {
		// Not JSON — use as-is
	}

	// If the original had code fences but wasn't valid JSON, return cleaned version
	if (raw !== cleaned) return cleaned;

	return raw;
}

/** Show an animated "thinking..." indicator in the talk thread. */
export function showThinkingIndicator(container: HTMLElement): void {
	const thread = container.querySelector(".agent-panel-talk-thread");
	if (!thread) return;

	// Don't add a duplicate
	if (thread.querySelector(".agent-panel-talk-thinking")) return;

	const indicator = document.createElement("div");
	indicator.className = "agent-panel-talk-thinking";
	indicator.setAttribute("data-sender", "agent");
	indicator.innerHTML = '<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
	thread.appendChild(indicator);
	(thread as HTMLElement).scrollTop = thread.scrollHeight;
}

/** Remove the thinking indicator from the talk thread. */
export function removeThinkingIndicator(container: HTMLElement): void {
	const thread = container.querySelector(".agent-panel-talk-thread");
	if (!thread) return;
	const indicator = thread.querySelector(".agent-panel-talk-thinking");
	if (indicator) indicator.remove();
}

export function appendAgentResponse(container: HTMLElement, text: string): void {
	const thread = container.querySelector(".agent-panel-talk-thread");
	if (!thread) return;

	// Remove thinking indicator if present
	const indicator = thread.querySelector(".agent-panel-talk-thinking");
	if (indicator) indicator.remove();

	const turn = document.createElement("div");
	turn.className = "agent-panel-talk-turn";
	turn.setAttribute("data-sender", "agent");
	turn.textContent = extractAgentMessage(text);
	thread.appendChild(turn);
	(thread as HTMLElement).scrollTop = thread.scrollHeight;
}
