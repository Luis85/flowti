import { describe, it, expect, vi } from "vitest";
import {
	scaffoldStorybookFromSitemap,
	SCAFFOLD_FRAMEWORKS,
} from "../../../src/domain/make/storybook-scaffold.js";
import type { ScaffoldDeps } from "../../../src/domain/make/storybook-scaffold.js";

// ── Helpers ──────────────────────────────────────────────────────────

function createMockDeps(fileContent: string): ScaffoldDeps {
	return {
		disk: {
			readFileSync: vi.fn(() => fileContent) as unknown as ScaffoldDeps["disk"]["readFileSync"],
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => false),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []) as unknown as ScaffoldDeps["disk"]["readdirSync"],
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
			unlinkSync: vi.fn(),
			statSync: vi.fn() as unknown as ScaffoldDeps["disk"]["statSync"],
		},
		paths: {
			join: (...args: string[]) => args.join("/"),
			resolve: (...args: string[]) => args.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string, ext?: string) => {
				const base = p.split("/").pop() ?? p;
				if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
				return base;
			},
			relative: (from: string, to: string) => to.replace(from, ""),
			extname: (p: string) => {
				const dot = p.lastIndexOf(".");
				return dot >= 0 ? p.slice(dot) : "";
			},
			isAbsolute: (p: string) => p.startsWith("/"),
			sep: "/",
		},
	};
}

const threePagesCliSitemap = JSON.stringify({
	version: 2,
	pages: {
		"home": { kind: "page", label: "Home Page" },
		"settings": { kind: "page", label: "Settings" },
		"about-us": { kind: "page", label: "About Us" },
	},
});

const threeViewsPluginSitemap = JSON.stringify({
	views: {
		"dashboard": { label: "Dashboard View" },
		"profile": { label: "Profile View" },
		"analytics": { label: "Analytics View" },
	},
});

const emptySitemap = JSON.stringify({ version: 2 });

// ── Tests ────────────────────────────────────────────────────────────

