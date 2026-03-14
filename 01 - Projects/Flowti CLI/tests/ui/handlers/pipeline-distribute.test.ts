/**
 * pipeline-distribute.test.ts — Tests for the distribute() build artifact distribution helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { distribute } from "../../../src/ui/handlers/pipeline-distribute.js";
import type { DistributeDeps } from "../../../src/infrastructure/deps.js";
import type { PublishConfig } from "../../../src/infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function createMockDeps(overrides?: Partial<DistributeDeps>): DistributeDeps {
	return {
		disk: {
			existsSync: vi.fn(() => true),
			readdirSync: vi.fn(() => []),
			mkdirSync: vi.fn(),
			copyFileSync: vi.fn(),
			unlinkSync: vi.fn(),
			...overrides?.disk,
		} as unknown as DistributeDeps["disk"],
		paths: {
			join: (...args: string[]) => args.join("/"),
			resolve: (...args: string[]) => args.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			sep: "/",
			...overrides?.paths,
		} as unknown as DistributeDeps["paths"],
		log: vi.fn() as DistributeDeps["log"],
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("distribute", () => {
	let deps: DistributeDeps;

	beforeEach(() => {
		vi.clearAllMocks();
		deps = createMockDeps();
	});

	// ── Validation: no endpoints ────────────────────────────────────

	it("returns 1 and logs warning when no endpoints configured", () => {
		const config: PublishConfig = { outDir: "dist" };
		const result = distribute("/project", config, deps);
		expect(result).toBe(1);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No publish endpoints configured"));
	});

	it("returns 1 and logs warning when endpoints is empty array", () => {
		const config: PublishConfig = { outDir: "dist", endpoints: [] };
		const result = distribute("/project", config, deps);
		expect(result).toBe(1);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No publish endpoints configured"));
	});

	// ── Validation: no outDir ───────────────────────────────────────

	it("returns 1 and logs warning when no outDir configured", () => {
		const config: PublishConfig = { endpoints: [{ name: "local", path: "/dest" }] };
		const result = distribute("/project", config, deps);
		expect(result).toBe(1);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No outDir configured"));
	});

	// ── Validation: outDir does not exist ───────────────────────────

	it("returns 1 and logs error when outDir does not exist", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(false);
		const config: PublishConfig = { outDir: "dist", endpoints: [{ name: "local", path: "/dest" }] };
		const result = distribute("/project", config, deps);
		expect(result).toBe(1);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Output directory not found"));
	});

	// ── Success: copies all files ───────────────────────────────────

	it("returns 0 and copies files when config is valid", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readdirSync).mockReturnValue([
			{ name: "main.js", isDirectory: () => false },
			{ name: "styles.css", isDirectory: () => false },
		] as unknown as ReturnType<typeof deps.disk.readdirSync>);

		const config: PublishConfig = {
			outDir: "dist",
			endpoints: [{ name: "local", path: "/dest" }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.copyFileSync).toHaveBeenCalledTimes(2);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Distributed to 1 endpoint(s)"));
	});

	it("distributes to multiple endpoints", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readdirSync).mockReturnValue([
			{ name: "main.js", isDirectory: () => false },
		] as unknown as ReturnType<typeof deps.disk.readdirSync>);

		const config: PublishConfig = {
			outDir: "dist",
			endpoints: [
				{ name: "local", path: "/dest1" },
				{ name: "remote", path: "/dest2" },
			],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith("/dest1", { recursive: true });
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith("/dest2", { recursive: true });
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Distributed to 2 endpoint(s)"));
	});

	// ── Recursive directory copy ────────────────────────────────────

	it("recursively copies directories", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readdirSync)
			.mockReturnValueOnce([
				{ name: "sub", isDirectory: () => true },
				{ name: "file.js", isDirectory: () => false },
			] as unknown as ReturnType<typeof deps.disk.readdirSync>)
			.mockReturnValueOnce([
				{ name: "nested.js", isDirectory: () => false },
			] as unknown as ReturnType<typeof deps.disk.readdirSync>);

		const config: PublishConfig = {
			outDir: "dist",
			endpoints: [{ name: "local", path: "/dest" }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		// mkdirSync called for endpoint dir + subdirectory
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith("/dest/sub", { recursive: true });
		expect(deps.disk.copyFileSync).toHaveBeenCalledTimes(2);
	});

	// ── Clean option ────────────────────────────────────────────────

	it("cleans endpoint artifacts when clean option is true", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readdirSync).mockReturnValue([]);

		const config: PublishConfig = {
			outDir: "dist",
			artifacts: ["main.js", "styles.css"],
			endpoints: [{ name: "local", path: "/dest", clean: true }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith("/dest/main.js");
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith("/dest/styles.css");
	});

	it("does not clean when clean is false", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readdirSync).mockReturnValue([]);

		const config: PublishConfig = {
			outDir: "dist",
			artifacts: ["main.js"],
			endpoints: [{ name: "local", path: "/dest", clean: false }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.unlinkSync).not.toHaveBeenCalled();
	});

	it("does not clean when endpoint directory does not exist", () => {
		vi.mocked(deps.disk.existsSync).mockImplementation((p: string) => {
			if (typeof p === "string" && p.includes("/dest")) return false;
			return true; // srcDir exists
		});
		vi.mocked(deps.disk.readdirSync).mockReturnValue([]);

		const config: PublishConfig = {
			outDir: "dist",
			artifacts: ["main.js"],
			endpoints: [{ name: "local", path: "/dest", clean: true }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.unlinkSync).not.toHaveBeenCalled();
	});

	// ── Artifacts list (selective copy) ─────────────────────────────

	it("copies only listed artifacts when artifacts list is provided", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);

		const config: PublishConfig = {
			outDir: "dist",
			artifacts: ["main.js", "styles.css"],
			endpoints: [{ name: "local", path: "/dest" }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.copyFileSync).toHaveBeenCalledTimes(2);
		expect(deps.disk.copyFileSync).toHaveBeenCalledWith("/project/dist/main.js", "/dest/main.js");
		expect(deps.disk.copyFileSync).toHaveBeenCalledWith("/project/dist/styles.css", "/dest/styles.css");
		expect(deps.disk.readdirSync).not.toHaveBeenCalled();
	});

	it("skips artifacts that do not exist in source", () => {
		vi.mocked(deps.disk.existsSync).mockImplementation((p: string) => {
			if (typeof p === "string" && p.includes("missing.js")) return false;
			return true;
		});

		const config: PublishConfig = {
			outDir: "dist",
			artifacts: ["main.js", "missing.js"],
			endpoints: [{ name: "local", path: "/dest" }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.copyFileSync).toHaveBeenCalledTimes(1);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("skip"));
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("missing.js"));
	});

	it("creates parent directories for artifacts", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);

		const config: PublishConfig = {
			outDir: "dist",
			artifacts: ["sub/nested.js"],
			endpoints: [{ name: "local", path: "/dest" }],
		};

		const result = distribute("/project", config, deps);
		expect(result).toBe(0);
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("sub"), { recursive: true });
	});

	// ── Endpoint logging ────────────────────────────────────────────

	it("logs each endpoint name and path", () => {
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readdirSync).mockReturnValue([]);

		const config: PublishConfig = {
			outDir: "dist",
			endpoints: [{ name: "staging", path: "/staging" }],
		};

		distribute("/project", config, deps);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("staging"));
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("/staging"));
	});
});
