import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/mock/plugin",
	VAULT_ROOT: "/mock/vault",
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/proc.js", () => {
	const env: Record<string, string | undefined> = {};
	return { proc: { env: () => env, exit: vi.fn() } };
});

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

vi.mock("../../../src/domain/e2e/e2e-runner.js", () => ({
	runVitest: vi.fn(() => 0),
	generateReportAndOpen: vi.fn(),
}));

vi.mock("../../../src/ui/e2e/e2e-interactive.js", () => ({
	interactiveSession: vi.fn(async () => {}),
}));

import { initE2EPaths, getE2EPaths } from "../../../src/domain/e2e/E2EService.js";

describe("E2EService", () => {
	describe("initE2EPaths", () => {
		it("initializes and returns E2E paths", () => {
			const e2e = initE2EPaths("/my/project");
			expect(e2e.projectRoot).toBe("/my/project");
			expect(e2e.pluginId).toBe("flowti-ibde");
		});

		it("uses review config when provided", () => {
			const e2e = initE2EPaths("/my/project", { pluginId: "custom-plugin" });
			expect(e2e.pluginId).toBe("custom-plugin");
		});
	});

	describe("getE2EPaths", () => {
		it("returns initialized paths after init", () => {
			initE2EPaths("/project-a");
			const e2e = getE2EPaths();
			expect(e2e.projectRoot).toBe("/project-a");
		});

		it("returns same paths on repeated calls", () => {
			initE2EPaths("/project-b");
			const e2e1 = getE2EPaths();
			const e2e2 = getE2EPaths();
			expect(e2e1).toBe(e2e2);
		});
	});
});
