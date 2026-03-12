import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";
import type { IPaths } from "../../../src/infrastructure/types.js";

// Mock config module to control PROJECTS_DIR
vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/projects",
}));

import {
	resolveProjectPath,
	readPackageJson,
	readProjectConfig,
	initializeProject,
	getReportsDir,
} from "../../../src/domain/project/project-config.js";

const mockPaths: IPaths = {
	join: (...args: string[]) => path.join(...args),
	resolve: (...args: string[]) => path.join(...args),
	dirname: (p: string) => path.dirname(p),
	basename: (p: string, ext?: string) => path.basename(p, ext),
	relative: (from: string, to: string) => path.relative(from, to),
	extname: (p: string) => path.extname(p),
	isAbsolute: (p: string) => path.isAbsolute(p),
	sep: path.sep,
};

function makeDeps(files?: Record<string, string>) {
	return { disk: createMockFs(files), paths: mockPaths };
}

function n(...parts: string[]): string {
	return path.join(...parts);
}

describe("resolveProjectPath", () => {
	it("resolves to projects dir", () => {
		expect(resolveProjectPath("my-app", { paths: mockPaths })).toBe(n("/mock/projects", "my-app"));
	});
});

describe("readPackageJson", () => {
	it("returns parsed package.json when it exists", () => {
		const deps = makeDeps({
			"/project/package.json": JSON.stringify({ name: "test-pkg", version: "1.0.0" }),
		});
		const result = readPackageJson("/project", deps);
		expect(result).toEqual({ name: "test-pkg", version: "1.0.0" });
	});

	it("returns null when package.json does not exist", () => {
		expect(readPackageJson("/project", makeDeps())).toBeNull();
	});

	it("returns null for corrupt JSON", () => {
		const deps = makeDeps({ "/project/package.json": "not json {{{" });
		expect(readPackageJson("/project", deps)).toBeNull();
	});
});

describe("readProjectConfig", () => {
	it("returns parsed config when it exists", () => {
		const config = { name: "my-project", build: { commands: { fast: "npm run build" } } };
		const deps = makeDeps({
			"/project/configs/flowti.config.json": JSON.stringify(config),
		});
		const result = readProjectConfig("/project", deps);
		expect(result.config).toEqual(config);
		expect(result.warnings).toEqual([]);
	});

	it("returns null config when file does not exist", () => {
		const result = readProjectConfig("/project", makeDeps());
		expect(result.config).toBeNull();
	});

	it("returns null config for corrupt JSON", () => {
		const deps = makeDeps({
			"/project/configs/flowti.config.json": "broken",
		});
		const result = readProjectConfig("/project", deps);
		expect(result.config).toBeNull();
	});

	it("returns null config with errors for invalid config (missing name)", () => {
		const deps = makeDeps({
			"/project/configs/flowti.config.json": JSON.stringify({ tools: {} }),
		});
		const result = readProjectConfig("/project", deps);
		expect(result.config).toBeNull();
	});

	it("returns config with warnings for unknown keys", () => {
		const config = { name: "valid", unknownKey: true };
		const deps = makeDeps({
			"/project/configs/flowti.config.json": JSON.stringify(config),
		});
		const result = readProjectConfig("/project", deps);
		expect(result.config).toEqual(config);
		expect(result.warnings).toContainEqual(expect.stringContaining("unknownKey"));
	});
});

describe("initializeProject", () => {
	it("returns existing config when both package.json and config exist", () => {
		const pkg = { name: "test", scripts: { build: "tsc" } };
		const config = { name: "test-config", build: { commands: { fast: "npm run build" } } };
		const deps = makeDeps({
			[n("/mock/projects", "test", "package.json")]: JSON.stringify(pkg),
			[n("/mock/projects", "test", "configs", "flowti.config.json")]: JSON.stringify(config),
		});

		const ctx = initializeProject("test", deps);
		expect(ctx.config).toEqual(config);
		expect(ctx.pkg).toEqual(pkg);
		expect(ctx.scripts).toEqual({ build: "tsc" });
	});

	it("scaffolds config when package.json exists but config does not", () => {
		const pkg = { name: "scaffold-test", scripts: { build: "esbuild", test: "vitest run" } };
		const deps = makeDeps({
			[n("/mock/projects", "scaffold-test", "package.json")]: JSON.stringify(pkg),
		});

		const ctx = initializeProject("scaffold-test", deps);
		expect(ctx.config.name).toBe("scaffold-test");
		expect(ctx.config.build?.commands?.fast).toBe("npm run build");
		expect(ctx.config.test?.commands?.unit).toBe("npm test");
		// Config was written to disk
		expect(deps.disk.existsSync(n("/mock/projects", "scaffold-test", "configs", "flowti.config.json"))).toBe(true);
	});

	it("returns minimal config when neither package.json nor config exists", () => {
		const ctx = initializeProject("empty", makeDeps());
		expect(ctx.config).toEqual({ name: "empty" });
		expect(ctx.pkg).toBeNull();
		expect(ctx.scripts).toEqual({});
	});

});

describe("getReportsDir", () => {
	it("uses config reports.dir when set", () => {
		const result = getReportsDir("/project", { name: "test", reports: { dir: "custom/reports" } }, { paths: mockPaths });
		expect(result).toBe(n("/project", "custom/reports"));
	});

	it("defaults to reports", () => {
		const result = getReportsDir("/project", { name: "test" }, { paths: mockPaths });
		expect(result).toBe(n("/project", "reports"));
	});
});
