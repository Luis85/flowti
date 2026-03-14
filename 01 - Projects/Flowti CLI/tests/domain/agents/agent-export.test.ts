import { describe, it, expect, vi } from "vitest";
import { deriveAgentStatus, exportAgentDashboardData, writeDashboardData } from "../../../src/domain/agents/agent-export.js";
import type { ProjectEntry, DashboardData } from "../../../src/domain/agents/agent-export.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../src/domain/agents/agent-store.js", () => ({
	listAgents: vi.fn(() => []),
}));

vi.mock("../../../src/domain/iterations/iteration-store.js", () => ({
	listIterations: vi.fn(() => []),
}));

import { listAgents } from "../../../src/domain/agents/agent-store.js";
import { listIterations } from "../../../src/domain/iterations/iteration-store.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";

const mockListAgents = vi.mocked(listAgents);
const mockListIterations = vi.mocked(listIterations);

function makeAgent(name: string, agentType: "human" | "ai" = "human", domain?: string): AgentSummary {
	return { name, agentType, description: "", domain, skills: [], tools: [], roles: [], file: `${name}.md` };
}

function makeIteration(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Iter", number: 1, startDate: "2026-01-01", endDate: "2026-01-14",
		goal: "Do stuff", capacity: "", description: "",
		status: "in-progress", file: "iteration-001-plan.md",
		agents: [], resources: [], capacities: [], scopeItems: [],
		...overrides,
	};
}

