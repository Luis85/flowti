/**
 * sitemap.controller.test.ts — Tests for the sitemap controller (v2 format).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const VALID_SITEMAP = {
	version: 2 as const,
	pages: {
		start: {
			kind: "page" as const,
			label: "Main Menu",
			description: "The main entry point",
			actions: [
				{ type: "navigate", key: "a", label: "Option A", target: "sub" },
				{ type: "command", key: "b", label: "Option B", command: "info" },
			],
		},
		sub: {
			kind: "form" as const,
			label: "Dynamic View",
			description: "A dynamic form page",
			domain: "build",
			actions: [
				{ type: "command", key: "s", label: "Submit", command: "build:run" },
			],
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
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
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
			warnings: [],
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
			expect(output).toHaveProperty("warnings");
			expect(output.warnings).toHaveLength(0);
		});

		it("returns errors when sitemap is invalid", () => {
			loadSitemapMock.mockReturnValue({
				ok: false,
				sitemap: undefined,
				errors: ["Missing pages object"],
				warnings: [],
			});

			commands["sitemap:validate"]({ format: "json" }, [], "sitemap:validate");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output.errors).toContain("Missing pages object");
			expect(output).toHaveProperty("viewCount", 0);
			expect(output).toHaveProperty("warnings");
		});

		it("returns warnings alongside ok status", () => {
			loadSitemapMock.mockReturnValue({
				ok: true,
				sitemap: VALID_SITEMAP,
				errors: [],
				warnings: ["Page 'sub' has no parent defined"],
			});

			commands["sitemap:validate"]({ format: "json" }, [], "sitemap:validate");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", true);
			expect(output.warnings).toContain("Page 'sub' has no parent defined");
		});

		it("renders human-readable output for valid sitemap", () => {
			commands["sitemap:validate"]({}, [], "sitemap:validate");

			expect(logMock).toHaveBeenCalled();
			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("Sitemap OK");
		});

		it("renders human-readable warnings for valid sitemap with warnings", () => {
			loadSitemapMock.mockReturnValue({
				ok: true,
				sitemap: VALID_SITEMAP,
				errors: [],
				warnings: ["Orphan page detected"],
			});

			commands["sitemap:validate"]({}, [], "sitemap:validate");

			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("Sitemap OK");
			expect(allOutput).toContain("Orphan page detected");
		});

		it("renders human-readable errors for invalid sitemap", () => {
			loadSitemapMock.mockReturnValue({
				ok: false,
				sitemap: undefined,
				errors: ["Bad structure"],
				warnings: [],
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
			expect(output).toHaveProperty("warnings");
		});
	});

	describe("sitemap:views", () => {
		it("returns all pages with their kind and action count", () => {
			commands["sitemap:views"]({ format: "json" }, [], "sitemap:views");

			expect(logMock).toHaveBeenCalledOnce();
			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("views");
			expect(output.views).toHaveLength(2);

			const start = output.views.find((v: { id: string }) => v.id === "start");
			expect(start).toMatchObject({ kind: "page", actionCount: 2, label: "Main Menu" });
			expect(start).toHaveProperty("description", "The main entry point");

			const sub = output.views.find((v: { id: string }) => v.id === "sub");
			expect(sub).toMatchObject({ kind: "form", actionCount: 1, label: "Dynamic View" });
			expect(sub).toHaveProperty("domain", "build");
			expect(sub).toHaveProperty("description", "A dynamic form page");
		});

		it("includes optional fields when present on pages", () => {
			const sitemapWithExtras = {
				version: 2 as const,
				pages: {
					detail: {
						kind: "page" as const,
						label: "Detail Page",
						description: "A detail page",
						domain: "reports",
						parent: "start",
						configPath: "configs/reports.json",
						route: { path: "/reports/detail" },
						actions: [],
					},
				},
			};

			loadSitemapMock.mockReturnValue({
				ok: true,
				sitemap: sitemapWithExtras,
				errors: [],
				warnings: [],
			});

			commands["sitemap:views"]({ format: "json" }, [], "sitemap:views");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			const detail = output.views[0];
			expect(detail).toMatchObject({
				id: "detail",
				kind: "page",
				label: "Detail Page",
				actionCount: 0,
				description: "A detail page",
				domain: "reports",
				parent: "start",
				configPath: "configs/reports.json",
			});
			expect(detail.route).toEqual({ path: "/reports/detail" });
		});

		it("returns errors when sitemap is invalid", () => {
			loadSitemapMock.mockReturnValue({
				ok: false,
				sitemap: undefined,
				errors: ["Broken"],
				warnings: [],
			});

			commands["sitemap:views"]({ format: "json" }, [], "sitemap:views");

			const output = JSON.parse(logMock.mock.calls[0][0] as string);
			expect(output).toHaveProperty("ok", false);
			expect(output).toHaveProperty("warnings");
		});

		it("renders human-readable page list", () => {
			commands["sitemap:views"]({}, [], "sitemap:views");

			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("Sitemap Pages");
			expect(allOutput).toContain("start");
			expect(allOutput).toContain("sub");
		});

		it("renders page metadata in human-readable output", () => {
			commands["sitemap:views"]({}, [], "sitemap:views");

			const allOutput = logMock.mock.calls.map((c: unknown[]) => c[0]).join(" ");
			expect(allOutput).toContain("page");
			expect(allOutput).toContain("form");
			expect(allOutput).toContain("actions");
		});
	});
});
