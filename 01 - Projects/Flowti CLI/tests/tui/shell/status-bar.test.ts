import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { StatusBar } from "../../../src/tui/shell/status-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("StatusBar", () => {
	it("renders key hints", () => {
		const { unmount, ...instance } = render(
			React.createElement(StatusBar, {
				hints: [
					{ key: "\u2191\u2193", label: "Navigate" },
					{ key: "Enter", label: "Select" },
					{ key: "Esc", label: "Back" },
				],
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Navigate");
		expect(frame).toContain("Enter");
		expect(frame).toContain("Esc");
		unmount();
	});

	it("renders agent status when provided", () => {
		const { unmount, ...instance } = render(
			React.createElement(StatusBar, {
				hints: [],
				agentStatus: "Bob: busy",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Bob: busy");
		unmount();
	});
});
