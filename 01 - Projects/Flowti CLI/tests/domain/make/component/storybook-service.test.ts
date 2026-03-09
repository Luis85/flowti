import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		resolve: (...args: string[]) => args.join("/"),
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));

vi.mock("../../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn() },
}));

vi.mock("../../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

vi.mock("../../../../src/domain/knowledgebase/vault-service.js", () => ({
	isCliAvailable: vi.fn(() => false),
	isVaultInitialized: vi.fn(() => false),
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import {
	resolveStorybookDir,
	isStorybookInstalled,
	installStorybook,
	runStorybookDev,
	runStorybookBuild,
} from "../../../../src/domain/make/component/storybook-service.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { shell } from "../../../../src/infrastructure/shell.js";
import { isCliAvailable, isVaultInitialized } from "../../../../src/domain/knowledgebase/vault-service.js";
import type { ComponentsConfig } from "../../../../src/infrastructure/types.js";

const mockDisk = vi.mocked(disk);
const mockShell = vi.mocked(shell);
const mockCliAvailable = vi.mocked(isCliAvailable);
const mockVaultInitialized = vi.mocked(isVaultInitialized);

beforeEach(() => {
	vi.clearAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
});

describe("resolveStorybookDir", () => {
	it("uses default directory name", () => {
		const result = resolveStorybookDir("/project", {});
		expect(result).toBe("/project/component-library");
	});

	it("uses configured directory name", () => {
		const result = resolveStorybookDir("/project", { storybookDir: "my-storybook" });
		expect(result).toBe("/project/my-storybook");
	});
});

describe("isStorybookInstalled", () => {
	it("returns false when package.json does not exist", () => {
		expect(isStorybookInstalled("/project", {})).toBe(false);
		expect(mockDisk.existsSync).toHaveBeenCalledWith("/project/component-library/package.json");
	});

	it("returns true when package.json exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		expect(isStorybookInstalled("/project", {})).toBe(true);
	});
});

describe("installStorybook", () => {
	it("creates directory structure and config files", () => {
		mockShell.run.mockReturnValue(0);

		const result = installStorybook("/project", "my-project", {});

		expect(result).toBe(true);
		expect(mockDisk.mkdirSync).toHaveBeenCalled();
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
		// Should write package.json, main.ts, preview.ts
		const writeCalls = mockDisk.writeFileSync.mock.calls.map(([path]) => path);
		expect(writeCalls.some((p) => String(p).includes("package.json"))).toBe(true);
		expect(writeCalls.some((p) => String(p).includes("main.ts"))).toBe(true);
		expect(writeCalls.some((p) => String(p).includes("preview.ts"))).toBe(true);
	});

	it("runs npm install in storybook directory", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {});

		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("returns false when npm install fails", () => {
		mockShell.run.mockReturnValue(1);

		const result = installStorybook("/project", "my-project", {});

		expect(result).toBe(false);
	});

	it("skips if already installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = installStorybook("/project", "my-project", {});

		expect(result).toBe(true);
		expect(mockShell.run).not.toHaveBeenCalled();
	});

	it("uses custom storybookDir", () => {
		mockShell.run.mockReturnValue(0);
		const config: ComponentsConfig = { storybookDir: "sb" };

		installStorybook("/project", "my-project", config);

		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.objectContaining({
			cwd: "/project/sb",
		}));
	});

	it("writes package.json with project name", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {});

		const pkgCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("package.json"));
		expect(pkgCall).toBeDefined();
		const content = JSON.parse(pkgCall![1] as string);
		expect(content.name).toBe("my-project-component-library");
		expect(content.scripts.storybook).toBeDefined();
		expect(content.scripts["build-storybook"]).toBeDefined();
		expect(content.devDependencies.storybook).toBe("^10.0.0");
		expect(content.devDependencies["@storybook/html-vite"]).toBe("^10.0.0");
	});
});

describe("runStorybookDev", () => {
	it("runs storybook dev when installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		runStorybookDev("/project", {});

		expect(mockShell.run).toHaveBeenCalledWith("npm run storybook", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("warns when not installed", () => {
		runStorybookDev("/project", {});

		expect(mockShell.run).not.toHaveBeenCalled();
	});

	it("opens Obsidian Web Viewer when CLI available and vault initialized", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockCliAvailable.mockReturnValue(true);
		mockVaultInitialized.mockReturnValue(true);

		runStorybookDev("/project", {});

		expect(mockShell.runSilent).toHaveBeenCalledWith(
			"obsidian web url=http://localhost:6006 newtab",
		);
		// Still runs the dev server
		expect(mockShell.run).toHaveBeenCalledWith("npm run storybook", expect.anything());
	});

	it("skips Web Viewer when Obsidian CLI not available", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockCliAvailable.mockReturnValue(false);
		mockVaultInitialized.mockReturnValue(true);

		runStorybookDev("/project", {});

		expect(mockShell.runSilent).not.toHaveBeenCalled();
		expect(mockShell.run).toHaveBeenCalledWith("npm run storybook", expect.anything());
	});

	it("skips Web Viewer when not in an Obsidian vault", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockCliAvailable.mockReturnValue(true);
		mockVaultInitialized.mockReturnValue(false);

		runStorybookDev("/project", {});

		expect(mockShell.runSilent).not.toHaveBeenCalled();
	});
});

describe("runStorybookBuild", () => {
	it("runs storybook build when installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		runStorybookBuild("/project", {});

		expect(mockShell.run).toHaveBeenCalledWith("npm run build-storybook", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("warns when not installed", () => {
		runStorybookBuild("/project", {});

		expect(mockShell.run).not.toHaveBeenCalled();
	});
});
