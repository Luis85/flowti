import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../../mocks/mock-fs.js";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: path.default.join,
			resolve: path.default.resolve,
			dirname: path.default.dirname,
			basename: path.default.basename,
			sep: "/",
		},
	};
});

vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli-project",
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-13T00:00:00Z", safeIso: () => "2026-03-13T00-00-00Z" },
}));

vi.mock("../../../../src/domain/make/component/component-list.js", () => ({
	listProjectComponents: vi.fn(() => []),
	buildComponentTree: vi.fn(() => []),
	detectDirtyComponents: vi.fn(),
	enrichComponentRelationships: vi.fn(),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { listProjectComponents, buildComponentTree } from "../../../../src/domain/make/component/component-list.js";
import { generateComponentCatalog } from "../../../../src/domain/reports/generators/component-catalog.js";
import type { ProjectComponent } from "../../../../src/domain/make/component/component-types.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

function makeComponent(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
	return {
		name: "TestComponent",
		kind: "component",
		domain: "core",
		status: "active",
		isDirty: false,
		definitionPath: "/mock/components/test/definition.json",
		generatedDir: "/mock/components/test",
		...overrides,
	} as ProjectComponent;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateComponentCatalog", () => {
	it("returns early with warning when no components exist", () => {
		const fs = createMockFs();
		setDisk(fs);
		vi.mocked(listProjectComponents).mockReturnValue([]);

		const result = generateComponentCatalog("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.warnings).toContain("No components found in project");
		expect(result.metrics.total).toBe(0);
	});

	it("generates a catalog with components", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [
			makeComponent({ name: "Button", kind: "ui-component", domain: "ui" }),
			makeComponent({ name: "AuthService", kind: "component", domain: "auth" }),
		];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue(
			components.map((c) => ({ component: c, depth: 0 })),
		);

		const result = generateComponentCatalog("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.total).toBe(2);
		expect(result.metrics.domains).toBe(2);
	});

	it("writes markdown with frontmatter and summary table", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [makeComponent({ name: "Button", kind: "ui-component", domain: "ui" })];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue(
			components.map((c) => ({ component: c, depth: 0 })),
		);

		generateComponentCatalog("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		expect(mdFile).toBeDefined();

		const content = mdFile![1];
		expect(content).toContain("---");
		expect(content).toContain("type: ComponentCatalog");
		expect(content).toContain("# Product Component Catalog");
		expect(content).toContain("| Component |");
		expect(content).toContain("[[Button]]");
	});

	it("includes C4 architecture tree for C4 components", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [
			makeComponent({ name: "Platform", kind: "system", c4Level: 1 }),
			makeComponent({ name: "WebApp", kind: "container", c4Level: 2, containedBy: "Platform" }),
		];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue([
			{ component: components[0], depth: 0 },
			{ component: components[1], depth: 1 },
		]);

		generateComponentCatalog("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("C4 Architecture Tree");
		expect(content).toContain("[[Platform]]");
		expect(content).toContain("[[WebApp]]");
	});

	it("groups components by domain", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [
			makeComponent({ name: "Button", domain: "ui" }),
			makeComponent({ name: "Input", domain: "ui" }),
			makeComponent({ name: "AuthService", domain: "auth" }),
		];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue(
			components.map((c) => ({ component: c, depth: 0 })),
		);

		generateComponentCatalog("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("By Domain");
		expect(content).toContain("### auth");
		expect(content).toContain("### ui");
	});

	it("lists product components", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [
			makeComponent({ name: "MyProduct", kind: "system", role: "product", status: "active" }),
			makeComponent({ name: "FeatureA", kind: "component", role: "feature", containedBy: "MyProduct" }),
		];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue(
			components.map((c) => ({ component: c, depth: 0 })),
		);

		generateComponentCatalog("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("Products");
		expect(content).toContain("### MyProduct");
	});

	it("lists dirty components", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [
			makeComponent({ name: "StaleComponent", isDirty: true }),
		];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue(
			components.map((c) => ({ component: c, depth: 0 })),
		);

		generateComponentCatalog("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("Dirty Components");
		expect(content).toContain("[[StaleComponent]]");
	});

	it("reports correct metrics", () => {
		const fs = createMockFs();
		setDisk(fs);
		const components = [
			makeComponent({ name: "A", domain: "d1", role: "product" }),
			makeComponent({ name: "B", domain: "d2", isDirty: true }),
		];
		vi.mocked(listProjectComponents).mockReturnValue(components);
		vi.mocked(buildComponentTree).mockReturnValue(
			components.map((c) => ({ component: c, depth: 0 })),
		);

		const result = generateComponentCatalog("/mock/project", mockDeps);

		expect(result.metrics.total).toBe(2);
		expect(result.metrics.domains).toBe(2);
		expect(result.metrics.dirty).toBe(1);
		expect(result.metrics.products).toBe(1);
	});
});
