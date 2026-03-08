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
import type { ProjectContext } from "../../../src/infrastructure/types.js";

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
