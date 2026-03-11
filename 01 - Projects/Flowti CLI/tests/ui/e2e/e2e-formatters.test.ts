import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { log } from "../../../src/infrastructure/logger.js";
import {
	printPrerequisites,
	printJourneyTable,
	printStepTable,
	printExecutionBanner,
	printSessionSummary,
	printIncrementSummary,
	printPublishSummary,
	printResultBanner,
	printSessionBanner,
	printMainMenu,
	printIncrementMenu,
} from "../../../src/ui/e2e/e2e-formatters.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

const e2e = {
	testVault: "/vault",
} as E2EPaths;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("printPrerequisites", () => {
	it("prints all passing prerequisites", () => {
		printPrerequisites({
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: true,
			testDataPresent: true,
		}, e2e);
		const out = output();
		expect(out).toContain("✓");
		expect(out).toContain("Test vault exists");
		expect(out).toContain("Plugin artifacts");
		expect(out).toContain("CLI responsive");
		expect(out).toContain("Vault installed");
		expect(out).toContain("Test data CSV");
	});

	it("prints failing prerequisites with ✗", () => {
		printPrerequisites({
			vaultExists: false,
			artifactsPresent: false,
			missingArtifacts: ["main.js", "manifest.json"],
			cliResponsive: false,
			vaultInstalled: false,
			testDataPresent: false,
		}, e2e);
		const out = output();
		expect(out).toContain("✗");
		expect(out).toContain("Test vault missing");
		expect(out).toContain("main.js, manifest.json");
		expect(out).toContain("not responsive");
		expect(out).toContain("not installed");
		expect(out).toContain("Test data missing");
	});
});

describe("printJourneyTable", () => {
	it("prints table header and entries", () => {
		printJourneyTable([
			{ slug: "a", name: "Alpha", chapter: "10", steps: 3, description: "First journey" },
			{ slug: "b", name: "Beta", chapter: "20", steps: 5, description: "Second journey" },
		]);
		const out = output();
		expect(out).toContain("Available Journeys");
		expect(out).toContain("Alpha");
		expect(out).toContain("Beta");
	});

	it("truncates long descriptions", () => {
		printJourneyTable([
			{ slug: "a", name: "Alpha", chapter: "10", steps: 3, description: "A".repeat(50) },
		]);
		const out = output();
		expect(out).toContain("...");
	});

	it("handles empty entries", () => {
		printJourneyTable([]);
		expect(output()).toContain("Available Journeys");
	});
});

describe("printStepTable", () => {
	it("prints steps with numbering", () => {
		const def = { journey: "Test", steps: [{ id: "s1", title: "Step 1" }, { id: "s2", title: "Step 2" }] };
		printStepTable(def, def.steps);
		const out = output();
		expect(out).toContain("Steps for Test");
		expect(out).toContain("Step 1");
		expect(out).toContain("Step 2");
	});

	it("prints setup and teardown steps", () => {
		const def = {
			journey: "Test",
			steps: [{ id: "s1", title: "Main" }],
			setup: [{ id: "setup-1", title: "Prepare" }],
			teardown: [{ id: "teardown-1", title: "Cleanup" }],
		};
		printStepTable(def, def.steps);
		const out = output();
		expect(out).toContain("Prepare");
		expect(out).toContain("[setup]");
		expect(out).toContain("Cleanup");
		expect(out).toContain("[teardown]");
	});
});

describe("printExecutionBanner", () => {
	it("prints session name and journey names", () => {
		printExecutionBanner(
			{ sessionName: "test-session", selectedSlugs: ["a", "b"], includeInstaller: false, includePrerequisites: false, stepFilter: {} },
			["Alpha", "Beta"],
		);
		const out = output();
		expect(out).toContain("test-session");
		expect(out).toContain("Alpha, Beta");
		expect(out).toContain("Installer");
		expect(out).toContain("no");
	});

	it("prints step filter details when present", () => {
		printExecutionBanner(
			{ sessionName: "s", selectedSlugs: ["a"], includeInstaller: true, includePrerequisites: true, stepFilter: { a: ["step-1", "step-2"] } },
			["Alpha"],
		);
		const out = output();
		expect(out).toContain("Steps (a)");
		expect(out).toContain("step-1, step-2");
		expect(out).toContain("yes");
		expect(out).toContain("force");
	});
});

