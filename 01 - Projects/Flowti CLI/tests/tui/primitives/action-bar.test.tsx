import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ActionBar } from "../../../src/tui/primitives/action-bar.js";

describe("ActionBar", () => {
	it("renders actions with key and label", () => {
		const { lastFrame } = render(
			React.createElement(ActionBar, {
				actions: [{ key: "1", label: "Build" }],
			}),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("Build");
	});

	it("renders disabled actions dimmed", () => {
		const { lastFrame } = render(
			React.createElement(ActionBar, {
				actions: [
					{ key: "1", label: "Build", disabled: true },
					{ key: "2", label: "Test" },
				],
			}),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("[2]");
	});

	it("renders group separators between different groups", () => {
		const { lastFrame } = render(
			React.createElement(ActionBar, {
				actions: [
					{ key: "1", label: "Build", group: "dev" },
					{ key: "2", label: "Test", group: "dev" },
					{ key: "3", label: "Back", group: "nav" },
				],
			}),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("[3]");
	});
});
