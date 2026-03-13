/**
 * sitemap-to-component.test.ts — Tests for the sitemap-to-component converter.
 */

import { describe, it, expect } from "vitest";
import { sitemapToComponents, viewToComponent } from "../../../src/domain/sitemap/sitemap-to-component.js";
import type { Sitemap, StaticView, DynamicView } from "../../../src/infrastructure/sitemap-types.js";

describe("viewToComponent", () => {
	it("converts a static view to a component definition", () => {
		const view: StaticView = {
			title: "Main Menu",
			icon: "home",
			domain: "navigation",
			status: "active",
			description: "The entry point.",
			items: [
				{ key: "1", label: "Open Project", handler: "project:open" },
				{ key: "2", label: "Sub Page", navigate: "sub" },
				{ separator: true },
				{ key: "q", label: "Quit", signal: "quit" },
			],
		};

		const comp = viewToComponent("start", view);

		expect(comp.id).toBe("start");
		expect(comp.kind).toBe("page");
		expect(comp.label).toBe("Main Menu");
		expect(comp.description).toBe("The entry point.");
		expect(comp.icon).toBe("home");
		expect(comp.domain).toBe("navigation");
	});

	it("extracts actions from static view handler/command/signal items", () => {
		const view: StaticView = {
			title: "Test",
			items: [
				{ key: "1", label: "Do Action", handler: "some:action" },
				{ key: "2", label: "Run Command", command: "build" },
				{ key: "3", label: "Go Back", signal: "back" },
				{ key: "4", label: "Navigate Away", navigate: "other" },
			],
		};

		const comp = viewToComponent("test", view);

		expect(comp.actions).toHaveLength(3);
		expect(comp.actions[0]).toEqual({ name: "some:action", description: "Do Action" });
		expect(comp.actions[1]).toEqual({ name: "build", description: "Run Command" });
		expect(comp.actions[2]).toEqual({ name: "signal:back", description: "Go Back" });
	});

	it("extracts children from static view navigate items", () => {
		const view: StaticView = {
			title: "Hub",
			items: [
				{ key: "1", label: "Page A", navigate: "page-a" },
				{ key: "2", label: "Page B", navigate: "page-b", disabled: "some:condition" },
				{ key: "3", label: "Action", handler: "do:thing" },
			],
		};

		const comp = viewToComponent("hub", view);

		expect(comp.children).toHaveLength(2);
		expect(comp.children![0]).toEqual({ name: "page-a", slot: "navigation", optional: false });
		expect(comp.children![1]).toEqual({ name: "page-b", slot: "navigation", optional: true });
	});

	it("converts a dynamic view to a component definition with capabilities as actions", () => {
		const view: DynamicView = {
			type: "dynamic",
			title: "Review",
			icon: "check-circle",
			domain: "quality",
			status: "active",
			handler: "review",
			description: "Build, test, run E2E.",
			capabilities: ["Build project", "Run tests", "Run E2E journeys"],
			configPath: "review",
		};

		const comp = viewToComponent("review", view);

		expect(comp.id).toBe("review");
		expect(comp.kind).toBe("page");
		expect(comp.label).toBe("Review");
		expect(comp.description).toBe("Build, test, run E2E.");
		expect(comp.icon).toBe("check-circle");
		expect(comp.domain).toBe("quality");

		expect(comp.actions).toHaveLength(3);
		expect(comp.actions[0]).toEqual({ name: "build-project", description: "Build project" });
		expect(comp.actions[1]).toEqual({ name: "run-tests", description: "Run tests" });
		expect(comp.actions[2]).toEqual({ name: "run-e2e-journeys", description: "Run E2E journeys" });

		expect(comp.children).toHaveLength(0);
	});

	it("includes metadata from dynamic view", () => {
		const view: DynamicView = {
			type: "dynamic",
			title: "CAPA",
			status: "active",
			context: ["project"],
			handler: "capa",
			configPath: "management.capa",
		};

		const comp = viewToComponent("capa", view);

		expect(comp.metadata).toEqual({
			status: "active",
			context: ["project"],
			handler: "capa",
			configPath: "management.capa",
		});
	});

	it("includes parent in metadata", () => {
		const view: DynamicView = {
			type: "dynamic",
			title: "Resources",
			handler: "resources",
			parent: "management",
		};

		const comp = viewToComponent("resources", view);
		expect(comp.metadata.parent).toBe("management");
	});

	it("includes route config in metadata", () => {
		const view: StaticView = {
			title: "Home",
			route: { path: "/", pathMatch: "full" },
			items: [],
		};

		const comp = viewToComponent("home", view);
		expect(comp.metadata.route).toEqual({ path: "/", pathMatch: "full" });
	});

	it("includes route with guards and lazy loading in metadata", () => {
		const view: DynamicView = {
			type: "dynamic",
			title: "Admin",
			handler: "admin",
			route: { path: "admin", guards: ["auth", "admin"], lazy: true },
		};

		const comp = viewToComponent("admin", view);
		expect(comp.metadata.route).toEqual({
			path: "admin",
			guards: ["auth", "admin"],
			lazy: true,
		});
	});

	it("handles view with no optional fields", () => {
		const view: DynamicView = {
			type: "dynamic",
			title: "Minimal",
			handler: "minimal",
		};

		const comp = viewToComponent("minimal", view);

		expect(comp.id).toBe("minimal");
		expect(comp.description).toBe("");
		expect(comp.icon).toBeUndefined();
		expect(comp.domain).toBeUndefined();
		expect(comp.actions).toHaveLength(0);
		expect(comp.metadata).toEqual({ handler: "minimal" });
	});

	it("skips separators when extracting actions and children", () => {
		const view: StaticView = {
			title: "With Separators",
			items: [
				{ key: "1", label: "Action", handler: "do:it" },
				{ separator: true },
				{ key: "2", label: "Page", navigate: "target" },
				{ separator: true },
			],
		};

		const comp = viewToComponent("sep-test", view);

		expect(comp.actions).toHaveLength(1);
		expect(comp.children).toHaveLength(1);
	});
});

