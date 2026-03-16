import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	cliConfig: { agents: { dir: "03 - Resources/Agents" } },
}));

vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	agentStore: { list: vi.fn(() => []) },
}));

import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerDashboardHandlers } from "../../../src/ui/handlers/dashboard-handlers.js";
import { agentStore } from "../../../src/domain/agents/agent-store.js";
import type { CliDeps } from "../../../src/infrastructure/deps.js";

function makeDeps(): CliDeps {
	return {
		disk: {
			existsSync: vi.fn(() => false),
			readdirSync: vi.fn(() => []),
			readFileSync: vi.fn(() => ""),
			writeFileSync: vi.fn(),
		} as never,
		paths: {
			join: vi.fn((...a: string[]) => a.join("/")),
		} as never,
		clock: {} as never,
		shell: {} as never,
		proc: {} as never,
		input: { waitForEnter: vi.fn(async () => {}) } as never,
		bus: {} as never,
		log: vi.fn(),
		warn: vi.fn(),
		worldState: {} as never,
		workerManager: {} as never,
		processRunner: {} as never,
	};
}

describe("registerDashboardHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerDashboardHandlers(registry);
	});

	it("registers a view handler for agents-dashboard", () => {
		expect(registry.hasView("agents-dashboard")).toBe(true);
	});

	it("renders dashboard even when var dir does not exist", async () => {
		const handler = registry.getView("agents-dashboard")!;
		const deps = makeDeps();
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
		await handler({ deps, dataSourceEntries: [] } as never);
		expect(deps.log).toHaveBeenCalled();
	});

	it("renders agents from data files", async () => {
		const handler = registry.getView("agents-dashboard")!;
		const deps = makeDeps();
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(["data-atlas.json", "data-dev.json"]);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce(JSON.stringify({ name: "Atlas", status: "busy", tasks: [{ name: "Review PR", status: "in-progress" }] }))
			.mockReturnValueOnce(JSON.stringify({ name: "Dev", status: "idle" }));
		(agentStore.list as ReturnType<typeof vi.fn>).mockReturnValue([
			{ name: "Atlas", persona: "Lead Architect" },
			{ name: "Dev", persona: "Alice" },
		]);

		await handler({ deps, dataSourceEntries: [] } as never);

		const allOutput = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => String(c[0] ?? "")).join("\n");
		expect(allOutput).toContain("Lead Architect");
		expect(allOutput).toContain("Review PR");
	});

	it("shows roster agents without data files as offline", async () => {
		const handler = registry.getView("agents-dashboard")!;
		const deps = makeDeps();
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
		(agentStore.list as ReturnType<typeof vi.fn>).mockReturnValue([
			{ name: "Ghost", persona: "Invisible Agent" },
		]);

		await handler({ deps, dataSourceEntries: [] } as never);

		const allOutput = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => String(c[0] ?? "")).join("\n");
		expect(allOutput).toContain("Invisible Agent");
		expect(allOutput).toContain("offline");
	});

	it("waits for enter after rendering", async () => {
		const handler = registry.getView("agents-dashboard")!;
		const deps = makeDeps();
		await handler({ deps, dataSourceEntries: [] } as never);
		expect(deps.input.waitForEnter).toHaveBeenCalled();
	});
});
