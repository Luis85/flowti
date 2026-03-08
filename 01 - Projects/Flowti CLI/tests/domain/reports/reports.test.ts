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

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", now: () => new Date("2026-01-01") },
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
		relative: (from: string, to: string) => to,
	},
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

describe("menu", () => {
	it("calls runMenu with Reports title", async () => {
		const { runMenu } = await import("../../../src/infrastructure/menu.js");
		vi.mocked(runMenu).mockResolvedValue("main");

		const { menu } = await import("../../../src/domain/reports/reports.js");
		await menu();

		expect(runMenu).toHaveBeenCalledWith("Reports", expect.any(Array));
	});
});

describe("getReportScripts (via report:* command)", () => {
	it("returns configured scripts from config", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });

		// The config mock has two scripts: test and coverage
		commands["report:*"]({}, [], "report:coverage");

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("generate-coverage-report.mjs");
	});
});

describe("collectAuditSections", () => {
	it("collects sections from categories and stable reports via auditMenu", async () => {
		const { findLatestReport, parseFrontmatter } = await import("../../../src/infrastructure/fs.js");
		const { input } = await import("../../../src/infrastructure/input.js");
		const { Document } = await import("../../../src/infrastructure/document.js");
		const { disk } = await import("../../../src/infrastructure/filesystem.js");

		vi.mocked(findLatestReport).mockReturnValue("/mock/report.md");
		vi.mocked(parseFrontmatter).mockReturnValue({ passed: "42", failed: "0" });
		vi.mocked(input.ask).mockResolvedValue("test-audit");
		Object.assign(disk, {
			existsSync: vi.fn(() => true),
			mkdirSync: vi.fn(),
		});

		const { menu } = await import("../../../src/domain/reports/reports.js");
		const { runMenu } = await import("../../../src/infrastructure/menu.js");

		// Capture the menu items so we can invoke the audit action
		let menuItems: Array<{ key?: string; action?: () => unknown }> = [];
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			menuItems = items as typeof menuItems;
			// Invoke the "Build audit report" action (key "3")
			const auditItem = menuItems.find((i) => i.key === "3");
			if (auditItem?.action) await auditItem.action();
			return "main";
		});

		await menu();

		// parseFrontmatter should have been called for each category + stable report
		expect(parseFrontmatter).toHaveBeenCalled();
		// Document.create should have been called with the audit name
		expect(Document.create).toHaveBeenCalledWith("test-audit");
	});

	it("handles missing reports gracefully", async () => {
		const { findLatestReport, parseFrontmatter } = await import("../../../src/infrastructure/fs.js");
		const { input } = await import("../../../src/infrastructure/input.js");
		const { disk } = await import("../../../src/infrastructure/filesystem.js");

		vi.mocked(findLatestReport).mockReturnValue(null as unknown as string);
		vi.mocked(parseFrontmatter).mockReturnValue({});
		vi.mocked(input.ask).mockResolvedValue("empty-audit");
		Object.assign(disk, {
			existsSync: vi.fn(() => false),
			mkdirSync: vi.fn(),
		});

		const { menu } = await import("../../../src/domain/reports/reports.js");
		const { runMenu } = await import("../../../src/infrastructure/menu.js");

		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const menuItems = items as Array<{ key?: string; action?: () => unknown }>;
			const auditItem = menuItems.find((i) => i.key === "3");
			if (auditItem?.action) await auditItem.action();
			return "main";
		});

		await menu();

		// With no reports found and no stable reports existing, parseFrontmatter
		// should not be called for stable reports (disk.existsSync returns false)
		// and findLatestReport returns null so categories are skipped
		expect(findLatestReport).toHaveBeenCalled();
	});
});
