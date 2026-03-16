import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ActivityBar } from "../../../src/tui/shell/activity-bar.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ActivityBar", () => {
	const sections = buildSections();

	it("renders all section icons", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: false, cursorSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u{1F3E0}");
		expect(frame).toContain("\u{1F464}");
		expect(frame).toContain("\u{1F4CA}");
		unmount();
	});

	it("always shows labels for all sections", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: false, cursorSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		expect(frame).toContain("Agents");
		expect(frame).toContain("Project");
		expect(frame).toContain("Reports");
		expect(frame).toContain("Manage");
		expect(frame).toContain("Help");
		unmount();
	});

	it("shows cursor indicator when focused", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: true, cursorSection: "agents", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u25B8");
		unmount();
	});

	it("does not show cursor when not focused", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: false, cursorSection: "agents", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).not.toContain("\u25B8");
		unmount();
	});
});
