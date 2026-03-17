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

vi.mock("../../../src/tui/sitemap/loader-map.js", () => ({
	getLoaderForPage: (pageId: string) => {
		if (pageId === "test-dashboard") {
			return () => ({ projectCount: 3, agents: [{ name: "Claude", status: "active" }] });
		}
		if (pageId === "test-list") {
			return () => ({ items: ["Alpha", "Beta", "Gamma"] });
		}
		return undefined;
	},
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
				React.createElement(SitemapPage, { page, pageId: "unknown-page", params: {} }),
			),
		);
		expect(lastFrame()).toContain("Test Page");
	});

	it("shows no loader message for unknown page", () => {
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
		expect(lastFrame()).toContain("No loader for page: items");
	});

	it("renders dashboard content for page kind with loader data", () => {
		const page: PageObject = {
			kind: "page",
			label: "Dashboard",
			description: "Main view",
			actions: [],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "test-dashboard", params: {} }),
			),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Dashboard");
		expect(frame).toContain("Project Count");
		expect(frame).toContain("3");
	});

	it("renders list content for list kind with loader data", () => {
		const page: PageObject = {
			kind: "list",
			label: "Test List",
			description: "A list",
			actions: [],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "test-list", params: {} }),
			),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Test List");
		expect(frame).toContain("Alpha");
		expect(frame).toContain("Beta");
		expect(frame).toContain("Gamma");
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
				React.createElement(SitemapPage, { page, pageId: "unknown-page", params: {} }),
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
				React.createElement(SitemapPage, { page, pageId: "test-dashboard", params: {} }),
			),
		);
		expect(lastFrame()).toContain("[b]");
		expect(lastFrame()).toContain("Back");
	});

	it("renders form content for form kind with fields", () => {
		const page: PageObject = {
			kind: "form",
			label: "New Project",
			description: "Create a project",
			actions: [],
			fields: [
				{ name: "projectName", label: "Project Name", type: "text" },
				{ name: "template", label: "Template", type: "select", options: [{ value: "basic", label: "Basic" }] },
			],
		};
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(),
				goBack: vi.fn(),
				refresh: vi.fn(),
			},
				React.createElement(SitemapPage, { page, pageId: "unknown-form", params: {} }),
			),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("New Project");
		expect(frame).toContain("Project Name");
		expect(frame).toContain("Template");
	});
});
