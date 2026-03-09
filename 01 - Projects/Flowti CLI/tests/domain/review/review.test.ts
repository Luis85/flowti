import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0) },
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { commands } from "../../../src/domain/review/review.js";
import { shell } from "../../../src/infrastructure/shell.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

const mockShell = vi.mocked(shell);

beforeEach(() => {
	vi.clearAllMocks();
});

function makeProject(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/project",
		config: { name: "test-project", ...overrides.config },
		...overrides,
	} as ProjectContext;
}

describe("review command", () => {
	it("runs configured runner", () => {
		const p = makeProject({ config: { name: "test", review: { runner: "npm run e2e" } } });
		commands.review({}, [], "review", p);
		expect(mockShell.run).toHaveBeenCalledWith("npm run e2e", expect.objectContaining({ cwd: "/project" }));
	});

	it("defaults to npm test when no runner configured", () => {
		const p = makeProject();
		commands.review({}, [], "review", p);
		expect(mockShell.run).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
	});
});

describe("review:all command", () => {
	it("runs build → test → E2E sequentially", () => {
		const p = makeProject({ config: { name: "test", review: { build: "make build", test: "make test", runner: "make e2e" } } });
		mockShell.run.mockReturnValue(0);

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledTimes(3);
		expect(mockShell.run).toHaveBeenCalledWith("make build", expect.objectContaining({ label: "Step 1/3: Build" }));
		expect(mockShell.run).toHaveBeenCalledWith("make test", expect.objectContaining({ label: "Step 2/3: Test" }));
		expect(mockShell.run).toHaveBeenCalledWith("make e2e", expect.objectContaining({ label: "Step 3/3: E2E" }));
	});

	it("stops on build failure", () => {
		const p = makeProject({ config: { name: "test", review: { build: "make build", test: "make test" } } });
		mockShell.run.mockReturnValue(1);

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledTimes(1);
	});

	it("stops on test failure", () => {
		const p = makeProject({ config: { name: "test", review: { build: "make build", test: "make test" } } });
		mockShell.run
			.mockReturnValueOnce(0)  // build passes
			.mockReturnValueOnce(1); // test fails

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledTimes(2);
	});

	it("uses defaults when no review config", () => {
		const p = makeProject();
		mockShell.run.mockReturnValue(0);

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledWith("npm run build", expect.anything());
		expect(mockShell.run).toHaveBeenCalledWith("npm test", expect.anything());
		expect(mockShell.run).toHaveBeenCalledWith("npx vitest run tests/e2e/", expect.anything());
	});

	it("does nothing without project context", () => {
		commands["review:all"]({}, [], "review:all", undefined);
		expect(mockShell.run).not.toHaveBeenCalled();
	});
});
