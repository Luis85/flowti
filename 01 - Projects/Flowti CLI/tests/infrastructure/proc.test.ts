import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockProc, MockExitError } from "../mocks/mock-proc.js";
import { pidOps } from "../../src/infrastructure/proc.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createMockProc", () => {
	it("returns configured argv", () => {
		const p = createMockProc({ argv: ["build", "--fast"] });
		expect(p.argv()).toEqual(["build", "--fast"]);
	});

	it("returns empty argv by default", () => {
		const p = createMockProc();
		expect(p.argv()).toEqual([]);
	});

	it("returns configured cwd", () => {
		const p = createMockProc({ cwd: "/my/project" });
		expect(p.cwd()).toBe("/my/project");
	});

	it("returns default cwd", () => {
		const p = createMockProc();
		expect(p.cwd()).toBe("/mock/cwd");
	});

	it("exit throws MockExitError with code", () => {
		const p = createMockProc();
		expect(() => p.exit(42)).toThrow(MockExitError);
		try {
			p.exit(42);
		} catch (err) {
			expect((err as MockExitError).code).toBe(42);
		}
	});

	it("records exit codes", () => {
		const p = createMockProc();
		try { p.exit(0); } catch { /* expected */ }
		try { p.exit(1); } catch { /* expected */ }
		expect(p.exits).toEqual([0, 1]);
	});

	it("returns configured env variables", () => {
		const p = createMockProc({ env: { NODE_ENV: "test", FLOWTI_VAULT_ROOT: "/vault" } });
		expect(p.env()).toEqual({ NODE_ENV: "test", FLOWTI_VAULT_ROOT: "/vault" });
	});

	it("returns empty env by default", () => {
		const p = createMockProc();
		expect(p.env()).toEqual({});
	});

	it("MockExitError has correct name property", () => {
		const err = new MockExitError(1);
		expect(err.name).toBe("MockExitError");
		expect(err.message).toContain("process.exit(1)");
	});

	it("MockExitError is instance of Error", () => {
		const err = new MockExitError(0);
		expect(err).toBeInstanceOf(Error);
	});
});

// ── IProcess interface contract ────────────────────────────────────

describe("IProcess interface contract", () => {
	it("argv returns an array", () => {
		const p = createMockProc({ argv: ["build", "--watch"] });
		const args = p.argv();
		expect(Array.isArray(args)).toBe(true);
		expect(args).toEqual(["build", "--watch"]);
	});

	it("cwd returns a string", () => {
		const p = createMockProc({ cwd: "/my/dir" });
		expect(typeof p.cwd()).toBe("string");
	});

	it("exit throws and records each call", () => {
		const p = createMockProc();
		expect(() => p.exit(0)).toThrow(MockExitError);
		expect(() => p.exit(1)).toThrow(MockExitError);
		expect(() => p.exit(127)).toThrow(MockExitError);
		expect(p.exits).toEqual([0, 1, 127]);
	});
});

// ── pidOps ─────────────────────────────────────────────────────────

describe("pidOps", () => {
	describe("isPidAlive", () => {
		it("returns true for the current process PID", () => {
			expect(pidOps.isPidAlive(process.pid)).toBe(true);
		});

		it("returns false for an obviously dead PID", () => {
			expect(pidOps.isPidAlive(999999)).toBe(false);
		});
	});

	describe("killPid", () => {
		it("returns false for a non-existent PID", () => {
			expect(pidOps.killPid(999999)).toBe(false);
		});
	});

	describe("isPortListening", () => {
		it("returns false for an unbound port", async () => {
			expect(await pidOps.isPortListening(59999)).toBe(false);
		});
	});
});
