import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	config: {
		devtools: {
			commands: {
				reload: "node scripts/cli-reload.mjs",
				console: "obsidian dev:console",
				errors: "obsidian dev:errors",
				check: "npm run check",
				lint: "npm run lint",
				fixFrontmatter: "node scripts/fix-frontmatter.mjs",
				testdata: "node scripts/generate-test-data.mjs",
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

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/devtools/devtools.js";

beforeEach(() => vi.clearAllMocks());

describe("devtools commands", () => {
	it("dev:reload runs reload command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:reload"]();

		expect(sh.calls[0].cmd).toBe("node scripts/cli-reload.mjs");
	});

	it("dev:console runs console command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:console"]();

		expect(sh.calls[0].cmd).toBe("obsidian dev:console");
	});

	it("dev:errors runs errors command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:errors"]();

		expect(sh.calls[0].cmd).toBe("obsidian dev:errors");
	});

	it("dev:check runs check command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:check"]();

		expect(sh.calls[0].cmd).toBe("npm run check");
	});

	it("dev:lint runs lint command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:lint"]();

		expect(sh.calls[0].cmd).toBe("npm run lint");
	});

	it("dev:fix-frontmatter runs without dry-run by default", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:fix-frontmatter"]({});

		expect(sh.calls[0].cmd).toBe("node scripts/fix-frontmatter.mjs");
	});

	it("dev:fix-frontmatter passes dry-run flag", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:fix-frontmatter"]({ "dry-run": true });

		expect(sh.calls[0].cmd).toBe("node scripts/fix-frontmatter.mjs --dry-run");
	});

	it("dev:testdata runs testdata command", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["dev:testdata"]();

		expect(sh.calls[0].cmd).toBe("node scripts/generate-test-data.mjs");
	});
});
