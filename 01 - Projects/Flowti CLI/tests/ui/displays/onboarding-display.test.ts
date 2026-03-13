import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	renderPrerequisiteIssues,
	renderDependencyResult,
	renderDependencyNeeded,
	renderFirstRunStatus,
	renderPostBuildGuidance,
} from "../../../src/ui/displays/onboarding-display.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderPrerequisiteIssues ─────────────────────────────────────────

describe("renderPrerequisiteIssues", () => {
	it("does nothing when no missing prerequisites", () => {
		renderPrerequisiteIssues([]);
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("renders missing prerequisites with names and instructions", () => {
		renderPrerequisiteIssues([
			{ name: "Node.js", instruction: "Install from nodejs.org" },
			{ name: "Git", instruction: "Install from git-scm.com" },
		]);
		const out = output();
		expect(out).toContain("Missing prerequisites:");
		expect(out).toContain("✗");
		expect(out).toContain("Node.js");
		expect(out).toContain("Install from nodejs.org");
		expect(out).toContain("Git");
		expect(out).toContain("Install from git-scm.com");
		expect(out).toContain("Install the above, then run flowti again.");
	});

	it("renders single prerequisite", () => {
		renderPrerequisiteIssues([{ name: "npm", instruction: "Bundled with Node.js" }]);
		const out = output();
		expect(out).toContain("npm");
		expect(out).toContain("Bundled with Node.js");
	});
});

// ── renderDependencyResult ───────────────────────────────────────────

describe("renderDependencyResult", () => {
	it("does nothing when already present", () => {
		renderDependencyResult({ installed: true, alreadyPresent: true });
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("renders success when installed", () => {
		renderDependencyResult({ installed: true, alreadyPresent: false });
		expect(output()).toContain("✓");
		expect(output()).toContain("Dependencies installed.");
	});

	it("renders failure when not installed", () => {
		renderDependencyResult({ installed: false, alreadyPresent: false });
		expect(output()).toContain("✗");
		expect(output()).toContain("npm install failed");
	});
});

// ── renderDependencyNeeded ───────────────────────────────────────────

describe("renderDependencyNeeded", () => {
	it("renders dependency needed message", () => {
		renderDependencyNeeded();
		const out = output();
		expect(out).toContain("Dependencies not installed.");
		expect(out).toContain("Running npm install...");
		expect(out).toContain("▸");
	});
});

// ── renderFirstRunStatus ─────────────────────────────────────────────

describe("renderFirstRunStatus", () => {
	it("renders build prompt when plugin not built", () => {
		renderFirstRunStatus({ pluginBuilt: false });
		expect(output()).toContain("Plugin not yet built.");
		expect(output()).toContain("Build");
	});

	it("does nothing when plugin is built", () => {
		renderFirstRunStatus({ pluginBuilt: true });
		expect(mockLog).not.toHaveBeenCalled();
	});
});

// ── renderPostBuildGuidance ──────────────────────────────────────────

describe("renderPostBuildGuidance", () => {
	it("does nothing when show is false", () => {
		renderPostBuildGuidance({ show: false, vaultRoot: "/vault" });
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("renders full guidance when show is true", () => {
		renderPostBuildGuidance({ show: true, vaultRoot: "/my/vault" });
		const out = output();
		expect(out).toContain("Plugin built successfully!");
		expect(out).toContain("Next steps:");
		expect(out).toContain("/my/vault");
		expect(out).toContain("Settings");
		expect(out).toContain("Community Plugins");
		expect(out).toContain("Installer Wizard");
	});
});
