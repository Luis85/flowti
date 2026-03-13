/**
 * sitemap.controller.test.ts — Tests for the sitemap controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const VALID_SITEMAP = {
	version: 1,
	views: {
		start: {
			title: "Main Menu",
			items: [
				{ key: "a", label: "Option A", command: "info" },
				{ key: "b", label: "Option B", navigate: "sub" },
			],
		},
		sub: {
			type: "dynamic" as const,
			title: "Dynamic View",
			handler: "sub-handler",
		},
	},
};

vi.mock("../../src/infrastructure/sitemap-loader.js", () => ({
	loadSitemap: vi.fn(),
}));

vi.mock("../../src/infrastructure/sitemap-watcher.js", () => ({
	computeHash: vi.fn(() => "abc123def456"),
}));

vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
		statSync: vi.fn(() => ({ mtime: new Date("2026-03-10T12:00:00.000Z") })),
	},
}));

vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (_from: string, to: string) => to,
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
		resolve: (...args: string[]) => args.join("/"),
		isAbsolute: (p: string) => p.startsWith("/"),
		sep: "/",
	},
}));

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
	cliConfig: {},
	PROJECTS_DIR: "/vault/projects",
	PRODUCTS_DIR: "/vault/products",
	FEATURES_DIR: "/vault/features",
	PLUGIN_ROOT: "/vault/plugin",
	loadJson: vi.fn(() => null),
	captureConfig: {},
	getCaptureDir: vi.fn(() => "/vault/inbox"),
}));

vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })) },
}));

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-10T00:00:00.000Z", now: () => new Date("2026-03-10"), ms: () => 0, safeIso: () => "" },
}));

import { commands } from "../../src/controller/sitemap.controller.js";
import { loadSitemap } from "../../src/infrastructure/sitemap-loader.js";
import { computeHash } from "../../src/infrastructure/sitemap-watcher.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { log } from "../../src/infrastructure/logger.js";

const logMock = log as ReturnType<typeof vi.fn>;
const loadSitemapMock = loadSitemap as ReturnType<typeof vi.fn>;

describe("sitemap.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadSitemapMock.mockReturnValue({
			ok: true,
			sitemap: VALID_SITEMAP,
			errors: [],
		});
		(disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(VALID_SITEMAP));
		(disk.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ mtime: new Date("2026-03-10T12:00:00.000Z") });
	});

	describe("sitemap:validate", () => {
		it("returns ok with view count when sitemap is valid", () => {
			commands["sitemap:validate"]({ format: "json" }, [], "sitemap:validate");

			expect(loadSitemap).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output).toHaveProperty("viewCount", 2);
			expect(output).toHaveProperty("errors");
			expect(output.errors).toHaveLength(0);
		});

		it("returns errors when sitemap is invalid", () => {
			loadSitemapMock.mockReturnValue({
				ok: false,
				sitemap: undefined,
				errors: ["Missing views object"],
			});

			commands["sitemap:validate"]({ format: "json" }, [], "sitemap:validate");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output.errors).toContain("Missing views object");
			expect(output).toHaveProperty("viewCount", 0);
		});

		it("renders human-readable output for valid sitemap", () => {
			commands["sitemap:validate"]({}, [], "sitemap:validate");

			expect(logMock).toHaveBeenCalled();
			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("Sitemap OK");
		});

		it("renders human-readable errors for invalid sitemap", () => {
			loadSitemapMock.mockReturnValue({
				ok: false,
				sitemap: undefined,
				errors: ["Bad structure"],
			});

			commands["sitemap:validate"]({}, [], "sitemap:validate");

			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("validation failed");
		});
	});

	describe("sitemap:status", () => {
		it("returns status with path, hash, viewCount, and lastModified", () => {
			commands["sitemap:status"]({ format: "json" }, [], "sitemap:status");

			expect(disk.statSync).toHaveBeenCalledOnce();
			expect(computeHash).toHaveBeenCalledOnce();
			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("hash", "abc123def456");
			expect(output).toHaveProperty("viewCount", 2);
			expect(output).toHaveProperty("lastModified", "2026-03-10T12:00:00.000Z");
			expect(output).toHaveProperty("path");
		});

		it("returns error when sitemap file does not exist", () => {
			(disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

			commands["sitemap:status"]({ format: "json" }, [], "sitemap:status");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output.errors.length).toBeGreaterThan(0);
		});
	});

	describe("sitemap:views", () => {
		it("returns all views with their type and item count", () => {
			commands["sitemap:views"]({ format: "json" }, [], "sitemap:views");

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("views");
			expect(output.views).toHaveLength(2);

			const start = output.views.find((v: { id: string }) => v.id === "start");
			expect(start).toMatchObject({ type: "static", itemCount: 2, title: "Main Menu" });

			const sub = output.views.find((v: { id: string }) => v.id === "sub");
			expect(sub).toMatchObject({ type: "dynamic", itemCount: 0, title: "Dynamic View" });
		});

		it("returns errors when sitemap is invalid", () => {
			loadSitemapMock.mockReturnValue({
				ok: false,
				sitemap: undefined,
				errors: ["Broken"],
			});

			commands["sitemap:views"]({ format: "json" }, [], "sitemap:views");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
		});

		it("renders human-readable view list", () => {
			commands["sitemap:views"]({}, [], "sitemap:views");

			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("Sitemap Views");
			expect(allOutput).toContain("start");
			expect(allOutput).toContain("sub");
		});
	});
});
