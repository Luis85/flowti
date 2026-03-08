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

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/devtools/devtools.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function makeProject(scripts: Record<string, string> = {}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0", scripts },
		config: { name: "test" },
		scripts,
	};
}

beforeEach(() => vi.clearAllMocks());

describe("devtools commands", () => {
	it("dev:reload runs reload command in project dir", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["dev:reload"]({}, [], "dev:reload", project);

		expect(sh.calls[0].cmd).toBe("node scripts/cli-reload.mjs");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("dev:console runs console command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:console"]({}, [], "dev:console");

		expect(sh.calls[0].cmd).toBe("obsidian dev:console");
	});

	it("dev:errors runs errors command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:errors"]({}, [], "dev:errors");

		expect(sh.calls[0].cmd).toBe("obsidian dev:errors");
	});

	it("dev:check runs npm run check when script exists", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ check: "eslint && tsc" });

		commands["dev:check"]({}, [], "dev:check", project);

		expect(sh.calls[0].cmd).toBe("npm run check");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("dev:check falls back to tsc when no check script", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["dev:check"]({}, [], "dev:check", project);

		expect(sh.calls[0].cmd).toBe("npx tsc --noEmit");
	});

	it("dev:lint runs npm run lint when script exists", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ lint: "eslint src/" });

		commands["dev:lint"]({}, [], "dev:lint", project);

		expect(sh.calls[0].cmd).toBe("npm run lint");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("dev:lint falls back to npx eslint when no lint script", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["dev:lint"]({}, [], "dev:lint", project);

		expect(sh.calls[0].cmd).toBe("npx eslint src/");
	});

	it("dev:fix-frontmatter runs without dry-run by default", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["dev:fix-frontmatter"]({}, [], "dev:fix-frontmatter", project);

		expect(sh.calls[0].cmd).toBe("node scripts/fix-frontmatter.mjs");
	});

	it("dev:fix-frontmatter passes dry-run flag", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["dev:fix-frontmatter"]({ "dry-run": true }, [], "dev:fix-frontmatter", project);

		expect(sh.calls[0].cmd).toBe("node scripts/fix-frontmatter.mjs --dry-run");
	});

	it("dev:testdata runs testdata command in project dir", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject();

		commands["dev:testdata"]({}, [], "dev:testdata", project);

		expect(sh.calls[0].cmd).toBe("node scripts/generate-test-data.mjs");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});
});
