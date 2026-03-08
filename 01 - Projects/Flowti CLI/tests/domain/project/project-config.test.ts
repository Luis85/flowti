import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";

// Mock config module to control PROJECTS_DIR
vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/projects",
}));

// Mock filesystem module — we'll replace `disk` per test
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import {
	resolveProjectPath,
	readPackageJson,
	readProjectConfig,
	initializeProject,
	getReportsDir,
} from "../../../src/domain/project/project-config.js";

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(filesystemMod, { disk: mockFs });
}

function n(...parts: string[]): string {
	return path.join(...parts);
}

describe("resolveProjectPath", () => {
	it("resolves to projects dir", () => {
		expect(resolveProjectPath("my-app")).toBe(n("/mock/projects", "my-app"));
	});
});

describe("readPackageJson", () => {
	it("returns parsed package.json when it exists", () => {
		const fs = createMockFs({
			"/project/package.json": JSON.stringify({ name: "test-pkg", version: "1.0.0" }),
		});
		setDisk(fs);
		const result = readPackageJson("/project");
		expect(result).toEqual({ name: "test-pkg", version: "1.0.0" });
	});

	it("returns null when package.json does not exist", () => {
		setDisk(createMockFs());
		expect(readPackageJson("/project")).toBeNull();
	});

	it("returns null for corrupt JSON", () => {
		const fs = createMockFs({ "/project/package.json": "not json {{{" });
		setDisk(fs);
		expect(readPackageJson("/project")).toBeNull();
	});
});

describe("readProjectConfig", () => {
	it("returns parsed config when it exists", () => {
		const config = { name: "my-project", tools: { build: "npm run build" } };
		const fs = createMockFs({
			"/project/configs/flowti.config.json": JSON.stringify(config),
		});
		setDisk(fs);
		expect(readProjectConfig("/project")).toEqual(config);
	});

	it("returns null when config does not exist", () => {
		setDisk(createMockFs());
		expect(readProjectConfig("/project")).toBeNull();
	});

	it("returns null for corrupt JSON", () => {
		const fs = createMockFs({
			"/project/configs/flowti.config.json": "broken",
		});
		setDisk(fs);
		expect(readProjectConfig("/project")).toBeNull();
	});
});

describe("initializeProject", () => {
	it("returns existing config when both package.json and config exist", () => {
		const pkg = { name: "test", scripts: { build: "tsc" } };
		const config = { name: "test-config", tools: {} };
		const fs = createMockFs({
			"/mock/projects/test/package.json": JSON.stringify(pkg),
			"/mock/projects/test/configs/flowti.config.json": JSON.stringify(config),
		});
		setDisk(fs);

		const ctx = initializeProject("test");
		expect(ctx.config).toEqual(config);
		expect(ctx.pkg).toEqual(pkg);
		expect(ctx.scripts).toEqual({ build: "tsc" });
	});

	it("scaffolds config when package.json exists but config does not", () => {
		const pkg = { name: "scaffold-test", scripts: { build: "esbuild", reports: "npm run reports" } };
		const fs = createMockFs({
			"/mock/projects/scaffold-test/package.json": JSON.stringify(pkg),
		});
		setDisk(fs);

		const ctx = initializeProject("scaffold-test");
		expect(ctx.config.name).toBe("scaffold-test");
		expect(ctx.config.tools?.build).toBe("npm run build");
		expect(ctx.config.tools?.reports).toBe("npm run reports");
		// Config was written to disk
		expect(fs.files.has("/mock/projects/scaffold-test/configs/flowti.config.json")).toBe(true);
	});

	it("returns minimal config when neither package.json nor config exists", () => {
		setDisk(createMockFs());
		const ctx = initializeProject("empty");
		expect(ctx.config).toEqual({ name: "empty" });
		expect(ctx.pkg).toBeNull();
		expect(ctx.scripts).toEqual({});
	});

});

describe("getReportsDir", () => {
	it("uses config reports.dir when set", () => {
		const result = getReportsDir("/project", { name: "test", reports: { dir: "custom/reports" } });
		expect(result).toBe(n("/project", "custom/reports"));
	});

	it("defaults to reports", () => {
		const result = getReportsDir("/project", { name: "test" });
		expect(result).toBe(n("/project", "reports"));
	});
});
