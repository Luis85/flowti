import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { InputArea } from "../../../src/tui/chat/input-area.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("InputArea", () => {
	it("renders with placeholder when value is empty", () => {
		const { unmount, ...instance } = render(
			React.createElement(InputArea, {
				value: "",
				onChange: () => {},
				onSubmit: () => {},
				enabled: true,
				placeholder: "Type a message...",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Type a message...");
		unmount();
	});

	it("renders with value when provided", () => {
		const { unmount, ...instance } = render(
			React.createElement(InputArea, {
				value: "Hello agent",
				onChange: () => {},
				onSubmit: () => {},
				enabled: true,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Hello agent");
		unmount();
	});

	it("shows Enter to send hint", () => {
		const { unmount, ...instance } = render(
			React.createElement(InputArea, {
				value: "",
				onChange: () => {},
				onSubmit: () => {},
				enabled: true,
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Enter to send");
		unmount();
	});
});
