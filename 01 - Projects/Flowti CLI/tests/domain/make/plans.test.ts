import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	config: {},
}));

import {
	buildHubPlan,
	buildPluginPlan,
	buildAppPlan,
	buildCliAppPlan,
	buildJourneyPlan,
	computeNextCssNumber,
} from "../../../src/domain/make/plans.js";
import type { MakePaths } from "../../../src/domain/make/naming.js";

const STUB_PATHS: MakePaths = {
	ui: "src/ui",
	domain: "src/domain",
	hubDomain: "src/domain/hub",
	tests: "tests",
	css: "css",
	docs: "docs",
	journeys: "tests/e2e/journeys",
};

// ── computeNextCssNumber ────────────────────────────────────────────

describe("computeNextCssNumber", () => {
	it("returns 01 for empty list", () => {
		expect(computeNextCssNumber([])).toBe("01");
	});

	it("returns next number after existing files", () => {
		expect(computeNextCssNumber(["00-base.css", "01-layout.css", "05-hub.css"])).toBe("06");
	});

	it("ignores non-numeric prefixes", () => {
		expect(computeNextCssNumber(["base.css", "layout.css"])).toBe("01");
	});

	it("pads to two digits", () => {
		expect(computeNextCssNumber(["08-foo.css"])).toBe("09");
	});
});

// ── buildHubPlan ────────────────────────────────────────────────────

describe("buildHubPlan", () => {
	const files = buildHubPlan({
		pascal: "Inventory",
		kebab: "inventory",
		hubType: "domain",
		icon: "box",
		tabs: ["overview", "items"],
		paths: STUB_PATHS,
		cssNum: "10",
	});

	it("returns 9 files", () => {
		expect(files).toHaveLength(9);
	});

	it("includes the hub view file", () => {
		expect(files.some((f) => f.path === "src/ui/inventory/InventoryHubView.ts")).toBe(true);
	});

	it("includes the CSS file with correct number", () => {
		expect(files.some((f) => f.path === "css/10-inventory.css")).toBe(true);
	});

	it("includes the journey file", () => {
		expect(files.some((f) => f.path === "tests/e2e/journeys/inventory.journey.json")).toBe(true);
	});

	it("all files have non-empty content", () => {
		for (const f of files) {
			expect(f.content).toBeDefined();
		}
	});
});

// ── buildPluginPlan ─────────────────────────────────────────────────

describe("buildPluginPlan", () => {
	const files = buildPluginPlan({ name: "My Plugin", pluginId: "my-plugin", author: "Alice" });

	it("returns 11 files", () => {
		expect(files).toHaveLength(11);
	});

	it("includes manifest.json", () => {
		const manifest = files.find((f) => f.path === "manifest.json");
		expect(manifest).toBeDefined();
		expect(JSON.parse(manifest!.content).id).toBe("my-plugin");
	});

	it("includes package.json", () => {
		const pkg = files.find((f) => f.path === "package.json");
		expect(pkg).toBeDefined();
		expect(JSON.parse(pkg!.content).name).toBe("my-plugin");
	});

	it("includes main.ts", () => {
		expect(files.some((f) => f.path === "src/main.ts")).toBe(true);
	});
});

// ── buildAppPlan ────────────────────────────────────────────────────

describe("buildAppPlan", () => {
	const files = buildAppPlan({ name: "My App", appId: "my-app", author: "Bob", pascal: "MyApp" });

	it("returns 17 files", () => {
		expect(files).toHaveLength(17);
	});

	it("includes EventBus", () => {
		expect(files.some((f) => f.path === "src/infrastructure/events/EventBus.ts")).toBe(true);
	});

	it("includes obsidian stub", () => {
		expect(files.some((f) => f.path === "tests/mocks/obsidian-stub.ts")).toBe(true);
	});

	it("includes EventBus test", () => {
		expect(files.some((f) => f.path === "tests/infrastructure/EventBus.test.ts")).toBe(true);
	});
});

// ── buildCliAppPlan ─────────────────────────────────────────────────

describe("buildCliAppPlan", () => {
	const files = buildCliAppPlan({ name: "My CLI", appId: "my-cli" });

	it("returns 6 files", () => {
		expect(files).toHaveLength(6);
	});

	it("includes main.ts", () => {
		expect(files.some((f) => f.path === "src/main.ts")).toBe(true);
	});

	it("includes test file", () => {
		expect(files.some((f) => f.path === "tests/main.test.ts")).toBe(true);
	});
});

// ── buildJourneyPlan ────────────────────────────────────────────────

describe("buildJourneyPlan", () => {
	const files = buildJourneyPlan({
		name: "Getting Started",
		slug: "getting-started",
		description: "Onboarding journey",
		journeysDir: "tests/e2e/journeys",
		testDir: "tests/e2e",
		testFileNumber: "30",
		docsDir: "docs/journeys/Getting Started",
	});

	it("returns 3 files", () => {
		expect(files).toHaveLength(3);
	});

	it("includes journey definition", () => {
		expect(files.some((f) => f.path === "tests/e2e/journeys/getting-started.journey")).toBe(true);
	});

	it("includes test entry", () => {
		expect(files.some((f) => f.path === "tests/e2e/30-journey-getting-started.test.ts")).toBe(true);
	});

	it("includes canvas", () => {
		expect(files.some((f) => f.path.endsWith(".canvas"))).toBe(true);
	});
});
