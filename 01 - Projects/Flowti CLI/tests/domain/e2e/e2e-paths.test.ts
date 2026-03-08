import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: {
		env: vi.fn(() => ({})),
	},
}));

import { resolveE2EPaths } from "../../../src/domain/e2e/e2e-paths.js";
import { proc } from "../../../src/infrastructure/proc.js";

describe("resolveE2EPaths", () => {
	beforeEach(() => {
		vi.mocked(proc.env).mockReturnValue({} as NodeJS.ProcessEnv);
	});

	it("resolves all required path fields", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.projectRoot).toBe("/project");
		expect(e2e.pluginId).toBe("flowti-ibde");
		expect(e2e.journeysDir).toBe("/project/tests/e2e/journeys");
		expect(e2e.vaultName).toBe("flowti-e2e");
		expect(e2e.pluginArtifacts).toEqual(["main.js", "manifest.json", "styles.css"]);
	});

	it("uses default test vault convention (sibling to vault root)", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.testVault).toBe("/vault/../flowti-e2e");
		expect(e2e.vaultName).toBe("flowti-e2e");
	});

	it("uses review config pluginId when provided", () => {
		const e2e = resolveE2EPaths("/project", { pluginId: "my-plugin" });
		expect(e2e.pluginId).toBe("my-plugin");
		expect(e2e.pluginDir).toContain("my-plugin");
	});

	it("uses review config journeysDir when provided", () => {
		const e2e = resolveE2EPaths("/project", { journeysDir: "e2e/journeys" });
		expect(e2e.journeysDir).toBe("/project/e2e/journeys");
	});

	it("uses review config testVault when provided", () => {
		const e2e = resolveE2EPaths("/project", { testVault: "my-test-vault" });
		expect(e2e.testVault).toBe("/vault/my-test-vault");
	});

	it("uses E2E_VAULT_DIR env var when set", () => {
		vi.mocked(proc.env).mockReturnValue({ E2E_VAULT_DIR: "/custom/vault" } as unknown as NodeJS.ProcessEnv);
		const e2e = resolveE2EPaths("/project");
		expect(e2e.testVault).toBe("/custom/vault");
	});

	it("env var takes precedence over review config", () => {
		vi.mocked(proc.env).mockReturnValue({ E2E_VAULT_DIR: "/env-vault" } as unknown as NodeJS.ProcessEnv);
		const e2e = resolveE2EPaths("/project", { testVault: "config-vault" });
		expect(e2e.testVault).toBe("/env-vault");
	});

	it("resolves pluginDir inside test vault", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.pluginDir).toContain(".obsidian/plugins/flowti-ibde");
	});

	it("resolves dataJsonPath inside plugin dir", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.dataJsonPath).toContain("data.json");
	});

	it("resolves reports and dev paths", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.reportsDir).toBe("/project/docs/reports");
		expect(e2e.devRunsDir).toBe("/project/docs/reports/e2e/runs");
		expect(e2e.devTracesDir).toBe("/project/docs/reports/e2e/traces");
		expect(e2e.devJourneysDir).toBe("/project/docs/journeys");
	});

	it("resolves vitest results path", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.vitestResults).toContain("e2e-results.json");
	});

	it("includes dataJsonCandidates array", () => {
		const e2e = resolveE2EPaths("/project");
		expect(e2e.dataJsonCandidates).toHaveLength(2);
		expect(e2e.dataJsonCandidates[0]).toContain("data.json");
		expect(e2e.dataJsonCandidates[1]).toContain("data.json");
	});
});
