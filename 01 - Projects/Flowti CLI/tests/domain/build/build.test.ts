import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";
import { initializeDeps } from "../../../src/infrastructure/request-response.js";
import { createTestDeps } from "../../mocks/mock-deps.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

import { commands } from "../../../src/controller/build.controller.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function setupShell(opts?: Parameters<typeof createMockShell>[0]) {
	const sh = createMockShell(opts);
	const deps = createTestDeps();
	(deps as Record<string, unknown>).shell = sh;
	initializeDeps(deps);
	return sh;
}

/** Create a project context with the given npm scripts. */
function makeProject(scripts: Record<string, string> = {}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0", scripts },
		config: { name: "test" },
		scripts,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("build commands", () => {
	it("build runs npm run build in project dir", () => {
		const sh = setupShell();
		const project = makeProject({ build: "esbuild" });

		commands["build"]({}, [], "build", project);

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run build");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("build:increment uses build:increment script when available", () => {
		const sh = setupShell();
		const project = makeProject({ "build:increment": "npm run check && npm run build" });

		commands["build:increment"]({}, [], "build:increment", project);

		expect(sh.calls[0].cmd).toBe("npm run build:increment");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("build:increment falls back to build when no increment script", () => {
		const sh = setupShell();
		const project = makeProject({ build: "esbuild" });

		commands["build:increment"]({}, [], "build:increment", project);

		expect(sh.calls[0].cmd).toBe("npm run build");
	});

	it("build:full runs full build", () => {
		const sh = setupShell();
		const project = makeProject({ "build:full": "npm run test && npm run build" });

		commands["build:full"]({}, [], "build:full", project);

		expect(sh.calls[0].cmd).toBe("npm run build:full");
	});

	it("build:watch passes reload flag", () => {
		const sh = setupShell();
		const project = makeProject({ "build:dev": "esbuild --watch" });

		commands["build:watch"]({ reload: true }, [], "build:watch", project);

		expect(sh.calls[0].cmd).toContain("--reload");
	});

	it("build:watch uses build:dev script", () => {
		const sh = setupShell();
		const project = makeProject({ "build:dev": "esbuild --watch" });

		commands["build:watch"]({}, [], "build:watch", project);

		expect(sh.calls[0].cmd).toBe("npm run build:dev");
	});

	it("build:distribute runs distribute command", () => {
		const sh = setupShell();
		const project = makeProject({ "build:distribute": "esbuild --distribute" });

		commands["build:distribute"]({}, [], "build:distribute", project);

		expect(sh.calls[0].cmd).toBe("npm run build:distribute");
	});

	it("test runs npm test in project dir", () => {
		const sh = setupShell();
		const project = makeProject({ test: "vitest run" });

		commands["test"]({}, [], "test", project);

		expect(sh.calls[0].cmd).toBe("npm test");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("test:increment uses test:increment script when available", () => {
		const sh = setupShell();
		const project = makeProject({ "test:increment": "npm run check && vitest run" });

		commands["test:increment"]({}, [], "test:increment", project);

		expect(sh.calls[0].cmd).toBe("npm run test:increment");
	});

	it("test:e2e uses test:e2e script when available", () => {
		const sh = setupShell();
		const project = makeProject({ "test:e2e": "vitest run tests/e2e" });

		commands["test:e2e"]({}, [], "test:e2e", project);

		expect(sh.calls[0].cmd).toBe("npm run test:e2e");
	});
});
