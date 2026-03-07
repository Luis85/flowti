import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

vi.mock("../../src/infrastructure/config.js", () => ({
	ROOT: "/project",
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { execSync } from "node:child_process";
import { run, runIn, runSilent } from "../../src/infrastructure/shell.js";

const mockedExec = vi.mocked(execSync);

describe("run", () => {
	it("returns 0 on success", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		expect(run("npm test")).toBe(0);
	});

	it("calls execSync with ROOT as cwd", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		run("npm test");
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
	});

	it("returns exit code on failure", () => {
		mockedExec.mockImplementation(() => { throw { status: 42 }; });
		expect(run("bad-cmd")).toBe(42);
	});

	it("returns 1 when status is undefined", () => {
		mockedExec.mockImplementation(() => { throw new Error("oops"); });
		expect(run("bad-cmd")).toBe(1);
	});
});

describe("runIn", () => {
	it("returns 0 on success", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		expect(runIn("npm test", "/other")).toBe(0);
	});

	it("uses provided cwd", () => {
		mockedExec.mockReturnValue(Buffer.from(""));
		runIn("npm test", "/other");
		expect(mockedExec).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/other" }));
	});
});

describe("runSilent", () => {
	it("returns trimmed output on success", () => {
		mockedExec.mockReturnValue("  v24.12.0\n" as unknown as Buffer);
		expect(runSilent("node --version")).toBe("v24.12.0");
	});

	it("returns null on failure", () => {
		mockedExec.mockImplementation(() => { throw new Error("fail"); });
		expect(runSilent("bad-cmd")).toBeNull();
	});
});
