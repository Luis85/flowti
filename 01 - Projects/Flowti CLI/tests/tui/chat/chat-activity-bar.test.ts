import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ChatActivityBar } from "../../../src/tui/chat/chat-activity-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ChatActivityBar", () => {
	it("renders all panel labels", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatActivityBar, { activePanel: "chat", focused: false, onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Chat");
		expect(frame).toContain("Tasks");
		expect(frame).toContain("Files");
		unmount();
	});

	it("shows cursor when focused", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatActivityBar, { activePanel: "chat", focused: true, onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u25B8");
		unmount();
	});

	it("does not show cursor when not focused", () => {
		const { unmount, ...instance } = render(
			React.createElement(ChatActivityBar, { activePanel: "chat", focused: false, onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).not.toContain("\u25B8");
		unmount();
	});
});
