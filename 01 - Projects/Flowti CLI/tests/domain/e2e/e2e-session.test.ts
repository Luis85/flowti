import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		readdirSync: vi.fn(() => []),
		readFileSync: vi.fn(() => "{}"),
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
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

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-08T12:00:00Z"),
		ms: () => Date.now(),
		iso: () => "2026-03-08T12:00:00.000Z",
		safeIso: () => "2026-03-08T12-00-00",
	},
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), askYesNo: vi.fn() },
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { proc } from "../../../src/infrastructure/proc.js";
import { clock } from "../../../src/infrastructure/clock.js";
import {
	loadJourneyEntries,
	resolveJourneyNames,
	rerunWithFreshTimestamp,
	configureSessionEnv,
	cleanSessionEnv,
	buildStepFilterEnv,
} from "../../../src/domain/e2e/e2e-session.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";
import type { SessionConfig, JourneyEntry } from "../../../src/domain/e2e/e2e-types.js";

const deps = { disk, paths, proc, clock } as any;

const mockE2e: E2EPaths = {
	projectRoot: "/project",
	pluginId: "flowti-ibde",
	journeysDir: "/project/tests/e2e/journeys",
	testVault: "/vault-e2e",
	vaultName: "vault-e2e",
	pluginDir: "/vault-e2e/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault-e2e/.obsidian/plugins/flowti-ibde/data.json",
	pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
	testDataCsv: "/vault-e2e/data.csv",
	reportsDir: "/project/docs/reports",
	devRunsDir: "/project/docs/reports/e2e/runs",
	devTracesDir: "/project/docs/reports/e2e/traces",
	devJourneysDir: "/project/docs/journeys",
	vitestResults: "/project/docs/reports/e2e/e2e-results.json",
	dataJsonCandidates: [],
};

describe("loadJourneyEntries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns empty array when no journey files", () => {
		vi.mocked(disk.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof disk.readdirSync>);
		const entries = loadJourneyEntries(mockE2e, deps);
		expect(entries).toEqual([]);
	});

	it("parses journey files correctly", () => {
		vi.mocked(disk.readdirSync).mockReturnValue(["login.journey", "setup.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.readFileSync)
			.mockReturnValueOnce(JSON.stringify({ journey: "Login Flow", chapter: 1, description: "Test login", steps: [{ id: 1 }, { id: 2 }] }))
			.mockReturnValueOnce(JSON.stringify({ journey: "Setup", chapter: 2, description: "Test setup", steps: [{ id: 1 }] }));

		const entries = loadJourneyEntries(mockE2e, deps);
		expect(entries).toHaveLength(2);
		expect(entries[0].slug).toBe("login");
		expect(entries[0].name).toBe("Login Flow");
		expect(entries[0].steps).toBe(2);
		expect(entries[1].slug).toBe("setup");
		expect(entries[1].name).toBe("Setup");
		expect(entries[1].steps).toBe(1);
	});

	it("filters to only .journey files", () => {
		vi.mocked(disk.readdirSync).mockReturnValue(["test.journey", "readme.md", "config.json"] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ journey: "Test", steps: [] }));

		const entries = loadJourneyEntries(mockE2e, deps);
		expect(entries).toHaveLength(1);
	});

	it("uses slug as name when journey field is missing", () => {
		vi.mocked(disk.readdirSync).mockReturnValue(["unnamed.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ steps: [] }));

		const entries = loadJourneyEntries(mockE2e, deps);
		expect(entries[0].name).toBe("unnamed");
	});
});

describe("resolveJourneyNames", () => {
	const entries: JourneyEntry[] = [
		{ slug: "login", name: "Login Flow", chapter: "1", steps: 5, description: "" },
		{ slug: "setup", name: "Setup", chapter: "2", steps: 3, description: "" },
	];

	it("maps slugs to names", () => {
		const names = resolveJourneyNames(["login", "setup"], entries);
		expect(names).toEqual(["Login Flow", "Setup"]);
	});

	it("returns slug when entry not found", () => {
		const names = resolveJourneyNames(["login", "unknown"], entries);
		expect(names).toEqual(["Login Flow", "unknown"]);
	});

	it("handles empty slugs array", () => {
		const names = resolveJourneyNames([], entries);
		expect(names).toEqual([]);
	});
});