describe("sitemapToComponents", () => {
	it("converts all views in a sitemap", () => {
		const sitemap: Sitemap = {
			version: 1,
			views: {
				start: {
					title: "Start",
					icon: "home",
					items: [{ key: "q", label: "Quit", signal: "quit" }],
				},
				detail: {
					type: "dynamic",
					title: "Detail",
					icon: "file",
					handler: "detail",
					capabilities: ["View details"],
				},
			},
		};

		const components = sitemapToComponents(sitemap);

		expect(components).toHaveLength(2);
		expect(components[0].id).toBe("start");
		expect(components[1].id).toBe("detail");
	});

	it("resolves parent→child relationships for dynamic views", () => {
		const sitemap: Sitemap = {
			version: 1,
			views: {
				management: {
					type: "dynamic",
					title: "Management",
					handler: "management",
				},
				resources: {
					type: "dynamic",
					title: "Resources",
					handler: "resources",
					parent: "management",
				},
				timelog: {
					type: "dynamic",
					title: "Time-Log",
					handler: "timelog",
					parent: "management",
				},
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
			version: 1,
			views: {
				hub: {
					title: "Hub",
					items: [
						{ key: "1", label: "Go", navigate: "child-a" },
					],
				},
				"child-a": {
					type: "dynamic",
					title: "Child A",
					handler: "a",
					parent: "hub",
				},
				"child-b": {
					type: "dynamic",
					title: "Child B",
					handler: "b",
					parent: "hub",
				},
			},
		};

		const components = sitemapToComponents(sitemap);
		const hub = components.find((c) => c.id === "hub")!;

		// hub already has navigate-derived children, so parent-derived ones are NOT added
		expect(hub.children).toHaveLength(1);
		expect(hub.children[0].name).toBe("child-a");
	});
});
