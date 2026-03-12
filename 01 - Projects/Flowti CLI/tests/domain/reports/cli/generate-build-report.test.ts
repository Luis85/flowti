import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
		unlinkSync: vi.fn(),
	},
}));
vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/project",
}));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2026-01-01T00:00:00.000Z",
		ms: () => 1000000,
		now: () => new Date("2026-01-01T00:00:00.000Z"),
		safeIso: () => "2026-01-01T00-00-00.000Z",
	},
}));
// Inline shell mock: per-test vi.mocked(shell.runSilent) overrides require vi.fn().
// See tests/mocks/mock-presets.ts for the standard mockShellPreset() factory.
vi.mock("../../../../src/infrastructure/shell.js", () => ({
	shell: {
		runSilent: vi.fn(() => "build output"),
	},
}));
vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));
vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: { reports: { dir: "reports" }, docs: { referenceDir: "docs/reference" } } })),
}));
vi.mock("../../../../src/domain/build/build-freshness.js", () => ({
	recordBuild: vi.fn(),
	resolveBuildPaths: vi.fn(() => ({ srcDir: "/project/src", binDir: "/project/dist" })),
}));

import { shell } from "../../../../src/infrastructure/shell.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { log } from "../../../../src/infrastructure/logger.js";
import { recordBuild } from "../../../../src/domain/build/build-freshness.js";
import { buildWithReport } from "../../../../src/domain/reports/cli/generate-build-report.js";

function buildDeps() { return { disk, paths, clock, shell, log } as const; }

beforeEach(() => {
	vi.clearAllMocks();
});

describe("buildWithReport", () => {
	it("returns 0 on successful build", () => {
		vi.mocked(shell.runSilent).mockReturnValue("compiled successfully");

		const exitCode = buildWithReport("tsc", "/project", buildDeps());

		expect(exitCode).toBe(0);
	});

	it("returns 1 on failed build", () => {
		vi.mocked(shell.runSilent).mockReturnValue(null);

		const exitCode = buildWithReport("tsc", "/project", buildDeps());

		expect(exitCode).toBe(1);
	});

	it("records build on success", () => {
		vi.mocked(shell.runSilent).mockReturnValue("ok");

		buildWithReport("tsc", "/project", buildDeps());

		expect(recordBuild).toHaveBeenCalled();
	});

	it("does not record build on failure", () => {
		vi.mocked(shell.runSilent).mockReturnValue(null);

		buildWithReport("tsc", "/project", buildDeps());

		expect(recordBuild).not.toHaveBeenCalled();
	});

	it("writes build JSON and report markdown then cleans up JSON", () => {
		vi.mocked(shell.runSilent).mockReturnValue("ok");

		buildWithReport("npm run build", "/project", buildDeps());

		expect(disk.writeFileSync).toHaveBeenCalled();
		expect(disk.unlinkSync).toHaveBeenCalled();
	});

	it("passes cwd to shell.runSilent", () => {
		vi.mocked(shell.runSilent).mockReturnValue("ok");

		buildWithReport("tsc", "/my/project", buildDeps());

		expect(shell.runSilent).toHaveBeenCalledWith("tsc", { cwd: "/my/project" });
	});
});
