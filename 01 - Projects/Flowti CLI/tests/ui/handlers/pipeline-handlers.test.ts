/**
 * pipeline-handlers.test.ts — Tests for review and publish pipeline action handlers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn(), copyFileSync: vi.fn(), unlinkSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", dirname: (p: string) => p.split("/").slice(0, -1).join("/"), sep: "/" },
}));
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(() => ""), askYesNo: vi.fn(() => true), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "", printHeader: vi.fn(),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: {},
}));
vi.mock("../../../src/infrastructure/test-vault.js", () => ({
	resolveTestVaultRoot: vi.fn((name: string, root: string) => `${root}/${name}`),
	scaffoldTestVault: vi.fn(),
}));
vi.mock("../../../src/ui/handlers/pipeline-distribute.js", () => ({
	distribute: vi.fn(() => 0),
}));
vi.mock("../../../src/ui/menus/make-makers.js", () => ({
	makeJourney: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerPipelineHandlers } from "../../../src/ui/handlers/pipeline-handlers.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { input } from "../../../src/infrastructure/input.js";
import { log } from "../../../src/infrastructure/logger.js";
import { distribute } from "../../../src/ui/handlers/pipeline-distribute.js";
import { makeJourney } from "../../../src/ui/menus/make-makers.js";

// ── Helpers ─────────────────────────────────────────────────────────

function mockCtx(overrides?: Partial<{ project: { config: { review?: unknown; publish?: unknown }; path: string } }>) {
	return { project: { config: { review: {}, publish: {} }, path: "/project", ...overrides?.project } };
}

function noProjectCtx() {
	return { project: undefined } as { project: undefined };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("registerPipelineHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		// Re-create registry to get fresh handlers (but module-level state persists)
		registry = new HandlerRegistry();
		registerPipelineHandlers(registry);
	});

	// ── Registration completeness ───────────────────────────────────

	it("registers all expected action handlers", () => {
		const actions = [
			"review:build", "review:test", "review:e2e", "review:journey",
			"review:run-all", "review:list-journeys", "review:new-journey",
			"review:vault-create", "review:vault-open", "review:vault-teardown",
			"review:vault-rebuild",
			"publish:build", "publish:test", "publish:distribute", "publish:run-all",
		];
		for (const id of actions) {
			expect(registry.hasAction(id)).toBe(true);
		}
	});

	it("registers all expected beforeRender handlers", () => {
		expect(registry.hasBeforeRender("review:banner")).toBe(true);
		expect(registry.hasBeforeRender("publish:banner")).toBe(true);
	});

	// ── review:build ────────────────────────────────────────────────

	describe("review:build", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:build")(noProjectCtx());
			expect(result).toBeUndefined();
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs build command and waits for enter", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npm run build", expect.objectContaining({ cwd: "/project" }));
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("uses custom build command from config", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx({ project: { config: { review: { build: "make build" } }, path: "/proj" } }));
			expect(shell.run).toHaveBeenCalledWith("make build", expect.objectContaining({ cwd: "/proj" }));
		});

		it("resets testPassed when build fails", async () => {
			// First succeed build+test to set testPassed
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx());
			await registry.getAction("review:test")(mockCtx());

			// Now fail build — testPassed should reset
			vi.mocked(shell.run).mockReturnValue(1);
			await registry.getAction("review:build")(mockCtx());

			// test should now be gated
			vi.mocked(shell.run).mockClear();
			await registry.getAction("review:test")(mockCtx());
			expect(shell.run).not.toHaveBeenCalled();
		});
	});

	// ── review:test ─────────────────────────────────────────────────

	describe("review:test", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:test")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("requires buildPassed — logs warning when not built", async () => {
			await registry.getAction("review:test")(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs test command after successful build", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx());
			vi.mocked(shell.run).mockClear();

			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:test")(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
		});

		it("uses custom test command from config", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx({ project: { config: { review: { test: "npx vitest" } }, path: "/proj" } }));
			vi.mocked(shell.run).mockClear();

			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:test")(mockCtx({ project: { config: { review: { test: "npx vitest" } }, path: "/proj" } }));
			expect(shell.run).toHaveBeenCalledWith("npx vitest", expect.objectContaining({ cwd: "/proj" }));
		});
	});

	// ── review:e2e ──────────────────────────────────────────────────

	describe("review:e2e", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:e2e")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("requires testPassed — logs warning when not tested", async () => {
			await registry.getAction("review:e2e")(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs e2e after build+test pass, ensuring test vault", async () => {
			// Pass build and test
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx());
			await registry.getAction("review:test")(mockCtx());

			// Ensure vault binary exists
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(shell.run).mockClear();
			vi.mocked(shell.run).mockReturnValue(0);

			await registry.getAction("review:e2e")(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npx vitest run tests/e2e/", expect.objectContaining({ cwd: "/project" }));
		});

		it("stops when test vault binary is missing", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx());
			await registry.getAction("review:test")(mockCtx());

			vi.mocked(disk.existsSync).mockReturnValue(false);
			vi.mocked(shell.run).mockClear();

			await registry.getAction("review:e2e")(mockCtx());
			// shell.run should not be called for e2e when vault setup fails
			expect(shell.run).not.toHaveBeenCalled();
		});
	});

	// ── review:journey ──────────────────────────────────────────────

	describe("review:journey", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:journey")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("requires testPassed", async () => {
			await registry.getAction("review:journey")(mockCtx());
			expect(log).toHaveBeenCalled();
		});

		it("delegates to selectAndRunJourney after test passes", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("review:build")(mockCtx());
			await registry.getAction("review:test")(mockCtx());

			// No journeys found — should log and return
			vi.mocked(disk.existsSync).mockReturnValue(false);
			await registry.getAction("review:journey")(mockCtx());
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── review:run-all ──────────────────────────────────────────────

	describe("review:run-all", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:run-all")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("runs full pipeline build → test → e2e on success", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			vi.mocked(disk.existsSync).mockReturnValue(true);

			await registry.getAction("review:run-all")(mockCtx());
			// build + test + e2e = 3 calls
			expect(shell.run).toHaveBeenCalledTimes(3);
		});

		it("stops at build failure", async () => {
			vi.mocked(shell.run).mockReturnValue(1);
			await registry.getAction("review:run-all")(mockCtx());
			expect(shell.run).toHaveBeenCalledTimes(1);
			expect(log).toHaveBeenCalled();
		});

		it("stops at test failure", async () => {
			vi.mocked(shell.run).mockReturnValueOnce(0).mockReturnValueOnce(1);
			await registry.getAction("review:run-all")(mockCtx());
			expect(shell.run).toHaveBeenCalledTimes(2);
		});
	});

	// ── review:list-journeys ────────────────────────────────────────

	describe("review:list-journeys", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:list-journeys")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("logs no journeys message when none found", async () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);
			await registry.getAction("review:list-journeys")(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("lists journey files when found", async () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.readdirSync).mockReturnValue(["login.journey", "signup.journey.json"] as unknown as ReturnType<typeof disk.readdirSync>);
			vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ journey: "Login Flow", description: "Tests login" }));

			await registry.getAction("review:list-journeys")(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── review:new-journey ──────────────────────────────────────────

	describe("review:new-journey", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:new-journey")(noProjectCtx());
			expect(result).toBeUndefined();
			expect(makeJourney).not.toHaveBeenCalled();
		});

		it("delegates to makeJourney", async () => {
			await registry.getAction("review:new-journey")(mockCtx());
			expect(makeJourney).toHaveBeenCalledWith("/project");
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── review:vault-create ─────────────────────────────────────────

	describe("review:vault-create", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:vault-create")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("calls ensureTestVault and waits", async () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			await registry.getAction("review:vault-create")(mockCtx());
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── review:vault-open ───────────────────────────────────────────

	describe("review:vault-open", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:vault-open")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("opens explorer when vault is ensured", async () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			await registry.getAction("review:vault-open")(mockCtx());
			expect(shell.runSilent).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── review:vault-teardown ───────────────────────────────────────

	describe("review:vault-teardown", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:vault-teardown")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("logs message when no teardown command configured", async () => {
			await registry.getAction("review:vault-teardown")(mockCtx({ project: { config: { review: {} }, path: "/proj" } }));
			expect(log).toHaveBeenCalled();
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs teardown on confirmation", async () => {
			vi.mocked(input.ask).mockResolvedValue("y");
			const ctx = mockCtx({ project: { config: { review: { teardown: "npm run teardown" } }, path: "/proj" } });
			await registry.getAction("review:vault-teardown")(ctx);
			expect(shell.run).toHaveBeenCalledWith("npm run teardown", expect.objectContaining({ cwd: "/proj" }));
		});

		it("skips teardown on decline", async () => {
			vi.mocked(input.ask).mockResolvedValue("N");
			const ctx = mockCtx({ project: { config: { review: { teardown: "npm run teardown" } }, path: "/proj" } });
			await registry.getAction("review:vault-teardown")(ctx);
			expect(shell.run).not.toHaveBeenCalled();
		});
	});

	// ── review:vault-rebuild ────────────────────────────────────────

	describe("review:vault-rebuild", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("review:vault-rebuild")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("logs message when no rebuild command configured", async () => {
			await registry.getAction("review:vault-rebuild")(mockCtx({ project: { config: { review: {} }, path: "/proj" } }));
			expect(log).toHaveBeenCalled();
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs rebuild on confirmation", async () => {
			vi.mocked(input.ask).mockResolvedValue("y");
			const ctx = mockCtx({ project: { config: { review: { rebuild: "npm run rebuild" } }, path: "/proj" } });
			await registry.getAction("review:vault-rebuild")(ctx);
			expect(shell.run).toHaveBeenCalledWith("npm run rebuild", expect.objectContaining({ cwd: "/proj" }));
		});

		it("skips rebuild on decline", async () => {
			vi.mocked(input.ask).mockResolvedValue("N");
			const ctx = mockCtx({ project: { config: { review: { rebuild: "npm run rebuild" } }, path: "/proj" } });
			await registry.getAction("review:vault-rebuild")(ctx);
			expect(shell.run).not.toHaveBeenCalled();
		});
	});

	// ── publish:build ───────────────────────────────────────────────

	describe("publish:build", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("publish:build")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("runs build and tracks state", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:build")(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npm run build", expect.objectContaining({ cwd: "/project" }));
		});

		it("uses custom build command", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:build")(mockCtx({ project: { config: { publish: { build: "make dist" } }, path: "/proj" } }));
			expect(shell.run).toHaveBeenCalledWith("make dist", expect.objectContaining({ cwd: "/proj" }));
		});

		it("resets test and distribute state on failure", async () => {
			// First pass everything
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:build")(mockCtx());
			await registry.getAction("publish:test")(mockCtx());

			// Fail build
			vi.mocked(shell.run).mockReturnValue(1);
			await registry.getAction("publish:build")(mockCtx());

			// test should be gated now
			vi.mocked(shell.run).mockClear();
			await registry.getAction("publish:test")(mockCtx());
			expect(shell.run).not.toHaveBeenCalled();
		});
	});

	// ── publish:test ────────────────────────────────────────────────

	describe("publish:test", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("publish:test")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("requires buildPassed", async () => {
			await registry.getAction("publish:test")(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(shell.run).not.toHaveBeenCalled();
		});

		it("runs test after build passes", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:build")(mockCtx());
			vi.mocked(shell.run).mockClear();

			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:test")(mockCtx());
			expect(shell.run).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
		});
	});

	// ── publish:distribute ──────────────────────────────────────────

	describe("publish:distribute", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("publish:distribute")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("requires testPassed", async () => {
			// Reset publish state by failing a build (clears testPassed)
			vi.mocked(shell.run).mockReturnValue(1);
			await registry.getAction("publish:build")(mockCtx());
			vi.mocked(shell.run).mockClear();
			vi.mocked(log).mockClear();

			await registry.getAction("publish:distribute")(mockCtx());
			expect(log).toHaveBeenCalled();
			expect(distribute).not.toHaveBeenCalled();
		});

		it("calls distribute after build+test pass", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:build")(mockCtx());
			await registry.getAction("publish:test")(mockCtx());

			vi.mocked(distribute).mockReturnValue(0);
			await registry.getAction("publish:distribute")(mockCtx());
			expect(distribute).toHaveBeenCalledWith("/project", expect.any(Object));
		});

		it("tracks distributePassed on success", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			await registry.getAction("publish:build")(mockCtx());
			await registry.getAction("publish:test")(mockCtx());

			vi.mocked(distribute).mockReturnValue(0);
			await registry.getAction("publish:distribute")(mockCtx());
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── publish:run-all ─────────────────────────────────────────────

	describe("publish:run-all", () => {
		it("returns undefined when no project", async () => {
			const result = await registry.getAction("publish:run-all")(noProjectCtx());
			expect(result).toBeUndefined();
		});

		it("runs full pipeline build → test → distribute on success", async () => {
			vi.mocked(shell.run).mockReturnValue(0);
			vi.mocked(distribute).mockReturnValue(0);
			await registry.getAction("publish:run-all")(mockCtx());
			expect(shell.run).toHaveBeenCalledTimes(2); // build + test
			expect(distribute).toHaveBeenCalled();
		});

		it("stops at build failure", async () => {
			vi.mocked(shell.run).mockReturnValue(1);
			await registry.getAction("publish:run-all")(mockCtx());
			expect(shell.run).toHaveBeenCalledTimes(1);
			expect(distribute).not.toHaveBeenCalled();
		});

		it("stops at test failure", async () => {
			vi.mocked(shell.run).mockReturnValueOnce(0).mockReturnValueOnce(1);
			await registry.getAction("publish:run-all")(mockCtx());
			expect(shell.run).toHaveBeenCalledTimes(2);
			expect(distribute).not.toHaveBeenCalled();
		});
	});

	// ── review:banner (beforeRender) ────────────────────────────────

	describe("review:banner", () => {
		it("does nothing when no project", () => {
			registry.getBeforeRender("review:banner")(noProjectCtx());
			// Should not throw, just return
		});

		it("renders pipeline status with journey count and vault state", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);
			vi.mocked(disk.readdirSync).mockReturnValue([]);

			registry.getBeforeRender("review:banner")(mockCtx());
			expect(log).toHaveBeenCalled();
		});

		it("shows vault exists when vault path exists", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.readdirSync).mockReturnValue([]);

			registry.getBeforeRender("review:banner")(mockCtx());
			expect(log).toHaveBeenCalled();
		});
	});

	// ── publish:banner (beforeRender) ───────────────────────────────

	describe("publish:banner", () => {
		it("does nothing when no project", () => {
			registry.getBeforeRender("publish:banner")(noProjectCtx());
			// Should not throw
		});

		it("renders pipeline status", () => {
			registry.getBeforeRender("publish:banner")(mockCtx());
			expect(log).toHaveBeenCalled();
		});

		it("shows endpoints when configured", () => {
			const ctx = mockCtx({ project: { config: { publish: { endpoints: [{ name: "npm", path: "/dist" }] } }, path: "/proj" } });
			registry.getBeforeRender("publish:banner")(ctx);
			expect(log).toHaveBeenCalled();
		});

		it("shows warning when no endpoints configured", () => {
			const ctx = mockCtx({ project: { config: { publish: {} }, path: "/proj" } });
			registry.getBeforeRender("publish:banner")(ctx);
			expect(log).toHaveBeenCalled();
		});
	});
});
