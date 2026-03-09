import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn((code: number) => { throw new Error(`exit(${code})`); }) },
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/publish/publish.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

const mockLog = vi.mocked(log);

function makeProject(publish?: { build?: string; test?: string }): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0" },
		config: { name: "test", publish },
		scripts: {},
	};
}

beforeEach(() => vi.clearAllMocks());

describe("publish commands", () => {
	it("publish runs build command from config", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build:release" });

		commands["publish"]({}, [], "publish", project);

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run build:release");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("publish defaults to npm run build", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["publish"]({}, [], "publish", project);

		expect(sh.calls[0].cmd).toBe("npm run build");
	});

	it("publish:all runs build and test on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build", test: "npm test" });

		commands["publish:all"]({}, [], "publish:all", project);

		expect(sh.calls).toHaveLength(2);
		expect(sh.calls[0].cmd).toBe("npm run build");
		expect(sh.calls[1].cmd).toBe("npm test");
	});

	it("publish:all exits on build failure", () => {
		const sh = createMockShell({ exitCodes: { "npm run build": 1 } });
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build", test: "npm test" });

		expect(() => commands["publish:all"]({}, [], "publish:all", project)).toThrow("exit(1)");
		expect(sh.calls).toHaveLength(1);
	});

	it("publish:all exits on test failure", () => {
		const sh = createMockShell({ exitCodes: { "npm test": 1 } });
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build", test: "npm test" });

		expect(() => commands["publish:all"]({}, [], "publish:all", project)).toThrow("exit(1)");
		expect(sh.calls).toHaveLength(2);
	});
});

describe("publish --dry-run", () => {
	it("does not run any commands", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({
			build: "npm run build",
			test: "npm test",
		});
		(project.config as { publish: { build: string; test: string; outDir: string; endpoints: Array<{ name: string; path: string }> } }).publish = {
			build: "npm run build",
			test: "npm test",
			outDir: "dist",
			endpoints: [{ name: "local", path: "/target" }],
		};

		commands["publish"]({ "dry-run": true }, [], "publish", project);

		expect(sh.calls).toHaveLength(0);
	});

	it("logs the pipeline preview", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ build: "npm run build:release" });

		commands["publish"]({ "dry-run": true }, [], "publish", project);

		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("Dry run"))).toBe(true);
		expect(calls.some((m) => m.includes("npm run build:release"))).toBe(true);
	});

	it("shows endpoints when configured", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();
		(project.config as { publish: { outDir: string; endpoints: Array<{ name: string; path: string }> } }).publish = {
			outDir: "dist",
			endpoints: [
				{ name: "staging", path: "/staging" },
				{ name: "prod", path: "/prod" },
			],
		};

		commands["publish"]({ "dry-run": true }, [], "publish", project);

		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("staging"))).toBe(true);
		expect(calls.some((m) => m.includes("prod"))).toBe(true);
	});
});