describe("printSessionSummary", () => {
	it("prints summary with stats", () => {
		const startTime = Date.now() - 5000;
		printSessionSummary("my-session", ["Alpha"], startTime, { totalTests: 10, passed: 8, failed: 2, skipped: 0 });
		const out = output();
		expect(out).toContain("Session Summary");
		expect(out).toContain("my-session");
		expect(out).toContain("10 total");
		expect(out).toContain("8");
		expect(out).toContain("2");
	});
});

describe("printIncrementSummary", () => {
	it("prints pass status when exit code 0", () => {
		printIncrementSummary(0, "3.5", { build: { total_bytes: 51200 }, unitTests: { totalTests: 50, passed: 50, failed: 0, skipped: 0 }, coverage: { line_pct: 85 } });
		const out = output();
		expect(out).toContain("Increment Build Results");
		expect(out).toContain("PASS");
		expect(out).toContain("3.5s");
		expect(out).toContain("50 KB");
		expect(out).toContain("85%");
	});

	it("prints fail status when exit code non-zero", () => {
		printIncrementSummary(1, "2.0", { unitTests: { totalTests: 10, passed: 8, failed: 2, skipped: 0 } });
		const out = output();
		expect(out).toContain("FAIL");
	});

	it("handles missing build and coverage", () => {
		printIncrementSummary(0, "1.0", { unitTests: { totalTests: 0, passed: 0, failed: 0, skipped: 0 } });
		const out = output();
		expect(out).toContain("Increment Build Results");
	});
});

describe("printPublishSummary", () => {
	it("prints publish results", () => {
		printPublishSummary(0, "4.0", { build: { total_bytes: 102400, warnings_count: 1 }, unitTests: { totalTests: 100, passed: 100, failed: 0, skipped: 0 } });
		const out = output();
		expect(out).toContain("Publish Results");
		expect(out).toContain("PASS");
		expect(out).toContain("100 KB");
		expect(out).toContain("1");
	});
});

describe("printResultBanner", () => {
	it("prints label with pass icon", () => {
		printResultBanner("Build", 0);
		const out = output();
		expect(out).toContain("Build");
		expect(out).toContain("PASS");
	});

	it("prints label with fail icon", () => {
		printResultBanner("Tests", 1);
		const out = output();
		expect(out).toContain("Tests");
		expect(out).toContain("FAIL");
	});
});

describe("printSessionBanner", () => {
	it("prints session info with journey names", () => {
		printSessionBanner(
			{ sessionName: "test", selectedSlugs: ["a", "b"], includeInstaller: false, includePrerequisites: false, stepFilter: {} },
			[{ slug: "a", name: "Alpha", chapter: "10", steps: 3, description: "" }, { slug: "b", name: "Beta", chapter: "20", steps: 2, description: "" }],
			0,
		);
		const out = output();
		expect(out).toContain("test");
		expect(out).toContain("PASS");
		expect(out).toContain("Alpha, Beta");
	});

	it("uses slug as fallback when entry not found", () => {
		printSessionBanner(
			{ sessionName: "s", selectedSlugs: ["unknown"], includeInstaller: false, includePrerequisites: false, stepFilter: {} },
			[],
			1,
		);
		const out = output();
		expect(out).toContain("unknown");
		expect(out).toContain("FAIL");
	});
});

describe("printMainMenu", () => {
	it("prints all menu options", () => {
		printMainMenu(true);
		const out = output();
		expect(out).toContain("Start test session");
		expect(out).toContain("Build the increment");
		expect(out).toContain("Publish the increment");
		expect(out).toContain("Generate audit");
		expect(out).toContain("Teardown");
		expect(out).toContain("Rebuild");
		expect(out).toContain("Quit");
	});

	it("dims publish option when increment not passed", () => {
		printMainMenu(false);
		const out = output();
		expect(out).toContain("requires successful build");
	});
});

describe("printIncrementMenu", () => {
	it("shows publish option when exit code 0", () => {
		printIncrementMenu(0);
		const out = output();
		expect(out).toContain("Publish the increment");
		expect(out).not.toContain("requires successful build");
	});

	it("dims publish option when exit code non-zero", () => {
		printIncrementMenu(1);
		const out = output();
		expect(out).toContain("requires successful build");
	});
});
