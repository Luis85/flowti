import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { HeaderBar } from "../../../src/tui/shell/header-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("HeaderBar", () => {
	it("renders breadcrumb path", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, { breadcrumbs: ["Home", "Agents", "Bob"], projectName: "Flowti CLI" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		expect(frame).toContain("Agents");
		expect(frame).toContain("Bob");
		unmount();
	});

	it("renders project name", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, { breadcrumbs: ["Home"], projectName: "Flowti CLI" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Flowti CLI");
		unmount();
	});

	it("uses separator between breadcrumbs", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, { breadcrumbs: ["Home", "Agents"], projectName: "Test" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain(">");
		unmount();
	});
});
