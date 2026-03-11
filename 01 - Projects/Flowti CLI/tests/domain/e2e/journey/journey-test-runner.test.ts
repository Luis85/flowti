import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		readFileSync: vi.fn(() => "{}"),
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));

vi.mock("../../../../src/infrastructure/proc.js", () => {
	const env: Record<string, string | undefined> = {};
	return { proc: { env: () => env } };
});

vi.mock("../../../../src/infrastructure/shell.js", () => ({
	shell: {
		runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
	},
}));

vi.mock("../../../../src/domain/e2e/journey/journey-loader.js", () => ({
	loadJourneyFile: vi.fn((_read: unknown, _path: string) => ({
		journey: "Test Journey",
		description: "A test",
		steps: [{ id: "step-1", title: "Step 1", actions: [] }],
	})),
}));

vi.mock("../../../../src/domain/e2e/journey/journey-executor.js", () => ({
	executeJourney: vi.fn(async () => ({
		journey: "test",
		steps: [{ id: "step-1", status: "pass", actions: [] }],
		status: "pass",
	})),
	resolveEnvironment: vi.fn(() => ({
		registry: new Map(),
		setup: undefined,
		teardown: undefined,
	})),
}));

vi.mock("../../../../src/domain/e2e/journey/providers/index.js", () => ({
	createDefaultRegistry: vi.fn(() => ({
		getProvider: vi.fn(() => ({})),
	})),
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { proc } from "../../../../src/infrastructure/proc.js";
import { shell } from "../../../../src/infrastructure/shell.js";
import { loadJourneyFile } from "../../../../src/domain/e2e/journey/journey-loader.js";
import { executeJourney, resolveEnvironment } from "../../../../src/domain/e2e/journey/journey-executor.js";
import {
	createDefaultDeps,
	loadJourney,
	loadJourneyFromPath,
	resolveJourneyEnvironment,
	runStep,
	runJourney,
	setToolDeps,
	resetToolDeps,
	ensureTestVault,
} from "../../../../src/domain/e2e/journey/journey-test-runner.js";

const cliDeps = { disk, paths, proc, shell } as any;

describe("createDefaultDeps", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns object with all required tool deps", () => {
		const deps = createDefaultDeps(cliDeps);
		expect(deps.exec).toBeTypeOf("function");
		expect(deps.readFile).toBeTypeOf("function");
		expect(deps.writeFile).toBeTypeOf("function");
		expect(deps.exists).toBeTypeOf("function");
		expect(deps.mkdir).toBeTypeOf("function");
		expect(deps.log).toBeTypeOf("function");
		expect(deps.sleep).toBeTypeOf("function");
	});

	it("exec delegates to shell.runCaptureDetailed", () => {
		const deps = createDefaultDeps(cliDeps);
		deps.exec("echo hello", { cwd: "/tmp" });
		expect(shell.runCaptureDetailed).toHaveBeenCalledWith("echo hello", expect.objectContaining({ cwd: "/tmp" }));
	});

	it("readFile delegates to disk.readFileSync", () => {
		vi.mocked(disk.readFileSync).mockReturnValue("content");
		const deps = createDefaultDeps(cliDeps);
		expect(deps.readFile("/test.txt")).toBe("content");
	});

	it("writeFile creates directory and writes file", () => {
		const deps = createDefaultDeps(cliDeps);
		deps.writeFile("/dir/sub/file.txt", "data");
		expect(disk.mkdirSync).toHaveBeenCalledWith("/dir/sub", { recursive: true });
		expect(disk.writeFileSync).toHaveBeenCalledWith("/dir/sub/file.txt", "data", "utf-8");
	});

	it("exists delegates to disk.existsSync", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		const deps = createDefaultDeps(cliDeps);
		expect(deps.exists("/test.txt")).toBe(true);
	});

	it("log calls the provided logger", () => {
		const logger = vi.fn();
		const deps = createDefaultDeps(cliDeps, logger);
		deps.log("hello");
		expect(logger).toHaveBeenCalledWith("hello");
	});

	it("sleep returns a promise", async () => {
		const deps = createDefaultDeps(cliDeps);
		const start = Date.now();
		await deps.sleep(10);
		expect(Date.now() - start).toBeGreaterThanOrEqual(5);
	});
});

