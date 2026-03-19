import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

vi.mock("../../src/domain/make/component/storybook-service.js", () => ({
	installStorybook: vi.fn(() => true),
	isStorybookInstalled: vi.fn(() => true),
	isStorybookRunning: vi.fn(() => false),
	stopStorybook: vi.fn(),
	startStorybookDev: vi.fn(async () => ({ started: true, url: "http://localhost:6006" })),
	runStorybookBuild: vi.fn(),
	resolveStorybookDir: vi.fn(() => "/project/components"),
}));

vi.mock("../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
	setFramework: vi.fn(),
	writeComponentsConfig: vi.fn(),
	readComponentsConfig: vi.fn(() => ({})),
}));

vi.mock("../../src/ui/renderers/storybook-renderer-impl.js", () => ({
	createStorybookRenderer: vi.fn(() => ({})),
}));

import { commands } from "../../src/controller/storybook.controller.js";
import { createProjectContext } from "../helpers/command-test-utils.js";
import {
	installStorybook,
	isStorybookRunning,
	stopStorybook,
	startStorybookDev,
	isStorybookInstalled,
} from "../../src/domain/make/component/storybook-service.js";
import { setFramework, writeComponentsConfig } from "../../src/domain/make/component/storybook-settings.js";

const mockInstall = vi.mocked(installStorybook);
const mockIsRunning = vi.mocked(isStorybookRunning);
const mockStop = vi.mocked(stopStorybook);
const mockStart = vi.mocked(startStorybookDev);
const mockIsInstalled = vi.mocked(isStorybookInstalled);
const mockSetFramework = vi.mocked(setFramework);
const mockWriteConfig = vi.mocked(writeComponentsConfig);

beforeEach(() => {
	vi.clearAllMocks();
	mockInstall.mockReturnValue(true);
	mockIsRunning.mockReturnValue(false);
	mockIsInstalled.mockReturnValue(true);
	mockStart.mockResolvedValue({ started: true, url: "http://localhost:6006" });
});

// Extract handler from adaptDescriptor-wrapped command
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(name: string): (ctx: any) => any {
	const cmd = commands[name] as unknown as { __descriptor: { handler: (ctx: any) => any } };
	return cmd.__descriptor.handler;
}

describe("storybook:install", () => {
	it("calls setFramework and installStorybook with default framework", () => {
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean; framework: string; sbDir: string };

		expect(mockSetFramework).toHaveBeenCalled();
		expect(mockInstall).toHaveBeenCalled();
		expect(result.installed).toBe(true);
		expect(result.framework).toBe("html");
	});

	it("uses --framework flag when provided", () => {
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "angular" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean; framework: string };

		expect(result.framework).toBe("angular");
		expect(mockSetFramework).toHaveBeenCalledWith(
			expect.any(String), "angular", expect.anything(),
		);
	});

	it("returns installed: false when installation fails", () => {
		mockInstall.mockReturnValue(false);
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean };

		expect(result.installed).toBe(false);
	});

	it("returns installed: true when already installed", () => {
		mockInstall.mockReturnValue(true);
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean };

		expect(result.installed).toBe(true);
		expect(mockInstall).toHaveBeenCalled();
	});
});

describe("storybook:start", () => {
	it("calls startStorybookDev and returns result", async () => {
		const ctx = createProjectContext({ command: "storybook:start" });
		const handler = getHandler("storybook:start");
		const result = await (handler(ctx) as Promise<{ started: boolean; url: string }>);

		expect(mockStart).toHaveBeenCalled();
		expect(result.started).toBe(true);
		expect(result.url).toBe("http://localhost:6006");
	});

	it("propagates error from startStorybookDev", async () => {
		mockStart.mockResolvedValue({ started: false, url: "", error: "not-installed" });
		const ctx = createProjectContext({ command: "storybook:start" });
		const handler = getHandler("storybook:start");
		const result = await (handler(ctx) as Promise<{ started: boolean; error?: string }>);

		expect(result.started).toBe(false);
		expect(result.error).toBe("not-installed");
	});
});

describe("storybook:stop", () => {
	it("stops storybook when running", () => {
		mockIsRunning.mockReturnValue(true);
		const ctx = createProjectContext({ command: "storybook:stop" });
		const handler = getHandler("storybook:stop");
		const result = handler(ctx) as { stopped: boolean; wasRunning: boolean };

		expect(mockStop).toHaveBeenCalled();
		expect(result.wasRunning).toBe(true);
		expect(result.stopped).toBe(true);
	});

	it("reports not running when storybook is not active", () => {
		mockIsRunning.mockReturnValue(false);
		const ctx = createProjectContext({ command: "storybook:stop" });
		const handler = getHandler("storybook:stop");
		const result = handler(ctx) as { stopped: boolean; wasRunning: boolean };

		expect(mockStop).not.toHaveBeenCalled();
		expect(result.wasRunning).toBe(false);
		expect(result.stopped).toBe(false);
	});
});

