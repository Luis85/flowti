import { describe, it, expect } from "vitest";
import { createMockProc, MockExitError } from "../mocks/mock-proc.js";

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
});
