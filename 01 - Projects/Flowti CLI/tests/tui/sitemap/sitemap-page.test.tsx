vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

vi.mock("../../../src/tui/context.js", () => ({
	useTuiContext: () => ({
		deps: {
			disk: {},
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: {},
			log: () => {},
		},
		vaultRoot: "/vault",
		projectPath: "/vault/project",
		projectsDir: "/vault/projects",
		agentsConfig: undefined,
		iterationsConfig: undefined,
		projectConfig: undefined,
		processRunner: {},
	}),
	useLoaderContext: () => ({
		deps: {
			disk: {},
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: {},
			log: () => {},
		},
		vaultRoot: "/vault",
		projectPath: "/vault/project",
		projectsDir: "/vault/projects",
		params: {},
	}),
}));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SitemapPage } from "../../../src/tui/sitemap/sitemap-page.js";
import { NavigationProvider } from "../../../src/tui/sitemap/navigation-context.js";
import type { PageObject } from "../../../src/domain/sitemap/unified-page.js";

describe("SitemapPage", () => {
	it("renders page label", () => {
		const page: PageObject = {
			kind: "page",
			label: "Test Page",
			description: "A test",
			actions: [],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "test", params: {} }),
			),
		);
		expect(lastFrame()).toContain("Test Page");
	});

	it("renders page kind and pageId in content zone", () => {
		const page: PageObject = {
			kind: "list",
			label: "Items",
			description: "Item list",
			actions: [],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "items", params: {} }),
			),
		);
		expect(lastFrame()).toContain("[list]");
		expect(lastFrame()).toContain("items");
	});

	it("renders page description", () => {
		const page: PageObject = {
			kind: "page",
			label: "Health",
			description: "Project health overview",
			actions: [],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "health", params: {} }),
			),
		);
		expect(lastFrame()).toContain("Project health overview");
	});

	it("renders actions from page definition", () => {
		const page: PageObject = {
			kind: "page",
			label: "Dashboard",
			description: "Main view",
			actions: [
				{ name: "onBack", label: "Back", type: "signal", target: "back", key: "b" },
			],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "dashboard", params: {} }),
			),
		);
		expect(lastFrame()).toContain("[b]");
		expect(lastFrame()).toContain("Back");
	});
});
