import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			resolve: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			dirname: (p: string) => path.default.dirname(p).replace(/\\/g, "/"),
			basename: path.default.basename,
		},
	};
});

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import * as shellMod from "../../../src/infrastructure/shell.js";
import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { publishMenu } from "../../../src/ui/menus/publish-menu.js";
import type { PublishConfig } from "../../../src/infrastructure/types.js";

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: mockFs });
}

function setShell(sh: ReturnType<typeof createMockShell>): void {
	Object.assign(shellMod, { shell: sh });
}

beforeEach(() => vi.clearAllMocks());

// ── publishMenu ─────────────────────────────────────────────────────

describe("publishMenu", () => {
	it("calls runMenu with Publish title and pipeline items", async () => {
		vi.mocked(runMenu).mockResolvedValue("main");

		const config: PublishConfig = {
			build: "npm run build",
			test: "npm test",
			outDir: "dist",
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		};

		await publishMenu("/project", config);

		expect(runMenu).toHaveBeenCalledWith(
			"Publish",
			expect.arrayContaining([
				expect.objectContaining({ key: "1", label: "Build" }),
				expect.objectContaining({ key: "2", label: "Test" }),
				expect.objectContaining({ key: "3", label: "Distribute to endpoints" }),
				expect.objectContaining({ key: "a" }),
				expect.objectContaining({ key: "b", label: "Back" }),
				expect.objectContaining({ key: "q", label: "Quit" }),
			]),
			expect.objectContaining({ beforeMenu: expect.any(Function) }),
		);
	});

	it("uses default build and test commands when not configured", async () => {
		const sh = createMockShell();
		setShell(sh);
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			// Execute the Build action (key "1")
			const buildItem = (items as Array<{ key?: string; action?: () => unknown }>).find((i) => i.key === "1");
			buildItem?.action?.();
			return "main";
		});

		await publishMenu("/project", {});

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run build");
	});

	it("uses configured build command", async () => {
		const sh = createMockShell();
		setShell(sh);
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const buildItem = (items as Array<{ key?: string; action?: () => unknown }>).find((i) => i.key === "1");
			buildItem?.action?.();
			return "main";
		});

		await publishMenu("/project", { build: "make build" });

		expect(sh.calls[0].cmd).toBe("make build");
	});

	it("Build action sets buildPassed on success", async () => {
		const sh = createMockShell();
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown; disabled?: () => boolean }>;
			// Run build
			arr.find((i) => i.key === "1")?.action?.();
			// Test should be enabled after build passes
			const testItem = arr.find((i) => i.key === "2");
			expect(testItem?.disabled?.()).toBe(false);
			return "main";
		});

		await publishMenu("/project", {});
	});

	it("Test is disabled when build has not passed", async () => {
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; disabled?: () => boolean }>;
			const testItem = arr.find((i) => i.key === "2");
			expect(testItem?.disabled?.()).toBe(true);
			return "main";
		});

		await publishMenu("/project", {});
	});

	it("Distribute is disabled when test has not passed", async () => {
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; disabled?: () => boolean }>;
			const distItem = arr.find((i) => i.key === "3");
			expect(distItem?.disabled?.()).toBe(true);
			return "main";
		});

		await publishMenu("/project", {});
	});

	it("Build failure resets testPassed", async () => {
		const sh = createMockShell({ exitCodes: { "npm run build": 1 } });
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown; disabled?: () => boolean }>;
			arr.find((i) => i.key === "1")?.action?.();
			// Test should remain disabled after build failure
			expect(arr.find((i) => i.key === "2")?.disabled?.()).toBe(true);
			return "main";
		});

		await publishMenu("/project", {});
	});

	it("Test action uses configured test command", async () => {
		const sh = createMockShell();
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			// Build first to enable test
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			return "main";
		});

		await publishMenu("/project", { test: "make test" });

		expect(sh.calls[1].cmd).toBe("make test");
	});

	it("Back action returns 'main'", async () => {
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			const result = arr.find((i) => i.key === "b")?.action?.();
			expect(result).toBe("main");
			return "main";
		});

		await publishMenu("/project", {});
	});

	it("Quit action returns 'quit'", async () => {
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			const result = arr.find((i) => i.key === "q")?.action?.();
			expect(result).toBe("quit");
			return "quit";
		});

		await publishMenu("/project", {});
	});

	it("beforeMenu renders pipeline status and endpoints", async () => {
		let capturedBeforeMenu: (() => void) | undefined;
		vi.mocked(runMenu).mockImplementation(async (_title, _items, opts) => {
			capturedBeforeMenu = opts?.beforeMenu;
			return "main";
		});

		await publishMenu("/project", {
			endpoints: [
				{ name: "staging", path: "/deploy/staging" },
				{ name: "prod", path: "/deploy/prod" },
			],
		});

		capturedBeforeMenu?.();
		expect(log).toHaveBeenCalled();
	});

	it("beforeMenu renders 'No endpoints configured' when empty", async () => {
		let capturedBeforeMenu: (() => void) | undefined;
		vi.mocked(runMenu).mockImplementation(async (_title, _items, opts) => {
			capturedBeforeMenu = opts?.beforeMenu;
			return "main";
		});

		await publishMenu("/project", {});

		capturedBeforeMenu?.();
		const calls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(calls.some((c) => typeof c === "string" && c.includes("No endpoints configured"))).toBe(true);
	});
});

