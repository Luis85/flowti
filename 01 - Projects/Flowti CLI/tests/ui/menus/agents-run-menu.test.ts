import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/domain/agents/brief-store.js", () => ({
	generateBrief: vi.fn(() => "# Generated Brief"),
	saveBrief: vi.fn((_d: unknown, _dir: string, _n: number, _a: string, _p: string) => "/iter/briefs/dev--ready.md"),
	listBriefs: vi.fn(() => [
		{ agentName: "Dev", phase: "ready", status: "open", file: "iteration-005-dev--ready.md", iterationNumber: 5 },
	]),
}));

vi.mock("../../../src/ui/displays/agent-run-display.js", () => ({
	renderBriefGenerated: vi.fn(),
	renderAgentSpawned: vi.fn(),
	renderStreamEvent: vi.fn(),
}));

vi.mock("../../../src/domain/agents/agent-session.js", () => ({
	createSession: vi.fn(() => ({ id: "s1", agentName: "Dev", iterationNumber: 5, status: "spawning", startedAt: "", briefRef: "", outputLines: [] })),
	updateSessionStatus: vi.fn(() => true),
	appendStructuredOutput: vi.fn(() => true),
}));

import { runAgentInteractive, runBriefInteractive, selectBriefInteractive } from "../../../src/ui/menus/agents-run-menu.js";
import { renderBriefGenerated } from "../../../src/ui/displays/agent-run-display.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";
import type { RunMenuDeps } from "../../../src/ui/menus/agents-run-menu.js";

function makeAgent(): AgentSummary {
	return {
		name: "Dev", agentType: "ai", description: "Writes code", domain: "development",
		skills: [{ name: "TypeScript", level: "expert" }], tools: [], roles: ["Implementer"],
		file: "software-developer.md",
		ai: { model: "claude-sonnet-4-20250514", systemPrompt: "You are a developer." },
	};
}

function makeIteration(): IterationSummary {
	return {
		name: "Sprint 5", number: 5, startDate: "2026-03-14", endDate: "2026-03-28",
		goal: "Autonomy", capacity: "", description: "", status: "ready",
		file: "iteration-005-plan.md", agents: [], resources: [], capacities: [], scopeItems: [],
	};
}

function makeDeps(): RunMenuDeps {
	return {
		disk: { readFileSync: vi.fn(() => "# Brief"), writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) } as unknown as RunMenuDeps["disk"],
		paths: { join: (...parts: string[]) => parts.join("/"), dirname: (p: string) => p.split("/").slice(0, -1).join("/") } as unknown as RunMenuDeps["paths"],
		shell: { check: vi.fn(() => true) } as unknown as RunMenuDeps["shell"],
		clock: { iso: vi.fn(() => "2026-03-15"), safeIso: vi.fn(() => "2026-03-15"), now: vi.fn(), ms: vi.fn() } as unknown as RunMenuDeps["clock"],
		input: { ask: vi.fn(() => Promise.resolve("")), waitForEnter: vi.fn(() => Promise.resolve()) } as unknown as RunMenuDeps["input"],
		log: vi.fn(),
		agentShell: {
			talk: vi.fn(),
			dispatch: vi.fn(() => ({
				sessionId: "dispatch-123",
				agentName: "Dev",
				task: "test",
				running: true,
				onEvent: vi.fn(() => () => {}),
				stop: vi.fn(),
			})),
			getActiveDispatch: vi.fn(() => null),
		} as unknown as RunMenuDeps["agentShell"],
	};
}

beforeEach(() => vi.clearAllMocks());

describe("runAgentInteractive", () => {
	it("in prompt-only mode saves brief and renders path", async () => {
		const deps = makeDeps();
		await runAgentInteractive(makeAgent(), makeIteration(), "/iter", false, deps);
		expect(renderBriefGenerated).toHaveBeenCalled();
	});

	it("in autonomous mode dispatches via agentShell", async () => {
		const deps = makeDeps();
		await runAgentInteractive(makeAgent(), makeIteration(), "/iter", true, deps);
		expect(deps.agentShell.dispatch).toHaveBeenCalled();
	});
});

describe("runBriefInteractive", () => {
	it("in prompt-only mode renders brief path", async () => {
		const deps = makeDeps();
		await runBriefInteractive("/brief.md", "Agent", false, deps);
		expect(renderBriefGenerated).toHaveBeenCalled();
	});
});

describe("selectBriefInteractive", () => {
	it("lists briefs for iteration", async () => {
		const deps = makeDeps();
		await selectBriefInteractive("/iter", 5, deps);
		expect(deps.log).toHaveBeenCalled();
	});

	it("returns null when user cancels", async () => {
		const deps = makeDeps();
		const result = await selectBriefInteractive("/iter", 5, deps);
		expect(result).toBeNull();
	});
});
