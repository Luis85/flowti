import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

vi.mock("../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { execSync } from "node:child_process";
import { shell } from "../../src/infrastructure/shell.js";

const mockedExec = vi.mocked(execSync);

describe("shell.run", () => {
	it("returns 0 on success", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		expect(shell.run("npm test")).toBe(0);
	});

	it("uses CLI_PROJECT as default cwd", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test");
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
	});

	it("uses provided cwd", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		shell.run("npm test", { cwd: "/other" });
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/other" }));
	});

	it("returns exit code on failure", () => {
		mockedExec.mockImplementation(() => { throw { status: 42 }; });
		expect(shell.run("bad-cmd")).toBe(42);
	});

	it("returns 1 when status is undefined", () => {
		mockedExec.mockImplementation(() => { throw new Error("oops"); });
		expect(shell.run("bad-cmd")).toBe(1);
	});
});

describe("shell.runSilent", () => {
	it("returns trimmed output on success", () => {
		mockedExec.mockReturnValue("  v24.12.0\n" as unknown as Buffer);
		expect(shell.runSilent("node --version")).toBe("v24.12.0");
	});

	it("returns null on failure", () => {
		mockedExec.mockImplementation(() => { throw new Error("fail"); });
		expect(shell.runSilent("bad-cmd")).toBeNull();
	});

	it("uses CLI_PROJECT as default cwd", () => {
		mockedExec.mockReturnValue("output" as unknown as Buffer);
		shell.runSilent("git status");
		expect(mockedExec).toHaveBeenCalledWith("git status", expect.objectContaining({ cwd: "/project" }));
	});
});

describe("shell.check", () => {
	it("returns true when command succeeds", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		expect(shell.check("git --version")).toBe(true);
	});

	it("returns false when command fails", () => {
		mockedExec.mockImplementation(() => { throw new Error("not found"); });
		expect(shell.check("nonexistent")).toBe(false);
	});
});
