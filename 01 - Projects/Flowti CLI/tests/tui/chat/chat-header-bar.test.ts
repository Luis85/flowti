import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ChatHeaderBar } from "../../../src/tui/chat/chat-header-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ChatHeaderBar", () => {
	it("renders agent name", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatHeaderBar, { agentName: "Architect", status: "idle", model: "claude-3" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Architect");
		unmount();
	});

	it("renders status", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatHeaderBar, { agentName: "Architect", status: "thinking", model: "claude-3" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("thinking");
		unmount();
	});

	it("renders model", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatHeaderBar, { agentName: "Architect", status: "idle", model: "claude-3" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("claude-3");
		unmount();
	});

	it("shows spinner indicator when status is thinking", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatHeaderBar, { agentName: "Architect", status: "thinking", model: "claude-3" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u25CC");
		unmount();
	});

	it("shows spinner indicator when status is streaming", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatHeaderBar, { agentName: "Architect", status: "streaming", model: "claude-3" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u25C9");
		unmount();
	});

	it("shows idle indicator when status is idle", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatHeaderBar, { agentName: "Architect", status: "idle", model: "claude-3" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u25CF");
		unmount();
	});
});