describe("loadJourney", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("loads journey file from base dir + slug", () => {
		const result = loadJourney("/project/tests/e2e", "getting-started", cliDeps);
		expect(loadJourneyFile).toHaveBeenCalledWith(expect.any(Function), "/project/tests/e2e/journeys/getting-started.journey");
		expect(result.journey).toBe("Test Journey");
	});
});

describe("loadJourneyFromPath", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("loads journey from absolute path", () => {
		const result = loadJourneyFromPath("/absolute/path/test.journey", cliDeps);
		expect(loadJourneyFile).toHaveBeenCalledWith(expect.any(Function), "/absolute/path/test.journey");
		expect(result.journey).toBe("Test Journey");
	});
});

describe("resolveJourneyEnvironment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns default environment when no target", () => {
		resolveJourneyEnvironment({ journey: "test", steps: [] });
		expect(resolveEnvironment).toHaveBeenCalledWith();
	});

	it("resolves environment with provider when target specified", () => {
		resolveJourneyEnvironment({ journey: "test", steps: [], requires: { target: "obsidian" } });
		expect(resolveEnvironment).toHaveBeenCalledWith(expect.anything());
	});
});

describe("setToolDeps / resetToolDeps", () => {
	afterEach(() => {
		resetToolDeps();
	});

	it("allows overriding tool deps", async () => {
		const customDeps = createDefaultDeps(cliDeps);
		setToolDeps(customDeps);
		await runStep({ id: "s1", title: "Test", actions: [] });
		expect(executeJourney).toHaveBeenCalledWith(
			expect.anything(),
			customDeps,
			expect.anything(),
			undefined,
		);
	});

	it("resetToolDeps restores default behavior", () => {
		setToolDeps(createDefaultDeps(cliDeps));
		resetToolDeps();
		// After reset, getDeps() will create new default deps
		// Just verify no error
		expect(() => resetToolDeps()).not.toThrow();
	});
});

describe("runStep", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetToolDeps();
		setToolDeps(createDefaultDeps(cliDeps));
	});

	it("executes a single step and returns its result", async () => {
		vi.mocked(executeJourney).mockResolvedValue({
			journey: "step:s1",
			steps: [{ id: "s1", status: "pass", actions: [] }],
			status: "pass",
		});

		const result = await runStep({ id: "s1", title: "Test Step", actions: [] });
		expect(result.status).toBe("pass");
		expect(result.id).toBe("s1");
	});

	it("wraps step in a mini journey", async () => {
		await runStep({ id: "s1", title: "Test Step", description: "desc", actions: [] });
		expect(executeJourney).toHaveBeenCalledWith(
			expect.objectContaining({
				journey: "step:s1",
				description: "desc",
				steps: [expect.objectContaining({ id: "s1" })],
			}),
			expect.anything(),
			expect.anything(),
			undefined,
		);
	});

	it("passes environment when provided", async () => {
		const env = { registry: new Map(), setup: undefined, teardown: undefined };
		await runStep({ id: "s1", title: "Test", actions: [] }, {}, env as never);
		expect(executeJourney).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			env,
		);
	});
});

describe("runJourney", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetToolDeps();
		setToolDeps(createDefaultDeps(cliDeps));
	});

	it("executes full journey with resolved environment", async () => {
		const definition = { journey: "Test", steps: [{ id: "s1", title: "Step", actions: [] }] };
		const result = await runJourney(definition);
		expect(executeJourney).toHaveBeenCalled();
		expect(resolveEnvironment).toHaveBeenCalled();
		expect(result.status).toBe("pass");
	});
});

describe("ensureTestVault", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates vault directory when it does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		const result = ensureTestVault("/project", "test-vault", cliDeps);
		expect(disk.mkdirSync).toHaveBeenCalledWith("/project/../test-vault", { recursive: true });
		expect(disk.mkdirSync).toHaveBeenCalledWith("/project/../test-vault/.obsidian", { recursive: true });
		expect(result).toBe("/project/../test-vault");
	});

	it("does not create when vault exists", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		ensureTestVault("/project", "test-vault", cliDeps);
		expect(disk.mkdirSync).not.toHaveBeenCalled();
	});

	it("uses custom vault name", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		const result = ensureTestVault("/project", "my-vault", cliDeps);
		expect(result).toBe("/project/../my-vault");
	});
});
