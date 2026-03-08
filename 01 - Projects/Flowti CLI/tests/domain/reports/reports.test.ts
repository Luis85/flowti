import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	ROOT: "/mock/root",
	config: {
		reports: {
			allCommand: "npm run generate:reports",
			scripts: [
				{ id: "test", label: "Test Report", script: "generate-test-report.mjs" },
				{ id: "coverage", label: "Coverage Report", script: "generate-coverage-report.mjs" },
			],
		},
	},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
	printHeader: vi.fn(),
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
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

vi.mock("../../../src/infrastructure/fs.js", () => ({
	findLatestReport: vi.fn(),
	parseFrontmatter: vi.fn(() => ({})),
}));

vi.mock("../../../src/infrastructure/document.js", () => ({
	Document: {
		create: vi.fn(() => ({
			mergeFrontmatter: vi.fn().mockReturnThis(),
			setTags: vi.fn().mockReturnThis(),
			addBlank: vi.fn().mockReturnThis(),
			heading: vi.fn().mockReturnThis(),
			quote: vi.fn().mockReturnThis(),
			text: vi.fn().mockReturnThis(),
			table: vi.fn().mockReturnThis(),
			save: vi.fn(),
		})),
	},
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { commands } from "../../../src/domain/reports/reports.js";

beforeEach(() => vi.clearAllMocks());

describe("reports commands", () => {
	it("reports runs allCommand", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["reports"]();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run generate:reports");
	});

	it("reports:audit runs allCommand", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["reports:audit"]();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run generate:reports");
	});

	it("report:* runs matching script", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		commands["report:*"]({}, [], "report:test");

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("generate-test-report.mjs");
	});

	it("report:* logs error for unknown report", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;

		commands["report:*"]({}, [], "report:nonexistent");

		expect(sh.calls).toHaveLength(0);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Unknown report");
	});
});
