/**
 * ink-chat-renderer.test.ts — Tests for InkChatRenderer and its React components.
 *
 * Uses ink-testing-library to render components in a headless terminal.
 * Components are exercised directly via React.createElement (no JSX in .ts files).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { HeaderBar } from "../../../src/infrastructure/chat/components/header-bar.js";
import { ActivityBar } from "../../../src/infrastructure/chat/components/activity-bar.js";
import { ToolPanel } from "../../../src/infrastructure/chat/components/tool-panel.js";
import { Message } from "../../../src/infrastructure/chat/components/message.js";
import { TaskView } from "../../../src/infrastructure/chat/components/task-view.js";
import type { ChatMessage, ChatToolCall } from "../../../src/infrastructure/chat/chat-renderer-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

// ── HeaderBar ────────────────────────────────────────────────────────

describe("HeaderBar", () => {
	it("renders agent name and status", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, {
				agentName: "Atlas",
				status: "idle",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Atlas");
		unmount();
	});

	it("renders persona when provided", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, {
				agentName: "Atlas",
				persona: "Lead Architect",
				status: "thinking",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Atlas");
		expect(frame).toContain("Lead Architect");
		unmount();
	});

	it("renders topic name when provided", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, {
				agentName: "Atlas",
				status: "working",
				topicName: "feature-auth",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("feature-auth");
		unmount();
	});

	it("renders navigation hint", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, {
				agentName: "Atlas",
				status: "idle",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("/ commands");
		unmount();
	});
});

// ── ActivityBar ──────────────────────────────────────────────────────

describe("ActivityBar", () => {
	it("renders idle status", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, {
				status: "idle",
				elapsed: 0,
				inputTokens: 0,
				outputTokens: 0,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Idle");
		unmount();
	});

	it("renders token counts in 2.4k format", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, {
				status: "idle",
				elapsed: 0,
				inputTokens: 2400,
				outputTokens: 500,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("2.4k");
		expect(frame).toContain("500");
		unmount();
	});

	it("renders current tool name when working", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, {
				status: "working",
				elapsed: 5000,
				inputTokens: 100,
				outputTokens: 50,
				currentTool: "Read",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Read");
		unmount();
	});

	it("renders elapsed time", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, {
				status: "thinking",
				elapsed: 3000,
				inputTokens: 0,
				outputTokens: 0,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("3s");
		unmount();
	});
});

// ── ToolPanel ────────────────────────────────────────────────────────

describe("ToolPanel", () => {
	const tools: ChatToolCall[] = [
		{ name: "Read", target: "auth.ts", status: "done", durationMs: 120 },
		{ name: "Write", target: "test.ts", status: "done", durationMs: 80 },
	];

	it("renders collapsed summary with tool count", () => {
		const { unmount, ...instance } = render(
			React.createElement(ToolPanel, {
				tools,
				expanded: false,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("2 tool calls");
		expect(frame).toContain("Read");
		unmount();
	});

	it("renders expanded view with checkmarks and durations", () => {
		const { unmount, ...instance } = render(
			React.createElement(ToolPanel, {
				tools,
				expanded: true,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("✓");
		expect(frame).toContain("120ms");
		unmount();
	});

	it("renders single tool call with correct grammar", () => {
		const single: ChatToolCall[] = [
			{ name: "Bash", status: "active" },
		];
		const { unmount, ...instance } = render(
			React.createElement(ToolPanel, {
				tools: single,
				expanded: false,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("1 tool call");
		// Should not say "1 tool calls"
		expect(frame).not.toContain("1 tool calls");
		unmount();
	});
});

// ── Message ──────────────────────────────────────────────────────────

describe("Message", () => {
	it("renders user message with 'You' label", () => {
		const msg: ChatMessage = {
			role: "user",
			content: "Hello, can you help me?",
			timestamp: new Date().toISOString(),
		};
		const { unmount, ...instance } = render(
			React.createElement(Message, {
				message: msg,
				agentName: "Atlas",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("You");
		expect(frame).toContain("Hello, can you help me?");
		unmount();
	});

	it("renders agent message with agent name", () => {
		const msg: ChatMessage = {
			role: "agent",
			content: "Sure, I can help!",
			timestamp: new Date().toISOString(),
		};
		const { unmount, ...instance } = render(
			React.createElement(Message, {
				message: msg,
				agentName: "Atlas",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Atlas");
		expect(frame).toContain("Sure, I can help!");
		unmount();
	});

	it("renders tool panel when tools are present", () => {
		const msg: ChatMessage = {
			role: "agent",
			content: "I read the file.",
			timestamp: new Date().toISOString(),
			tools: [{ name: "Read", target: "index.ts", status: "done", durationMs: 50 }],
		};
		const { unmount, ...instance } = render(
			React.createElement(Message, {
				message: msg,
				agentName: "Atlas",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("1 tool call");
		unmount();
	});

	it("does not render tool panel when tools array is absent", () => {
		const msg: ChatMessage = {
			role: "user",
			content: "Just a message.",
			timestamp: new Date().toISOString(),
		};
		const { unmount, ...instance } = render(
			React.createElement(Message, {
				message: msg,
				agentName: "Atlas",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).not.toContain("tool call");
		unmount();
	});
});

// ── TaskView ──────────────────────────────────────────────────────────

describe("TaskView", () => {
	it("renders task brief", () => {
		const { unmount, ...instance } = render(
			React.createElement(TaskView, {
				brief: "Refactor the auth module",
				tools: [],
				status: "working",
				elapsed: 0,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Refactor the auth module");
		unmount();
	});

	it("renders tool icons for active and done tools", () => {
		const tools: ChatToolCall[] = [
			{ name: "Read", target: "auth.ts", status: "done", durationMs: 100 },
			{ name: "Bash", status: "active" },
		];
		const { unmount, ...instance } = render(
			React.createElement(TaskView, {
				brief: "Run tests",
				tools,
				status: "working",
				elapsed: 2000,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("✓");
		expect(frame).toContain("⟳");
		unmount();
	});

	it("renders progress counts in footer", () => {
		const tools: ChatToolCall[] = [
			{ name: "Read", status: "done" },
			{ name: "Write", status: "done" },
			{ name: "Bash", status: "active" },
		];
		const { unmount, ...instance } = render(
			React.createElement(TaskView, {
				brief: "Do stuff",
				tools,
				status: "working",
				elapsed: 10000,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("2 done");
		expect(frame).toContain("1 active");
		unmount();
	});
});