describe("scaffoldStorybookFromSitemap", () => {
	describe("CLI sitemap format (pages)", () => {
		it("generates stories + stubs + config + package.json for 3 pages", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "react", deps);

			expect(result.pageCount).toBe(3);
			expect(result.framework).toBe("react");
			// 3 stories + 3 stubs + 1 config + 1 package.json = 8 files
			expect(result.files).toHaveLength(8);

			const paths = result.files.map(f => f.path);
			expect(paths).toContain(".storybook/main.ts");
			expect(paths).toContain("package.json");
			expect(paths).toContain("src/home/home.stories.ts");
			expect(paths).toContain("src/home/home.tsx");
			expect(paths).toContain("src/settings/settings.stories.ts");
			expect(paths).toContain("src/settings/settings.tsx");
			expect(paths).toContain("src/about-us/about-us.stories.ts");
			expect(paths).toContain("src/about-us/about-us.tsx");
		});

		it("includes page labels as PascalCase names in story content", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "react", deps);

			const homeStory = result.files.find(f => f.path === "src/home/home.stories.ts");
			expect(homeStory).toBeDefined();
			expect(homeStory!.content).toContain("HomePage");
			expect(homeStory!.content).toContain("Pages/HomePage");
		});
	});

	describe("Plugin sitemap format (views)", () => {
		it("generates stories + stubs + config + package.json for 3 views", () => {
			const deps = createMockDeps(threeViewsPluginSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/views.json", "react", deps);

			expect(result.pageCount).toBe(3);
			expect(result.framework).toBe("react");
			expect(result.files).toHaveLength(8);

			const paths = result.files.map(f => f.path);
			expect(paths).toContain("src/dashboard/dashboard.stories.ts");
			expect(paths).toContain("src/dashboard/dashboard.tsx");
			expect(paths).toContain("src/profile/profile.stories.ts");
			expect(paths).toContain("src/profile/profile.tsx");
			expect(paths).toContain("src/analytics/analytics.stories.ts");
			expect(paths).toContain("src/analytics/analytics.tsx");
		});
	});

	describe("empty or invalid sitemap", () => {
		it("returns empty files when sitemap has no pages or views", () => {
			const deps = createMockDeps(emptySitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/empty.json", "react", deps);

			expect(result.pageCount).toBe(0);
			expect(result.files).toHaveLength(0);
		});

		it("returns empty files for unknown framework", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "unknown-fw", deps);

			expect(result.pageCount).toBe(0);
			expect(result.files).toHaveLength(0);
		});
	});

	describe("framework templates", () => {
		it("generates valid React output", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "react", deps);

			const config = result.files.find(f => f.path === ".storybook/main.ts");
			expect(config!.content).toContain("@storybook/react-vite");

			const pkg = result.files.find(f => f.path === "package.json");
			const parsed = JSON.parse(pkg!.content);
			expect(parsed.devDependencies).toHaveProperty("react");
			expect(parsed.devDependencies).toHaveProperty("@storybook/react-vite");

			const story = result.files.find(f => f.path.endsWith(".stories.ts"));
			expect(story!.content).toContain("@storybook/react");

			const stub = result.files.find(f => f.path.endsWith(".tsx"));
			expect(stub!.content).toContain("React.JSX.Element");
		});

		it("generates valid Vue output", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "vue", deps);

			const config = result.files.find(f => f.path === ".storybook/main.ts");
			expect(config!.content).toContain("@storybook/vue3-vite");

			const stub = result.files.find(f => f.path.endsWith(".vue"));
			expect(stub).toBeDefined();
			expect(stub!.content).toContain("<template>");
			expect(stub!.content).toContain("<script setup lang=\"ts\">");

			const story = result.files.find(f => f.path.endsWith(".stories.ts"));
			expect(story!.content).toContain("@storybook/vue3");
			expect(story!.content).toContain(".vue");
		});

		it("generates valid Angular output", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "angular", deps);

			const config = result.files.find(f => f.path === ".storybook/main.ts");
			expect(config!.content).toContain("@storybook/angular");

			const stub = result.files.find(f => f.path.endsWith(".component.ts"));
			expect(stub).toBeDefined();
			expect(stub!.content).toContain("@Component");
			expect(stub!.content).toContain("@angular/core");

			const story = result.files.find(f => f.path.endsWith(".stories.ts"));
			expect(story!.content).toContain("@storybook/angular");
			expect(story!.content).toContain("Component");
		});

		it("generates valid Lit output", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "lit", deps);

			const config = result.files.find(f => f.path === ".storybook/main.ts");
			expect(config!.content).toContain("@storybook/web-components-vite");

			const stub = result.files.find(f => f.path.endsWith(".tsx"));
			expect(stub).toBeDefined();
			expect(stub!.content).toContain("LitElement");
			expect(stub!.content).toContain("@customElement");

			const story = result.files.find(f => f.path.endsWith(".stories.ts"));
			expect(story!.content).toContain("@storybook/web-components");
			expect(story!.content).toContain("html");
		});

		it("generates valid CLI App output", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", "cli-app", deps);

			const config = result.files.find(f => f.path === ".storybook/main.ts");
			expect(config!.content).toContain("@storybook/react-vite");

			const stub = result.files.find(f => f.path.endsWith(".tsx"));
			expect(stub).toBeDefined();
			expect(stub!.content).toContain("monospace");
			expect(stub!.content).toContain("React.JSX.Element");

			const story = result.files.find(f => f.path.endsWith(".stories.ts"));
			expect(story!.content).toContain("CLI Pages/");
		});
	});

	describe("all frameworks produce valid output", () => {
		for (const fw of SCAFFOLD_FRAMEWORKS) {
			it(`${fw}: generates config + package.json + per-page files`, () => {
				const deps = createMockDeps(threePagesCliSitemap);
				const result = scaffoldStorybookFromSitemap("/path/to/sitemap.json", fw, deps);

				expect(result.framework).toBe(fw);
				expect(result.pageCount).toBe(3);
				expect(result.files.length).toBeGreaterThanOrEqual(8);

				const config = result.files.find(f => f.path === ".storybook/main.ts");
				expect(config).toBeDefined();
				expect(config!.content).toContain("StorybookConfig");

				const pkg = result.files.find(f => f.path === "package.json");
				expect(pkg).toBeDefined();
				const parsed = JSON.parse(pkg!.content);
				expect(parsed.scripts).toHaveProperty("storybook");
				expect(parsed.scripts).toHaveProperty("build-storybook");
				expect(Object.keys(parsed.devDependencies).length).toBeGreaterThan(0);
			});
		}
	});

	describe("package.json naming", () => {
		it("derives project name from sitemap filename", () => {
			const deps = createMockDeps(threePagesCliSitemap);
			const result = scaffoldStorybookFromSitemap("/project/configs/sitemap.json", "react", deps);

			const pkg = result.files.find(f => f.path === "package.json");
			const parsed = JSON.parse(pkg!.content);
			expect(parsed.name).toBe("sitemap-storybook");
		});
	});
});
