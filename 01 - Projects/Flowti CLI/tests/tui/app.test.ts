import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/app.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("App", () => {
	it("renders activity bar with section icons", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u{1F3E0}");
		unmount();
	});

	it("renders header bar with breadcrumbs", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		unmount();
	});

	it("renders status bar with key hints", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Navigate");
		expect(frame).toContain("Esc");
		unmount();
	});

	it("renders content area with start page placeholder", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("start");
		unmount();
	});
});
