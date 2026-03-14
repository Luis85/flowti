/**
 * sitemap-to-component.test.ts — Tests for the sitemap-to-component converter.
 */

import { describe, it, expect } from "vitest";
import { sitemapToComponents, pageToComponent } from "../../../src/domain/sitemap/sitemap-to-component.js";
import type { Sitemap, PageObject } from "../../../src/infrastructure/sitemap-types.js";

function page(label: string, overrides: Partial<PageObject> = {}): PageObject {
	return { kind: "page", label, description: "", actions: [], ...overrides } as PageObject;
}

describe("pageToComponent", () => {
	it("converts a page to a component definition", () => {
		const p = page("Main Menu", {
			icon: "home",
			domain: "navigation",
			status: "active",
			description: "The entry point.",
			actions: [
				{ name: "onOpen", label: "Open Project", type: "handler", target: "project:open", key: "1" },
				{ name: "onSub", label: "Sub Page", type: "navigate", target: "sub", key: "2" },
				{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
			],
		});

		const comp = pageToComponent("start", p);

		expect(comp.id).toBe("start");
		expect(comp.kind).toBe("page");
		expect(comp.label).toBe("Main Menu");
		expect(comp.description).toBe("The entry point.");
		expect(comp.icon).toBe("home");
		expect(comp.domain).toBe("navigation");
	});

	it("extracts actions from handler, command, and signal action types", () => {
		const p = page("Test", {
			actions: [
				{ name: "onAction", label: "Do Action", type: "handler", target: "some:action", key: "1" },
				{ name: "onBuild", label: "Run Command", type: "command", target: "build", key: "2" },
				{ name: "onBack", label: "Go Back", type: "signal", target: "back", key: "3" },
				{ name: "onNav", label: "Navigate Away", type: "navigate", target: "other", key: "4" },
			],
		});

		const comp = pageToComponent("test", p);

		expect(comp.actions).toHaveLength(3);
		expect(comp.actions[0]).toEqual({ name: "some:action", description: "Do Action" });
		expect(comp.actions[1]).toEqual({ name: "build", description: "Run Command" });
		expect(comp.actions[2]).toEqual({ name: "signal:back", description: "Go Back" });
	});

	it("extracts children from navigate actions", () => {
		const p = page("Hub", {
			actions: [
				{ name: "onPageA", label: "Page A", type: "navigate", target: "page-a", key: "1" },
				{ name: "onPageB", label: "Page B", type: "navigate", target: "page-b", key: "2", disabled: "some:condition" },
				{ name: "onAction", label: "Action", type: "handler", target: "do:thing", key: "3" },
			],
		});

		const comp = pageToComponent("hub", p);

		expect(comp.children).toHaveLength(2);
		expect(comp.children![0]).toEqual({ name: "page-a", slot: "navigation", optional: false });
		expect(comp.children![1]).toEqual({ name: "page-b", slot: "navigation", optional: true });
	});

	it("converts a page with handler actions to component actions", () => {
		const p = page("Review", {
			icon: "check-circle",
			domain: "quality",
			status: "active",
			description: "Build, test, run E2E.",
			actions: [
				{ name: "onBuild", label: "Build project", type: "handler", target: "review:build", key: "1" },
				{ name: "onTest", label: "Run tests", type: "handler", target: "review:test", key: "2" },
				{ name: "onE2E", label: "Run E2E journeys", type: "handler", target: "review:e2e", key: "3" },
			],
		});

		const comp = pageToComponent("review", p);

		expect(comp.id).toBe("review");
		expect(comp.kind).toBe("page");
		expect(comp.label).toBe("Review");
		expect(comp.description).toBe("Build, test, run E2E.");
		expect(comp.icon).toBe("check-circle");
		expect(comp.domain).toBe("quality");

		expect(comp.actions).toHaveLength(3);
		expect(comp.actions[0]).toEqual({ name: "review:build", description: "Build project" });
		expect(comp.actions[1]).toEqual({ name: "review:test", description: "Run tests" });
		expect(comp.actions[2]).toEqual({ name: "review:e2e", description: "Run E2E journeys" });

		expect(comp.children).toHaveLength(0);
	});

	it("includes metadata from page", () => {
		const p = page("CAPA", {
			status: "active",
			context: ["project"],
			configPath: "management.capa",
		});

		const comp = pageToComponent("capa", p);

		expect(comp.metadata).toEqual({
			status: "active",
			context: ["project"],
			configPath: "management.capa",
		});
	});

	it("includes parent in metadata", () => {
		const p = page("Resources", { parent: "management" });

		const comp = pageToComponent("resources", p);
		expect(comp.metadata.parent).toBe("management");
	});

	it("includes route config in metadata", () => {
		const p = page("Home", {
			route: { path: "/", pathMatch: "full" },
		});

		const comp = pageToComponent("home", p);
		expect(comp.metadata.route).toEqual({ path: "/", pathMatch: "full" });
	});

	it("includes route with guards and lazy loading in metadata", () => {
		const p = page("Admin", {
			route: { path: "admin", guards: ["auth", "admin"], lazy: true },
		});

		const comp = pageToComponent("admin", p);
		expect(comp.metadata.route).toEqual({
			path: "admin",
			guards: ["auth", "admin"],
			lazy: true,
		});
	});

	it("handles page with no optional fields", () => {
		const p = page("Minimal");

		const comp = pageToComponent("minimal", p);

		expect(comp.id).toBe("minimal");
		expect(comp.description).toBe("");
		expect(comp.icon).toBeUndefined();
		expect(comp.domain).toBeUndefined();
		expect(comp.actions).toHaveLength(0);
		expect(comp.metadata).toEqual({});
	});

	it("only extracts handler/command/signal as actions, navigate as children", () => {
		const p = page("With Mix", {
			actions: [
				{ name: "onAction", label: "Action", type: "handler", target: "do:it", key: "1" },
				{ name: "onNav", label: "Page", type: "navigate", target: "target", key: "2" },
			],
		});

		const comp = pageToComponent("mix-test", p);

		expect(comp.actions).toHaveLength(1);
		expect(comp.children).toHaveLength(1);
	});
});

describe("sitemapToComponents", () => {
	it("converts all pages in a sitemap", () => {
		const sitemap: Sitemap = {
			version: 2,
			pages: {
				start: page("Start", {
					icon: "home",
					actions: [
						{ name: "onQuit", label: "Quit", type: "signal", target: "quit", key: "q" },
					],
				}),
				detail: page("Detail", {
					icon: "file",
					actions: [
						{ name: "onView", label: "View details", type: "handler", target: "detail:view", key: "1" },
					],
				}),
			},
		};

		const components = sitemapToComponents(sitemap);

		expect(components).toHaveLength(2);
		expect(components[0].id).toBe("start");
		expect(components[1].id).toBe("detail");
	});

	it("resolves parent to child relationships", () => {
		const sitemap: Sitemap = {
			version: 2,
			pages: {
				management: page("Management"),
				resources: page("Resources", { parent: "management" }),
				timelog: page("Time-Log", { parent: "management" }),
			},
		};

		const components = sitemapToComponents(sitemap);
		const mgmt = components.find((c) => c.id === "management")!;

		expect(mgmt.children).toHaveLength(2);
		expect(mgmt.children[0]).toEqual({ name: "resources", slot: "navigation", optional: false });
		expect(mgmt.children[1]).toEqual({ name: "timelog", slot: "navigation", optional: false });
	});

	it("does not override navigate-derived children with parent-derived ones", () => {
		const sitemap: Sitemap = {
			version: 2,
			pages: {
				hub: page("Hub", {
					actions: [
						{ name: "onGo", label: "Go", type: "navigate", target: "child-a", key: "1" },
					],
				}),
				"child-a": page("Child A", { parent: "hub" }),
				"child-b": page("Child B", { parent: "hub" }),
			},
		};

		const components = sitemapToComponents(sitemap);
		const hub = components.find((c) => c.id === "hub")!;

		// hub already has navigate-derived children, so parent-derived ones are NOT added
		expect(hub.children).toHaveLength(1);
		expect(hub.children[0].name).toBe("child-a");
	});
});