describe("rerunWithFreshTimestamp", () => {
	const entries: JourneyEntry[] = [
		{ slug: "a", name: "A", chapter: "1", steps: 1, description: "" },
		{ slug: "b", name: "B", chapter: "1", steps: 1, description: "" },
	];

	it("returns new config with fresh session name", () => {
		const prev: SessionConfig = {
			sessionName: "old-session",
			selectedSlugs: ["a"],
			includeInstaller: false,
			includePrerequisites: false,
			stepFilter: {},
		};

		const result = rerunWithFreshTimestamp(prev, entries, deps);
		expect(result.sessionName).not.toBe("old-session");
		expect(result.sessionName).toContain("a");
		expect(result.selectedSlugs).toEqual(["a"]);
	});

	it("uses 'all' suffix when all journeys selected", () => {
		const prev: SessionConfig = {
			sessionName: "old",
			selectedSlugs: ["a", "b"],
			includeInstaller: false,
			includePrerequisites: false,
			stepFilter: {},
		};

		const result = rerunWithFreshTimestamp(prev, entries, deps);
		expect(result.sessionName).toContain("all");
	});

	it("uses joined slugs when subset selected", () => {
		const prev: SessionConfig = {
			sessionName: "old",
			selectedSlugs: ["a"],
			includeInstaller: false,
			includePrerequisites: false,
			stepFilter: {},
		};

		const result = rerunWithFreshTimestamp(prev, entries, deps);
		expect(result.sessionName).toContain("a");
		expect(result.sessionName).not.toContain("all");
	});

	it("preserves other config fields", () => {
		const prev: SessionConfig = {
			sessionName: "old",
			selectedSlugs: ["a"],
			includeInstaller: true,
			includePrerequisites: true,
			stepFilter: { a: "all" },
		};

		const result = rerunWithFreshTimestamp(prev, entries, deps);
		expect(result.includeInstaller).toBe(true);
		expect(result.includePrerequisites).toBe(true);
		expect(result.stepFilter).toEqual({ a: "all" });
	});
});

describe("buildStepFilterEnv", () => {
	it("returns null when all filters are 'all'", () => {
		expect(buildStepFilterEnv({ a: "all", b: "all" })).toBeNull();
	});

	it("returns null for empty filter", () => {
		expect(buildStepFilterEnv({})).toBeNull();
	});

	it("builds env string for specific step selections", () => {
		const result = buildStepFilterEnv({ login: ["step-1", "step-2"], setup: "all" });
		expect(result).toBe("login:step-1,step-2");
	});

	it("joins multiple journey step filters with semicolons", () => {
		const result = buildStepFilterEnv({ login: ["step-1"], setup: ["step-a", "step-b"] });
		expect(result).toBe("login:step-1;setup:step-a,step-b");
	});

	it("skips empty arrays", () => {
		const result = buildStepFilterEnv({ login: [], setup: ["step-1"] });
		expect(result).toBe("setup:step-1");
	});
});

describe("configureSessionEnv", () => {
	beforeEach(() => {
		const env = proc.env();
		delete env.E2E_JOURNEY;
		delete env.E2E_SESSION_NAME;
		delete env.E2E_RUN_INSTALLER;
		delete env.E2E_RUN_PREREQUISITES;
		delete env.E2E_STEPS;
	});

	it("sets E2E_JOURNEY with selected slugs", () => {
		configureSessionEnv({
			sessionName: "test",
			selectedSlugs: ["login", "setup"],
			includeInstaller: false,
			includePrerequisites: false,
			stepFilter: {},
		}, deps);
		expect(proc.env().E2E_JOURNEY).toBe("login,setup");
	});

	it("sets session name", () => {
		configureSessionEnv({
			sessionName: "my-session",
			selectedSlugs: ["a"],
			includeInstaller: false,
			includePrerequisites: false,
			stepFilter: {},
		}, deps);
		expect(proc.env().E2E_SESSION_NAME).toBe("my-session");
	});

	it("prepends installer when includeInstaller is true", () => {
		configureSessionEnv({
			sessionName: "test",
			selectedSlugs: ["setup"],
			includeInstaller: true,
			includePrerequisites: false,
			stepFilter: {},
		}, deps);
		expect(proc.env().E2E_JOURNEY).toBe("installer,setup");
		expect(proc.env().E2E_RUN_INSTALLER).toBe("true");
	});

	it("does not duplicate installer if already in slugs", () => {
		configureSessionEnv({
			sessionName: "test",
			selectedSlugs: ["installer", "setup"],
			includeInstaller: true,
			includePrerequisites: false,
			stepFilter: {},
		}, deps);
		expect(proc.env().E2E_JOURNEY).toBe("installer,setup");
	});

	it("sets prerequisites env when includePrerequisites is true", () => {
		configureSessionEnv({
			sessionName: "test",
			selectedSlugs: ["a"],
			includeInstaller: false,
			includePrerequisites: true,
			stepFilter: {},
		}, deps);
		expect(proc.env().E2E_RUN_PREREQUISITES).toBe("true");
	});

	it("sets step filter env when steps are filtered", () => {
		configureSessionEnv({
			sessionName: "test",
			selectedSlugs: ["login"],
			includeInstaller: false,
			includePrerequisites: false,
			stepFilter: { login: ["step-1", "step-2"] },
		}, deps);
		expect(proc.env().E2E_STEPS).toBe("login:step-1,step-2");
	});
});

describe("cleanSessionEnv", () => {
	it("removes all E2E env vars", () => {
		const env = proc.env();
		env.E2E_JOURNEY = "login";
		env.E2E_SESSION_NAME = "test";
		env.E2E_RUN_INSTALLER = "true";
		env.E2E_RUN_PREREQUISITES = "true";
		env.E2E_STEPS = "login:step-1";

		cleanSessionEnv(deps);

		expect(env.E2E_JOURNEY).toBeUndefined();
		expect(env.E2E_SESSION_NAME).toBeUndefined();
		expect(env.E2E_RUN_INSTALLER).toBeUndefined();
		expect(env.E2E_RUN_PREREQUISITES).toBeUndefined();
		expect(env.E2E_STEPS).toBeUndefined();
	});
});
