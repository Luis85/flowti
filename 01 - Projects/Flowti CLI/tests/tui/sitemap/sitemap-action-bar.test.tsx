vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SitemapActionBar } from "../../../src/tui/sitemap/sitemap-action-bar.js";
import type { SitemapActionDef } from "../../../src/tui/hooks/use-sitemap-actions.js";

describe("SitemapActionBar", () => {
	it("renders actions from resolved defs", () => {
		const actions: SitemapActionDef[] = [
			{ key: "1", label: "Build", disabled: false, type: "handler", target: "build:run", group: "dev" },
			{ key: "b", label: "Back", disabled: false, type: "signal", target: "back", group: "nav" },
		];
		const { lastFrame } = render(
			React.createElement(SitemapActionBar, { actions, onAction: vi.fn() }),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("Build");
		expect(lastFrame()).toContain("[b]");
		expect(lastFrame()).toContain("Back");
	});
});
