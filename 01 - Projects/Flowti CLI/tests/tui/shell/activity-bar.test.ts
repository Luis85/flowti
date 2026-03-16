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
			React.createElement(ActivityBar, { sections, activeSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u{1F3E0}");
		expect(frame).toContain("\u{1F464}");
		expect(frame).toContain("\u{1F4CA}");
		unmount();
	});

	it("highlights the active section", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "agents", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u{1F464}");
		unmount();
	});

	it("renders section labels", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		unmount();
	});
});
