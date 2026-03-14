/**
 * info.controller.test.ts — Tests for the info controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/") },
}));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: {},
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	PLUGIN_ROOT: "/mock/plugin",
}));
vi.mock("../../src/domain/info/info.js", () => ({
	collectProjectInfo: vi.fn(() => ({
		name: "test-project",
		version: "1.0.0",
		path: "/project",
		tools: [],
	})),
}));
vi.mock("../../src/ui/displays/info-display.js", () => ({ displayInfo: vi.fn() }));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderNoProject: vi.fn(),
	renderError: vi.fn(),
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));

import { commands } from "../../src/controller/info.controller.js";
import { initializeDeps } from "../../src/infrastructure/request-response.js";
import { collectProjectInfo } from "../../src/domain/info/info.js";
import { displayInfo } from "../../src/ui/displays/info-display.js";
import { log } from "../../src/infrastructure/logger.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { proc } from "../../src/infrastructure/proc.js";

const mockProject = {
	name: "test-project",
	path: "/project",
	config: { name: "test", reports: { generators: [] }, health: {} },
	pkg: { name: "test-project", version: "1.0.0", scripts: {} },
	scripts: {},
};

describe("info.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths, proc,
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	it("calls collectProjectInfo with the project context", () => {
		commands.info({}, [], "info", mockProject);

		expect(collectProjectInfo).toHaveBeenCalledOnce();
		expect(collectProjectInfo).toHaveBeenCalledWith(mockProject, expect.any(Object));
	});

	it("calls displayInfo renderer in text mode", () => {
		commands.info({}, [], "info", mockProject);

		expect(displayInfo).toHaveBeenCalledOnce();
		expect(displayInfo).toHaveBeenCalledWith(
			expect.any(Function),
			expect.objectContaining({ name: "test-project" }),
		);
	});

	it("outputs JSON when format flag is json", () => {
		commands.info({ format: "json" }, [], "info", mockProject);

		expect(log).toHaveBeenCalledOnce();
		const output = JSON.parse((log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
		expect(output).toHaveProperty("name", "test-project");
	});

	it("returns NoProjectModel when no project is provided", () => {
		commands.info({ format: "json" }, [], "info", undefined);

		expect(collectProjectInfo).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledOnce();
		const output = JSON.parse((log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
		expect(output).toHaveProperty("command", "info");
	});

	it("does not call collectProjectInfo when project is missing", () => {
		commands.info({}, [], "info", undefined);

		expect(collectProjectInfo).not.toHaveBeenCalled();
	});
});
