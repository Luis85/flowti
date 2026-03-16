import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentAction, IWorldStateManager, WorldEntityType } from "../../../src/domain/agents/world-state-types.js";
import type { IWorkerManager } from "../../../src/domain/agents/worker-types.js";
import type { DashboardDeps, StartDashboardOptions } from "../../../src/domain/serve/dashboard-service.js";
import type { ServerHandle } from "../../../src/domain/serve/static-server.js";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../src/domain/serve/static-server.js", () => ({
	startServer: vi.fn(),
	openInBrowser: vi.fn(),
}));

vi.mock("../../../src/domain/agents/agent-export.js", () => ({
	exportAgentDashboardData: vi.fn(() => ({ agents: [], projects: [], iterations: [], components: [], events: [], resources: [], deliverables: [], raid: [] })),
	writeDashboardData: vi.fn(),
}));

vi.mock("../../../src/domain/project/project.js", () => ({
	listProjects: vi.fn(() => []),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null })),
}));

import { startServer, openInBrowser } from "../../../src/domain/serve/static-server.js";
import {
	startDashboardServer,
	stopDashboard,
	isDashboardRunning,
	getDashboardState,
	buildDashboard,
} from "../../../src/domain/serve/dashboard-service.js";

const mockStartServer = vi.mocked(startServer);

// ── Helpers ──────────────────────────────────────────────────────────

function makeDeps(): DashboardDeps {
	return {
		disk: {
			existsSync: vi.fn(() => true),
			readFileSync: vi.fn(() => ""),
			writeFileSync: vi.fn(),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
			statSync: vi.fn(() => ({ isFile: () => true, isDirectory: () => false, mtimeMs: 0, size: 0 })),
			unlinkSync: vi.fn(),
			copyFileSync: vi.fn(),
			renameSync: vi.fn(),
			rmSync: vi.fn(),
		},
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			resolve: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			extname: (p: string) => { const dot = p.lastIndexOf("."); return dot === -1 ? "" : p.slice(dot); },
			relative: (from: string, to: string) => to,
			normalize: (p: string) => p,
			sep: "/",
			isAbsolute: (p: string) => p.startsWith("/"),
		},
		shell: {
			run: vi.fn(() => 0),
			exec: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
		},
		log: vi.fn(),
	};
}

function makeWorldState(): IWorldStateManager {
	const listeners: Array<(action: AgentAction) => void> = [];
	return {
		emitAction: vi.fn((action: AgentAction) => {
			for (const cb of listeners) cb(action);
		}),
		updateEntity: vi.fn(),
		getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
		getEntity: vi.fn(() => null),
		flush: vi.fn(),
		addActionListener: vi.fn((cb: (action: AgentAction) => void) => { listeners.push(cb); }),
		removeActionListener: vi.fn((cb: (action: AgentAction) => void) => {
			const idx = listeners.indexOf(cb);
			if (idx >= 0) listeners.splice(idx, 1);
		}),
	};
}

function makeWorkerManager(): IWorkerManager {
	return {
		spawnAll: vi.fn(),
		spawn: vi.fn(() => null),
		stop: vi.fn(),
		stopAll: vi.fn(),
		getWorker: vi.fn(() => null),
		listWorkers: vi.fn(() => []),
		send: vi.fn(),
		dispatchWorldEvent: vi.fn(),
	};
}

function makeOpts(overrides?: Partial<StartDashboardOptions>): StartDashboardOptions {
	return {
		port: 8080,
		rootDir: "/out",
		cliProjectPath: "/cli",
		projectsDir: "/projects",
		vaultRoot: "/vault",
		projectConfig: { agents: { dashboard: true } } as StartDashboardOptions["projectConfig"],
		vaultAgentsConfig: undefined,
		worldState: makeWorldState(),
		workerManager: makeWorkerManager(),
		...overrides,
	};
}

function makeServerHandle(): ServerHandle {
	return { url: "http://localhost:8080", close: vi.fn() };
}

// ── Reset module-level singletons between tests ─────────────────────

beforeEach(() => {
	vi.clearAllMocks();
	// Stop any active dashboard from a previous test
	stopDashboard(() => {});
});

// ── Tests ────────────────────────────────────────────────────────────

describe("dashboard-service SSE wiring", () => {
	it("registers an action listener on start", async () => {
		const handle = makeServerHandle();
		mockStartServer.mockResolvedValue(handle);
		const opts = makeOpts();

		await startDashboardServer(opts, makeDeps());

		expect(opts.worldState.addActionListener).toHaveBeenCalledOnce();
		expect(opts.worldState.addActionListener).toHaveBeenCalledWith(expect.any(Function));
	});

	it("removes the action listener on stop", async () => {
		const handle = makeServerHandle();
		mockStartServer.mockResolvedValue(handle);
		const opts = makeOpts();
		const deps = makeDeps();

		await startDashboardServer(opts, deps);
		expect(isDashboardRunning()).toBe(true);

		stopDashboard(deps.log);
		expect(opts.worldState.removeActionListener).toHaveBeenCalledOnce();
		expect(isDashboardRunning()).toBe(false);
	});

	it("passes ServerContext to startServer", async () => {
		const handle = makeServerHandle();
		mockStartServer.mockResolvedValue(handle);
		const opts = makeOpts();

		await startDashboardServer(opts, makeDeps());

		expect(mockStartServer).toHaveBeenCalledWith(
			{ port: 8080, dir: "/out" },
			expect.objectContaining({ disk: expect.anything(), paths: expect.anything() }),
			expect.objectContaining({
				worldState: opts.worldState,
				workerManager: opts.workerManager,
				sseClients: expect.any(Set),
				vaultRoot: "/vault",
			}),
		);
	});

	it("wraps updateEntity to broadcast entity-update SSE events", async () => {
		const handle = makeServerHandle();
		mockStartServer.mockResolvedValue(handle);
		const worldState = makeWorldState();
		const opts = makeOpts({ worldState });

		await startDashboardServer(opts, makeDeps());

		// After start, updateEntity should have been wrapped
		// The wrapped function was assigned to worldState.updateEntity
		// Verify via the ServerContext's sseClients — retrieve from the startServer call
		const serverCtx = mockStartServer.mock.calls[0][2];
		expect(serverCtx).toBeDefined();

		// Add a fake SSE client
		const fakeClient = { write: vi.fn() };
		serverCtx!.sseClients.add(fakeClient as never);

		// Call the now-wrapped updateEntity
		worldState.updateEntity("agent-1", "agent" as WorldEntityType, { name: "test" });

		// The fake client should have received an entity-update event
		expect(fakeClient.write).toHaveBeenCalledWith(
			expect.stringContaining("event: entity-update\n"),
		);
		const writeArg = fakeClient.write.mock.calls[0][0] as string;
		expect(writeArg).toContain("agent-1");
	});

	it("does not fail stopDashboard when not running", () => {
		const log = vi.fn();
		stopDashboard(log);
		expect(log).toHaveBeenCalledWith("\n  Dashboard is not running.\n");
	});
});

describe("buildDashboard", () => {
	it("returns error when dashboard is not enabled", () => {
		const deps = makeDeps();
		const result = buildDashboard("/cli", "/out", undefined, deps);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("not enabled");
	});

	it("returns ok when build output already exists", () => {
		const deps = makeDeps();
		const result = buildDashboard("/cli", "/out", { dashboard: true } as never, deps);
		expect(result.ok).toBe(true);
	});
});