const mockDeps = {
	disk: {
		existsSync: () => false,
		readFileSync: () => "",
		readdirSync: () => [],
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// ── deriveAgentStatus ────────────────────────────────────────────────

describe("deriveAgentStatus", () => {
	it("returns unassigned when agent is not on any roster", () => {
		const rosters = new Map<string, string[]>();
		const iters = new Map<string, IterationSummary[]>();
		expect(deriveAgentStatus("Agent X", rosters, iters)).toEqual({ status: "unassigned" });
	});

	it("returns idle when agent is on roster but no active iterations", () => {
		const rosters = new Map([["Project A", ["Agent X"]]]);
		const iters = new Map<string, IterationSummary[]>();
		expect(deriveAgentStatus("Agent X", rosters, iters)).toEqual({ status: "idle", project: "Project A" });
	});

	it("returns idle when agent is on roster but not referenced in active iterations", () => {
		const rosters = new Map([["Project A", ["Agent X"]]]);
		const iters = new Map([["Project A", [makeIteration({ agents: [{ name: "Agent Y", file: "y.md" }] })]]]);
		expect(deriveAgentStatus("Agent X", rosters, iters)).toEqual({ status: "idle", project: "Project A" });
	});

	it("returns busy when agent is referenced in an in-progress iteration", () => {
		const rosters = new Map([["Project A", ["Agent X"]]]);
		const iters = new Map([["Project A", [makeIteration({
			name: "Sprint 1", status: "in-progress",
			agents: [{ name: "Agent X", file: "x.md" }],
		})]]]);
		const result = deriveAgentStatus("Agent X", rosters, iters);
		expect(result).toEqual({ status: "busy", project: "Project A", iteration: "Sprint 1", phase: "in-progress" });
	});

	it("returns busy when agent is referenced in an in-review iteration", () => {
		const rosters = new Map([["Project A", ["Agent X"]]]);
		const iters = new Map([["Project A", [makeIteration({
			name: "Sprint 2", status: "in-review",
			agents: [{ name: "Agent X", file: "x.md" }],
		})]]]);
		const result = deriveAgentStatus("Agent X", rosters, iters);
		expect(result).toEqual({ status: "busy", project: "Project A", iteration: "Sprint 2", phase: "in-review" });
	});

	it("is case-insensitive for roster matching", () => {
		const rosters = new Map([["Proj", ["agent x"]]]);
		const iters = new Map<string, IterationSummary[]>();
		expect(deriveAgentStatus("Agent X", rosters, iters)).toEqual({ status: "idle", project: "Proj" });
	});

	it("is case-insensitive for iteration agent matching", () => {
		const rosters = new Map([["Proj", ["Agent X"]]]);
		const iters = new Map([["Proj", [makeIteration({
			name: "S1", status: "in-progress",
			agents: [{ name: "agent x", file: "x.md" }],
		})]]]);
		expect(deriveAgentStatus("Agent X", rosters, iters).status).toBe("busy");
	});
});

// ── exportAgentDashboardData ─────────────────────────────────────────

describe("exportAgentDashboardData", () => {
	beforeEach(() => {
		mockListAgents.mockReset();
		mockListIterations.mockReset();
	});

	it("returns empty data when no agents and no projects", () => {
		mockListAgents.mockReturnValue([]);
		const data = exportAgentDashboardData("/vault", undefined, [], mockDeps);
		expect(data).toEqual({ agents: [], projects: [] });
	});

	it("marks all agents as unassigned when no projects have rosters", () => {
		mockListAgents.mockReturnValue([makeAgent("Alice"), makeAgent("Bob", "ai")]);
		const data = exportAgentDashboardData("/vault", undefined, [], mockDeps);
		expect(data.agents).toHaveLength(2);
		expect(data.agents[0].status).toBe("unassigned");
		expect(data.agents[1].status).toBe("unassigned");
	});

	it("marks agents as idle when on roster but no active iterations", () => {
		mockListAgents.mockReturnValue([makeAgent("Alice")]);
		mockListIterations.mockReturnValue([makeIteration({ status: "done" })]);
		const project: ProjectEntry = {
			name: "Proj", path: "/vault/proj",
			config: { name: "Proj", management: { agents: { roster: ["Alice"] } } },
		};
		const data = exportAgentDashboardData("/vault", undefined, [project], mockDeps);
		expect(data.agents[0].status).toBe("idle");
		expect(data.agents[0].project).toBe("Proj");
	});

	it("marks agents as busy when in active iteration", () => {
		mockListAgents.mockReturnValue([makeAgent("Alice")]);
		mockListIterations.mockReturnValue([makeIteration({
			name: "Sprint 1", status: "in-progress",
			agents: [{ name: "Alice", file: "alice.md" }],
		})]);
		const project: ProjectEntry = {
			name: "Proj", path: "/vault/proj",
			config: { name: "Proj", management: { agents: { roster: ["Alice"] } } },
		};
		const data = exportAgentDashboardData("/vault", undefined, [project], mockDeps);
		expect(data.agents[0].status).toBe("busy");
		expect(data.agents[0].iteration).toBe("Sprint 1");
	});

	it("includes project entries with roster info", () => {
		mockListAgents.mockReturnValue([]);
		mockListIterations.mockReturnValue([]);
		const project: ProjectEntry = {
			name: "Proj", path: "/vault/proj",
			config: { name: "Proj", management: { agents: { roster: ["Alice", "Bob"] } } },
		};
		const data = exportAgentDashboardData("/vault", undefined, [project], mockDeps);
		expect(data.projects).toEqual([{ name: "Proj", agents: ["Alice", "Bob"] }]);
	});

	it("includes agent domain and type in export", () => {
		mockListAgents.mockReturnValue([makeAgent("Alice", "ai", "engineering")]);
		const data = exportAgentDashboardData("/vault", undefined, [], mockDeps);
		expect(data.agents[0].agentType).toBe("ai");
		expect(data.agents[0].domain).toBe("engineering");
	});
});

// ── writeDashboardData ───────────────────────────────────────────────

describe("writeDashboardData", () => {
	it("creates directory and writes JSON file", () => {
		const writeSpy = vi.fn();
		const mkdirSpy = vi.fn();
		const deps = {
			disk: { writeFileSync: writeSpy, mkdirSync: mkdirSpy },
			paths: { dirname: (p: string) => p.split("/").slice(0, -1).join("/") },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;

		const data: DashboardData = { agents: [], projects: [] };
		writeDashboardData(data, "/site/data/agent-dashboard.json", deps);

		expect(mkdirSpy).toHaveBeenCalledWith("/site/data", { recursive: true });
		expect(writeSpy).toHaveBeenCalledWith(
			"/site/data/agent-dashboard.json",
			JSON.stringify(data, null, "\t"),
			"utf-8",
		);
	});
});
