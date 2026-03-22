import { describe, it, expect, vi } from "vitest";
import { createProcessRunner } from "../../src/infrastructure/agent-process-runner.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";

function minimalAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "TestAgent",
		agentType: "ai",
		description: "",
		skills: [],
		tools: [],
		roles: [],
		file: "03 - Resources/Agents/TestAgent.md",
		...overrides,
	};
}

describe("createProcessRunner full-permission CLI flags (legacy path)", () => {
	it("appends --dangerously-skip-permissions for claude / anthropic", () => {
		const cmds: string[] = [];
		const deps = {
			disk: {
				writeFileSync: vi.fn(),
				unlinkSync: vi.fn(),
			},
			paths: {
				join: (...parts: string[]) => parts.join("/"),
				resolve: (x: string) => x,
			},
			clock: { ms: () => 42 },
			shell: {
				spawnBackground: (cmd: string) => {
					cmds.push(cmd);
					return {
						onOutput: () => {},
						waitForExit: async () => 0,
						kill: () => {},
					};
				},
			},
			log: () => {},
		};
		const runner = createProcessRunner(deps as never, undefined, undefined);
		runner.spawn(minimalAgent({ ai: { provider: "anthropic" } }), "hello", [], {});
		expect(cmds.length).toBe(1);
		expect(cmds[0]).toContain("claude");
		expect(cmds[0]).toContain("--dangerously-skip-permissions");
	});

	it("appends --force for cursor provider", () => {
		const cmds: string[] = [];
		const deps = {
			disk: {
				writeFileSync: vi.fn(),
				unlinkSync: vi.fn(),
			},
			paths: {
				join: (...parts: string[]) => parts.join("/"),
				resolve: (x: string) => x,
			},
			clock: { ms: () => 43 },
			shell: {
				spawnBackground: (cmd: string) => {
					cmds.push(cmd);
					return {
						onOutput: () => {},
						waitForExit: async () => 0,
						kill: () => {},
					};
				},
			},
			log: () => {},
		};
		const runner = createProcessRunner(deps as never, undefined, undefined);
		runner.spawn(minimalAgent({ ai: { provider: "cursor" } }), "hello", [], {});
		expect(cmds.length).toBe(1);
		expect(cmds[0]).toContain("agent");
		expect(cmds[0]).toContain("--force");
	});

	it("does not pass --allowedTools when agent has no tools and none resolved", () => {
		const cmds: string[] = [];
		const deps = {
			disk: {
				writeFileSync: vi.fn(),
				unlinkSync: vi.fn(),
			},
			paths: {
				join: (...parts: string[]) => parts.join("/"),
				resolve: (x: string) => x,
			},
			clock: { ms: () => 44 },
			shell: {
				spawnBackground: (cmd: string) => {
					cmds.push(cmd);
					return {
						onOutput: () => {},
						waitForExit: async () => 0,
						kill: () => {},
					};
				},
			},
			log: () => {},
		};
		const runner = createProcessRunner(deps as never, undefined, undefined);
		runner.spawn(minimalAgent({ ai: { provider: "anthropic" } }), "hello", undefined, {});
		expect(cmds[0]).not.toContain("--allowedTools");
	});
});