describe("storybook:build", () => {
	it("returns built: true when storybook is installed", () => {
		const ctx = createProjectContext({ command: "storybook:build" });
		const handler = getHandler("storybook:build");
		const result = handler(ctx) as { built: boolean };

		expect(result.built).toBe(true);
	});

	it("returns built: false when storybook is not installed", () => {
		mockIsInstalled.mockReturnValue(false);
		const ctx = createProjectContext({ command: "storybook:build" });
		const handler = getHandler("storybook:build");
		const result = handler(ctx) as { built: boolean };

		expect(result.built).toBe(false);
	});
});

describe("storybook:generate", () => {
	it("runs generate script and returns success", () => {
		const ctx = createProjectContext({ command: "storybook:generate" });
		const handler = getHandler("storybook:generate");
		const result = handler(ctx) as { generated: boolean; exitCode: number };

		expect(result.generated).toBe(true);
		expect(result.exitCode).toBe(0);
	});

	it("returns generated: false when script fails", () => {
		const ctx = createProjectContext({ command: "storybook:generate" });
		const origRun = ctx.deps.shell.run;
		ctx.deps.shell.run = () => 1;
		const handler = getHandler("storybook:generate");
		const result = handler(ctx) as { generated: boolean; exitCode: number };

		expect(result.generated).toBe(false);
		expect(result.exitCode).toBe(1);
		ctx.deps.shell.run = origRun;
	});
});

describe("storybook:import --save-config", () => {
	it("writes markdownSource to config instead of running import", () => {
		const handler = getHandler("storybook:import");
		const ctx = createProjectContext({
			command: "storybook:import",
			flags: { output: "", source: "components", saveConfig: true, strategy: "flat", fields: "name,category,description" },
		});
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("configSaved", true);
		expect(result).toHaveProperty("strategy", "flat");
		expect(mockWriteConfig).toHaveBeenCalledWith(
			expect.any(String),
			{ markdownSource: { path: "components", strategy: "flat", requiredFields: ["name", "category", "description"] } },
			expect.anything(),
		);
	});
});

describe("storybook:clean", () => {
	it("deletes the components directory when it exists", () => {
		const handler = getHandler("storybook:clean");
		const ctx = createProjectContext({ command: "storybook:clean", flags: {} });
		ctx.deps.disk.existsSync = vi.fn(() => true);
		ctx.deps.disk.rmSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("cleaned", true);
		expect(ctx.deps.disk.rmSync).toHaveBeenCalledWith(
			expect.stringContaining("components"),
			{ recursive: true, force: true },
		);
	});

	it("returns cleaned true even when directory does not exist", () => {
		const handler = getHandler("storybook:clean");
		const ctx = createProjectContext({ command: "storybook:clean", flags: {} });
		ctx.deps.disk.existsSync = vi.fn(() => false);
		ctx.deps.disk.rmSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("cleaned", true);
		expect(ctx.deps.disk.rmSync).not.toHaveBeenCalled();
	});
});

describe("storybook:canvas-import", () => {
	it("reads canvas and writes sitemap", () => {
		const handler = getHandler("storybook:canvas-import");
		const canvasJson = JSON.stringify({
			nodes: [{ id: "n1", type: "text", text: "Home", x: 0, y: 0, width: 200, height: 100, color: "4" }],
			edges: [],
		});
		const ctx = createProjectContext({ command: "storybook:canvas-import", flags: {} });
		ctx.deps.disk.existsSync = vi.fn((p: string) => String(p).includes("sitemap.canvas"));
		ctx.deps.disk.readFileSync = vi.fn(() => canvasJson);
		ctx.deps.disk.writeFileSync = vi.fn();
		ctx.deps.disk.mkdirSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("added", 1);
		expect(ctx.deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("merges when --merge flag is set and sitemap exists", () => {
		const handler = getHandler("storybook:canvas-import");
		const canvasJson = JSON.stringify({
			nodes: [{ id: "n1", type: "text", text: "Home", x: 0, y: 0, width: 200, height: 100 }],
			edges: [],
		});
		const existingSitemap = JSON.stringify({ version: 2, pages: { "old": { kind: "page", label: "Old", description: "", actions: [] } } });
		const ctx = createProjectContext({ command: "storybook:canvas-import", flags: { merge: true } });
		ctx.deps.disk.existsSync = vi.fn(() => true);
		ctx.deps.disk.readFileSync = vi.fn((p: string) => String(p).includes("sitemap.json") ? existingSitemap : canvasJson);
		ctx.deps.disk.writeFileSync = vi.fn();
		ctx.deps.disk.mkdirSync = vi.fn();
		const result = handler(ctx) as Record<string, unknown>;
		expect(result).toHaveProperty("added", 1);
		expect(result).toHaveProperty("totalPages", 2);
	});
});
