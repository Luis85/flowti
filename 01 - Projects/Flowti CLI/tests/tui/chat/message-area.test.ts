import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { MessageArea } from "../../../src/tui/chat/message-area.js";
import type { ChatMessage } from "../../../src/tui/chat/message-area.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("MessageArea", () => {
	it("renders empty state when no messages", () => {
		const { unmount, ...instance } = render(
			React.createElement(MessageArea, { messages: [] }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("No messages yet");
		unmount();
	});

	it("renders user messages with You: prefix", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "user", content: "Hello world", timestamp: "12:00" },
		];
		const { unmount, ...instance } = render(
			React.createElement(MessageArea, { messages }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("You:");
		expect(frame).toContain("Hello world");
		unmount();
	});

	it("renders assistant messages with Agent: prefix", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "assistant", content: "I can help", timestamp: "12:01" },
		];
		const { unmount, ...instance } = render(
			React.createElement(MessageArea, { messages }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Agent:");
		expect(frame).toContain("I can help");
		unmount();
	});

	it("renders system messages dimmed", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "system", content: "Session started", timestamp: "12:00" },
		];
		const { unmount, ...instance } = render(
			React.createElement(MessageArea, { messages }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Session started");
		unmount();
	});

	it("shows streaming content when provided", () => {
		const messages: ChatMessage[] = [
			{ id: "1", role: "user", content: "Hello", timestamp: "12:00" },
		];
		const { unmount, ...instance } = render(
			React.createElement(MessageArea, { messages, streamingContent: "Thinking about" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Thinking about");
		expect(frame).toContain("...");
		unmount();
	});
});
