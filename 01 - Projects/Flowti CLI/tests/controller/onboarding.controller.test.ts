import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	PROJECTS_DIR: "/vault/projects",
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/domain/onboarding/onboarding-detection.js", () => ({
	shouldOnboard: vi.fn(() => true),
	markOnboardingComplete: vi.fn(),
	resetOnboarding: vi.fn(),
}));
vi.mock("../../src/domain/onboarding/onboarding-store.js", () => ({
	readProgress: vi.fn(() => null),
	resetProgress: vi.fn(),
}));

import { commands } from "../../src/controller/onboarding.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { log } from "../../src/infrastructure/logger.js";
import { shouldOnboard, markOnboardingComplete, resetOnboarding } from "../../src/domain/onboarding/onboarding-detection.js";
import { readProgress, resetProgress } from "../../src/domain/onboarding/onboarding-store.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	initializeDeps({
		disk: { existsSync: vi.fn(), readdirSync: vi.fn(() => []) } as never,
		shell: {} as never,
		paths: { join: (...a: string[]) => a.join("/"), resolve: (...a: string[]) => a.join("/"), dirname: (p: string) => p, basename: (p: string) => p.split("/").pop() ?? p, relative: (_: string, b: string) => b, extname: () => "", isAbsolute: () => false, sep: "/" },
		clock: { iso: () => "2026-03-15T10:00:00.000Z", now: () => new Date(), ms: () => 0, safeIso: () => "2026-03-15" },
		proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
		input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
		bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
		log: mockLog as (msg?: string) => void, warn: vi.fn() as (msg: string) => void,
		worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
	});
});

describe("onboarding:status", () => {
	it("reports not started when no progress and should onboard", () => {
		commands["onboarding:status"]({}, [], "onboarding:status", undefined);
		expect(shouldOnboard).toHaveBeenCalledWith("/vault", "/vault/projects", expect.anything());
		expect(readProgress).toHaveBeenCalledWith("/vault", expect.anything());
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("not started"));
	});

	it("reports complete when not should onboard and no progress", () => {
		vi.mocked(shouldOnboard).mockReturnValue(false);
		commands["onboarding:status"]({}, [], "onboarding:status", undefined);
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("complete"));
	});

	it("reports in progress when progress exists", () => {
		vi.mocked(readProgress).mockReturnValue({
			tourId: "project-manager",
			currentStepIndex: 3,
			completedSteps: ["welcome", "tour-select", "pm-intro"],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		});
		commands["onboarding:status"]({}, [], "onboarding:status", undefined);
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("in progress"));
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("project-manager"));
	});
});

describe("onboarding:start", () => {
	it("reports Obsidian / plugin when no progress", () => {
		commands["onboarding:start"]({}, [], "onboarding:start", undefined);
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Obsidian"));
	});

	it("reports resume info when progress exists", () => {
		vi.mocked(readProgress).mockReturnValue({
			tourId: "project-manager",
			currentStepIndex: 3,
			completedSteps: ["welcome", "tour-select", "pm-intro"],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		});
		commands["onboarding:start"]({}, [], "onboarding:start", undefined);
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Resuming"));
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("project-manager"));
	});
});

describe("onboarding:skip", () => {
	it("marks onboarding as complete", () => {
		commands["onboarding:skip"]({}, [], "onboarding:skip", undefined);
		expect(markOnboardingComplete).toHaveBeenCalledWith("/vault", expect.anything());
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("complete"));
	});
});

describe("onboarding:restart", () => {
	it("resets both flag and progress", () => {
		commands["onboarding:restart"]({}, [], "onboarding:restart", undefined);
		expect(resetOnboarding).toHaveBeenCalledWith("/vault", expect.anything());
		expect(resetProgress).toHaveBeenCalledWith("/vault", expect.anything());
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("reset"));
	});
});
