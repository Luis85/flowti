import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeJourney } from "../../../../src/domain/e2e/journey/journey-executor.js";
import type { ToolDeps } from "../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyDefinition, JourneyAction } from "../../../../src/domain/e2e/journey/journey-types.js";

// ── Mock deps factory ────────────────────────────────────────────────

function createMockDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "ok", stderr: "" })),
		readFile: vi.fn(() => "file content"),
		writeFile: vi.fn(),
		exists: vi.fn(() => true),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		...overrides,
	};
}

function minimalJourney(steps: JourneyDefinition["steps"], extra?: Partial<JourneyDefinition>): JourneyDefinition {
	return {
		journey: "test-journey",
		description: "A test journey",
		steps,
		...extra,
	};
}

// ── Tool: command ────────────────────────────────────────────────────

describe("tool: command", () => {
	it("succeeds when exec returns exit code 0", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Run cmd", description: "Run a command",
			actions: [{ tool: "command", id: "echo hello" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
		expect(result.failed).toBe(0);
		expect(deps.exec).toHaveBeenCalledWith("echo hello", expect.objectContaining({}));
	});

	it("fails when exec returns non-zero exit code", async () => {
		const deps = createMockDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "", stderr: "error" })),
		});
		const journey = minimalJourney([{
			id: "s1", title: "Bad cmd", description: "",
			actions: [{ tool: "command", id: "bad" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("Exit code 1");
	});

	it("fails when no command specified", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "No cmd", description: "",
			actions: [{ tool: "command" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("No command");
	});

	it("catches exec exceptions", async () => {
		const deps = createMockDeps({
			exec: vi.fn(() => { throw new Error("boom"); }),
		});
		const journey = minimalJourney([{
			id: "s1", title: "Crash", description: "",
			actions: [{ tool: "command", id: "crash" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("boom");
	});

	it("passes cwd and timeout from options", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Cmd", description: "",
			actions: [{ tool: "command", id: "ls" }],
		}]);

		await executeJourney(journey, deps, { cwd: "/tmp", commandTimeout: 5000 });
		expect(deps.exec).toHaveBeenCalledWith("ls", expect.objectContaining({ cwd: "/tmp", timeout: 5000 }));
	});
});

// ── Tool: assert ─────────────────────────────────────────────────────

describe("tool: assert", () => {
	it("exit-code passes when command returns expected code", async () => {
		const deps = createMockDeps({ exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })) });
		const journey = minimalJourney([{
			id: "s1", title: "Assert exit", description: "",
			actions: [{ tool: "assert", type: "exit-code", command: "test", expected: 0 }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
	});

	it("exit-code fails on mismatch", async () => {
		const deps = createMockDeps({ exec: vi.fn(() => ({ exitCode: 2, stdout: "", stderr: "" })) });
		const journey = minimalJourney([{
			id: "s1", title: "Assert exit", description: "",
			actions: [{ tool: "assert", type: "exit-code", command: "test", expected: 0 }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("Expected exit code 0, got 2");
	});

	it("exit-code fails when no command given", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "No cmd", description: "",
			actions: [{ tool: "assert", type: "exit-code" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
	});

	it("stdout-contains passes when output includes text", async () => {
		const deps = createMockDeps({ exec: vi.fn(() => ({ exitCode: 0, stdout: "hello world", stderr: "" })) });
		const journey = minimalJourney([{
			id: "s1", title: "Assert stdout", description: "",
			actions: [{ tool: "assert", type: "stdout-contains", command: "echo hello world", contains: "hello" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
	});

	it("stdout-contains fails when output is missing text", async () => {
		const deps = createMockDeps({ exec: vi.fn(() => ({ exitCode: 0, stdout: "nope", stderr: "" })) });
		const journey = minimalJourney([{
			id: "s1", title: "Assert stdout", description: "",
			actions: [{ tool: "assert", type: "stdout-contains", command: "echo nope", contains: "hello" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("does not contain");
	});

	it("file-exists passes when file exists", async () => {
		const deps = createMockDeps({ exists: vi.fn(() => true) });
		const journey = minimalJourney([{
			id: "s1", title: "File check", description: "",
			actions: [{ tool: "assert", type: "file-exists", path: "/some/file" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
	});

	it("file-exists fails when file is missing", async () => {
		const deps = createMockDeps({ exists: vi.fn(() => false) });
		const journey = minimalJourney([{
			id: "s1", title: "File check", description: "",
			actions: [{ tool: "assert", type: "file-exists", path: "/missing" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("File not found");
	});

	it("file-contains passes when file has expected content", async () => {
		const deps = createMockDeps({ readFile: vi.fn(() => "foo bar baz") });
		const journey = minimalJourney([{
			id: "s1", title: "File content", description: "",
			actions: [{ tool: "assert", type: "file-contains", path: "/f", contains: "bar" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
	});

	it("file-contains fails on missing content", async () => {
		const deps = createMockDeps({ readFile: vi.fn(() => "nope") });
		const journey = minimalJourney([{
			id: "s1", title: "File content", description: "",
			actions: [{ tool: "assert", type: "file-contains", path: "/f", contains: "missing" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
	});

	it("file-contains handles read errors", async () => {
		const deps = createMockDeps({ readFile: vi.fn(() => { throw new Error("ENOENT"); }) });
		const journey = minimalJourney([{
			id: "s1", title: "Bad file", description: "",
			actions: [{ tool: "assert", type: "file-contains", path: "/f", contains: "x" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("Cannot read");
	});

	it("returns failure for unknown assert type", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Unknown", description: "",
			actions: [{ tool: "assert", type: "unknown-type" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("Unknown assert type");
	});
});

// ── Tool: wait ───────────────────────────────────────────────────────

describe("tool: wait", () => {
	it("calls sleep with specified ms", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Wait", description: "",
			actions: [{ tool: "wait", ms: 200 }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
		expect(deps.sleep).toHaveBeenCalledWith(200);
	});

	it("defaults to 100ms", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Wait", description: "",
			actions: [{ tool: "wait" }],
		}]);

		await executeJourney(journey, deps);
		expect(deps.sleep).toHaveBeenCalledWith(100);
	});
});

// ── Tool: log ────────────────────────────────────────────────────────

describe("tool: log", () => {
	it("logs the interpolated message", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Log", description: "",
			actions: [{ tool: "log", message: "Hello {{name}}" }],
		}]);

		const result = await executeJourney(journey, deps, { variables: { name: "World" } });
		expect(result.passed).toBe(1);
		expect(deps.log).toHaveBeenCalledWith("Hello World");
	});
});

// ── Tool: file-write ─────────────────────────────────────────────────

describe("tool: file-write", () => {
	it("writes content to a file", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Write", description: "",
			actions: [{ tool: "file-write", path: "/out.txt", content: "data" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
		expect(deps.writeFile).toHaveBeenCalledWith("/out.txt", "data");
	});

	it("returns failure on write error", async () => {
		const deps = createMockDeps({ writeFile: vi.fn(() => { throw new Error("EACCES"); }) });
		const journey = minimalJourney([{
			id: "s1", title: "Write", description: "",
			actions: [{ tool: "file-write", path: "/readonly", content: "x" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
	});
});

// ── Tool: file-read ──────────────────────────────────────────────────

describe("tool: file-read", () => {
	it("reads a file and stores result", async () => {
		const deps = createMockDeps({ readFile: vi.fn(() => "hello content") });
		const vars: Record<string, string> = {};
		const journey = minimalJourney([{
			id: "s1", title: "Read", description: "",
			actions: [{ tool: "file-read", path: "/input.txt", storeAs: "fileData" }],
		}]);

		const result = await executeJourney(journey, deps, { variables: vars });
		expect(result.passed).toBe(1);
		expect(vars.fileData).toBe("hello content");
	});

	it("returns failure on read error", async () => {
		const deps = createMockDeps({ readFile: vi.fn(() => { throw new Error("ENOENT"); }) });
		const journey = minimalJourney([{
			id: "s1", title: "Read", description: "",
			actions: [{ tool: "file-read", path: "/missing" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
	});
});

// ── Tool: file-exists ────────────────────────────────────────────────

describe("tool: file-exists", () => {
	it("passes when path exists", async () => {
		const deps = createMockDeps({ exists: vi.fn(() => true) });
		const journey = minimalJourney([{
			id: "s1", title: "Exists", description: "",
			actions: [{ tool: "file-exists", path: "/dir" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
	});

	it("fails when path does not exist", async () => {
		const deps = createMockDeps({ exists: vi.fn(() => false) });
		const journey = minimalJourney([{
			id: "s1", title: "Exists", description: "",
			actions: [{ tool: "file-exists", path: "/missing" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.steps[0].error).toContain("Path not found");
	});
});

// ── Tool: screenshot ─────────────────────────────────────────────────

describe("tool: screenshot", () => {
	it("is a no-op in CLI mode", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Screenshot", description: "",
			actions: [{ tool: "screenshot" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
		expect(result.steps[0].actions[0].output).toContain("skipped");
	});
});

// ── Unsupported tools ────────────────────────────────────────────────

describe("unsupported tools", () => {
	it("gracefully skips unknown Plugin tools", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Plugin step", description: "",
			actions: [{ tool: "obsidian-command", id: "flowti:open" }],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.passed).toBe(1);
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("unsupported"));
	});
});

// ── Variable interpolation ───────────────────────────────────────────

describe("variable interpolation", () => {
	it("interpolates {{var}} in action fields", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Interp", description: "",
			actions: [{ tool: "command", id: "echo {{msg}}" }],
		}]);

		await executeJourney(journey, deps, { variables: { msg: "hi" } });
		expect(deps.exec).toHaveBeenCalledWith("echo hi", expect.anything());
	});

	it("preserves unresolved variables", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Unresolved", description: "",
			actions: [{ tool: "command", id: "echo {{unknown}}" }],
		}]);

		await executeJourney(journey, deps, { variables: {} });
		expect(deps.exec).toHaveBeenCalledWith("echo {{unknown}}", expect.anything());
	});
});

// ── Journey lifecycle ────────────────────────────────────────────────

describe("journey lifecycle", () => {
	it("runs setup actions before steps", async () => {
		const callOrder: string[] = [];
		const deps = createMockDeps({
			exec: vi.fn(() => { callOrder.push("exec"); return { exitCode: 0, stdout: "", stderr: "" }; }),
			log: vi.fn((msg: string) => { callOrder.push(`log:${msg}`); }),
		});
		const journey = minimalJourney(
			[{ id: "s1", title: "Step", description: "", actions: [{ tool: "command", id: "test" }] }],
			{ setup: [{ tool: "log", message: "setup" }] },
		);

		await executeJourney(journey, deps);
		const setupIdx = callOrder.findIndex((c) => c === "log:setup");
		const stepIdx = callOrder.findIndex((c) => c.startsWith("log:[journey] Step:"));
		expect(setupIdx).toBeLessThan(stepIdx);
	});

	it("runs teardown actions after steps", async () => {
		const callOrder: string[] = [];
		const deps = createMockDeps({
			log: vi.fn((msg: string) => { callOrder.push(msg); }),
		});
		const journey = minimalJourney(
			[{ id: "s1", title: "Step", description: "", actions: [{ tool: "log", message: "step" }] }],
			{ teardown: [{ tool: "log", message: "teardown" }] },
		);

		await executeJourney(journey, deps);
		const stepIdx = callOrder.indexOf("step");
		const teardownIdx = callOrder.indexOf("teardown");
		expect(teardownIdx).toBeGreaterThan(stepIdx);
	});

	it("skips remaining steps when continueOnFailure is false", async () => {
		const deps = createMockDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "", stderr: "fail" })),
		});
		const journey = minimalJourney([
			{ id: "s1", title: "Fail", description: "", actions: [{ tool: "command", id: "bad" }] },
			{ id: "s2", title: "Skipped", description: "", actions: [{ tool: "command", id: "good" }] },
		]);

		const result = await executeJourney(journey, deps, { continueOnFailure: false });
		expect(result.failed).toBe(1);
		expect(result.skipped).toBe(1);
		expect(result.steps[1].status).toBe("skip");
	});

	it("continues after failure when continueOnFailure is true (default)", async () => {
		let callCount = 0;
		const deps = createMockDeps({
			exec: vi.fn(() => {
				callCount++;
				return callCount === 1
					? { exitCode: 1, stdout: "", stderr: "fail" }
					: { exitCode: 0, stdout: "ok", stderr: "" };
			}),
		});
		const journey = minimalJourney([
			{ id: "s1", title: "Fail", description: "", actions: [{ tool: "command", id: "bad" }] },
			{ id: "s2", title: "Pass", description: "", actions: [{ tool: "command", id: "good" }] },
		]);

		const result = await executeJourney(journey, deps);
		expect(result.failed).toBe(1);
		expect(result.passed).toBe(1);
		expect(result.skipped).toBe(0);
	});
});

// ── Result structure ─────────────────────────────────────────────────

describe("result structure", () => {
	it("includes correct totals", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([
			{ id: "s1", title: "One", description: "", actions: [{ tool: "log", message: "a" }] },
			{ id: "s2", title: "Two", description: "", actions: [{ tool: "log", message: "b" }] },
			{ id: "s3", title: "Three", description: "", actions: [{ tool: "log", message: "c" }] },
		]);

		const result = await executeJourney(journey, deps);
		expect(result.journeyName).toBe("test-journey");
		expect(result.totalSteps).toBe(3);
		expect(result.passed).toBe(3);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("step results include action details", async () => {
		const deps = createMockDeps();
		const journey = minimalJourney([{
			id: "s1", title: "Multi", description: "",
			actions: [
				{ tool: "log", message: "first" },
				{ tool: "log", message: "second" },
			],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.steps[0].actions).toHaveLength(2);
		expect(result.steps[0].actions[0].tool).toBe("log");
		expect(result.steps[0].actions[1].tool).toBe("log");
	});

	it("stops step on first action failure", async () => {
		const deps = createMockDeps({ exists: vi.fn(() => false) });
		const journey = minimalJourney([{
			id: "s1", title: "Multi", description: "",
			actions: [
				{ tool: "file-exists", path: "/missing" },
				{ tool: "log", message: "should not run" },
			],
		}]);

		const result = await executeJourney(journey, deps);
		expect(result.steps[0].actions).toHaveLength(1);
		expect(result.steps[0].status).toBe("fail");
	});
});
