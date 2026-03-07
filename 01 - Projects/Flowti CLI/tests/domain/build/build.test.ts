import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	config: {
		build: {
			commands: {
				fast: "node esbuild.config.mjs --production --no-reports",
				increment: "npm run build:increment",
				full: "npm run build:full",
				watch: "node esbuild.config.mjs --watch",
				distribute: "node esbuild.config.mjs --production --no-reports --distribution",
			},
		},
		test: {
			commands: {
				unit: "npm run check && vitest run",
				increment: "npm run test:increment",
				e2e: "npm run test:e2e",
			},
		},
	},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/readline.js", () => ({
	createRL: vi.fn(),
	ask: vi.fn(),
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/domain/help/help.js", () => ({
	showHelp: vi.fn(),
}));

vi.mock("../../../src/domain/onboarding/onboarding.js", () => ({
	showPostBuildGuidance: vi.fn(),
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { showPostBuildGuidance } from "../../../src/domain/onboarding/onboarding.js";
import { commands } from "../../../src/domain/build/build.js";

const mockGuidance = showPostBuildGuidance as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("build commands", () => {
	it("build runs fast build and shows guidance on success", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build"]();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("esbuild");
		expect(mockGuidance).toHaveBeenCalled();
	});

	it("build skips guidance on failure", () => {
		const sh = createMockShell({ exitCodes: { "node esbuild.config.mjs --production --no-reports": 1 } });
		Object.assign(shellMod, { shell: sh });

		commands["build"]();

		expect(mockGuidance).not.toHaveBeenCalled();
	});

	it("build:increment runs increment build", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:increment"]();

		expect(sh.calls[0].cmd).toBe("npm run build:increment");
	});

	it("build:full runs full build", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:full"]();

		expect(sh.calls[0].cmd).toBe("npm run build:full");
	});

	it("build:watch passes reload flag", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:watch"]({ reload: true });

		expect(sh.calls[0].cmd).toContain("--reload");
	});

	it("build:watch omits reload flag when not set", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:watch"]({});

		expect(sh.calls[0].cmd).not.toContain("--reload");
	});

	it("build:distribute runs distribute command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["build:distribute"]();

		expect(sh.calls[0].cmd).toContain("--distribution");
	});

	it("test runs unit tests", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["test"]();

		expect(sh.calls[0].cmd).toContain("vitest run");
	});

	it("test:increment runs increment tests", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["test:increment"]();

		expect(sh.calls[0].cmd).toBe("npm run test:increment");
	});

	it("test:e2e runs e2e tests", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["test:e2e"]();

		expect(sh.calls[0].cmd).toBe("npm run test:e2e");
	});
});
