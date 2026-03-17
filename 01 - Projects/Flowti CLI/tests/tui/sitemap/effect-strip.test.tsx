import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { EffectStrip } from "../../../src/tui/sitemap/effect-strip.js";

describe("EffectStrip", () => {
	it("renders nothing when idle", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "idle", message: "" }));
		expect(lastFrame()).toBe("");
	});

	it("renders spinner and message when running", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "running", message: "Building..." }));
		expect(lastFrame()).toContain("Building...");
	});

	it("renders success message in green", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "success", message: "Done" }));
		expect(lastFrame()).toContain("Done");
	});

	it("renders error message in red", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "error", message: "Failed" }));
		expect(lastFrame()).toContain("Failed");
	});
});
