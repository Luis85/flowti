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
import { commands } from "../../../src/domain/reports/reports.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function makeProject(opts?: {
	allCommand?: string;
	generators?: Array<{ label: string; command: string }>;
	tools?: Record<string, string>;
}): ProjectContext {
	return {
		path: "/test/project",
		pkg: { name: "test", version: "1.0.0" },
		config: {
			name: "test",
			reports: {
				allCommand: opts?.allCommand,
				generators: opts?.generators,
			},
			tools: opts?.tools,
		},
		scripts: {},
	};
}

beforeEach(() => vi.clearAllMocks());

describe("reports commands", () => {
	it("reports runs allCommand from project config", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ allCommand: "npm run generate:reports" });

		commands["reports"]({}, [], "reports", project);

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm run generate:reports");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("reports falls back to tools.reports", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({ tools: { reports: "npm run reports" } });

		commands["reports"]({}, [], "reports", project);

		expect(sh.calls[0].cmd).toBe("npm run reports");
	});

	it("reports:audit runs allCommand and logs success", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const project = makeProject({ allCommand: "npm run generate:reports" });

		commands["reports:audit"]({}, [], "reports:audit", project);

		expect(sh.calls).toHaveLength(1);
		expect(log).toHaveBeenCalled();
	});

	it("report:* runs matching generator by command content", () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const project = makeProject({
			generators: [
				{ label: "Test Report", command: "node scripts/generate-test-report.mjs" },
				{ label: "Coverage Report", command: "node scripts/generate-coverage-report.mjs" },
			],
		});

		commands["report:*"]({}, [], "report:test", project);

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("test-report");
		expect(sh.calls[0].opts?.cwd).toBe("/test/project");
	});

	it("report:* logs error for unknown report", async () => {
		const sh = createMockShell();
		Object.assign(shellMod, { shell: sh });
		const { log } = await import("../../../src/infrastructure/logger.js");
		const mockLog = log as ReturnType<typeof vi.fn>;
		const project = makeProject({
			generators: [{ label: "Test Report", command: "node scripts/generate-test-report.mjs" }],
		});

		commands["report:*"]({}, [], "report:nonexistent", project);

		expect(sh.calls).toHaveLength(0);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Unknown report");
	});
});