// ── Run-all pipeline ────────────────────────────────────────────────

describe("publishMenu run-all action", () => {
	it("runs full pipeline on success", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs({ "/project/dist/main.js": "code" });
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "a")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		});

		// Build + Test + (distribute calls shell indirectly through log)
		expect(sh.calls).toHaveLength(2); // build + test
		expect(sh.calls[0].cmd).toBe("npm run build");
		expect(sh.calls[1].cmd).toBe("npm test");
	});

	it("stops pipeline when build fails", async () => {
		const sh = createMockShell({ exitCodes: { "npm run build": 1 } });
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "a")?.action?.();
			return "main";
		});

		await publishMenu("/project", {});

		expect(sh.calls).toHaveLength(1);
		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("build failed"))).toBe(true);
	});

	it("stops pipeline when tests fail", async () => {
		const sh = createMockShell({ exitCodes: { "npm test": 1 } });
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "a")?.action?.();
			return "main";
		});

		await publishMenu("/project", {});

		expect(sh.calls).toHaveLength(2);
		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("tests failed"))).toBe(true);
	});
});

// ── Distribute (via menu key 3) ─────────────────────────────────────

describe("publishMenu distribute action", () => {
	it("logs error when no endpoints configured", async () => {
		const sh = createMockShell();
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			// Build and test to enable distribute
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("No publish endpoints configured"))).toBe(true);
	});

	it("logs error when outDir not configured", async () => {
		const sh = createMockShell();
		setShell(sh);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("No outDir configured"))).toBe(true);
	});

	it("logs error when outDir does not exist on disk", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs(); // empty - no dist dir
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Output directory not found"))).toBe(true);
	});

	it("copies specific artifacts when configured", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs({
			"/project/dist/main.js": "code",
			"/project/dist/styles.css": "css",
		});
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			artifacts: ["main.js", "styles.css"],
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Distributed to 1 endpoint(s)"))).toBe(true);
	});

	it("skips artifacts that do not exist in outDir", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs({
			"/project/dist/main.js": "code",
		});
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			artifacts: ["main.js", "missing.js"],
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("skip"))).toBe(true);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("copy"))).toBe(true);
	});

	it("copies entire directory when no artifacts configured", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs({
			"/project/dist/main.js": "code",
			"/project/dist/styles.css": "css",
		});
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			endpoints: [{ name: "prod", path: "/deploy/prod" }],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("2 files"))).toBe(true);
	});

	it("cleans endpoint artifacts when ep.clean is true", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs({
			"/project/dist/main.js": "new-code",
			"/deploy/prod/main.js": "old-code",
		});
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			artifacts: ["main.js"],
			endpoints: [{ name: "prod", path: "/deploy/prod", clean: true }],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Distributed to 1 endpoint(s)"))).toBe(true);
	});

	it("distributes to multiple endpoints", async () => {
		const sh = createMockShell();
		setShell(sh);
		const mockFs = createMockFs({
			"/project/dist/main.js": "code",
		});
		setDisk(mockFs);

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			arr.find((i) => i.key === "1")?.action?.();
			arr.find((i) => i.key === "2")?.action?.();
			arr.find((i) => i.key === "3")?.action?.();
			return "main";
		});

		await publishMenu("/project", {
			outDir: "dist",
			artifacts: ["main.js"],
			endpoints: [
				{ name: "staging", path: "/deploy/staging" },
				{ name: "prod", path: "/deploy/prod" },
			],
		});

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Distributed to 2 endpoint(s)"))).toBe(true);
	});
});
