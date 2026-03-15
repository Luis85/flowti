import { describe, it, expect } from "vitest";
import { buildRunSpec, buildClaudeArgs, parseAgentOutput } from "../../../src/domain/agents/agent-runner.js";
import type { AgentAIConfig } from "../../../src/domain/agents/agent-types.js";

describe("buildClaudeArgs", () => {
	it("includes --print and --prompt-file as baseline", () => {
		const args = buildClaudeArgs(undefined, "/path/brief.md");
		expect(args).toEqual(["--print", "--prompt-file", "/path/brief.md"]);
	});

	it("includes --model when ai.model is set", () => {
		const ai: AgentAIConfig = { model: "claude-sonnet-4-20250514" };
		const args = buildClaudeArgs(ai, "/brief.md");
		expect(args).toContain("--model");
		expect(args).toContain("claude-sonnet-4-20250514");
	});

	it("includes --max-tokens when ai.maxTokens is set", () => {
		const ai: AgentAIConfig = { maxTokens: 4096 };
		const args = buildClaudeArgs(ai, "/brief.md");
		expect(args).toContain("--max-tokens");
		expect(args).toContain("4096");
	});

	it("omits model and max-tokens when not set", () => {
		const ai: AgentAIConfig = { provider: "anthropic" };
		const args = buildClaudeArgs(ai, "/brief.md");
		expect(args).not.toContain("--model");
		expect(args).not.toContain("--max-tokens");
	});
});

describe("buildRunSpec", () => {
	it("defaults to 'claude' command", () => {
		const spec = buildRunSpec(undefined, "/brief.md", "/project");
		expect(spec.command).toBe("claude");
	});

	it("sets workingDir to projectPath", () => {
		const spec = buildRunSpec(undefined, "/brief.md", "/my/project");
		expect(spec.workingDir).toBe("/my/project");
	});

	it("preserves briefPath", () => {
		const spec = buildRunSpec(undefined, "/iter/briefs/brief.md", "/project");
		expect(spec.briefPath).toBe("/iter/briefs/brief.md");
	});

	it("assembles args from AgentAIConfig", () => {
		const ai: AgentAIConfig = { model: "opus", maxTokens: 8192 };
		const spec = buildRunSpec(ai, "/brief.md", "/project");
		expect(spec.args).toContain("--model");
		expect(spec.args).toContain("opus");
		expect(spec.args).toContain("--max-tokens");
		expect(spec.args).toContain("8192");
	});

	it("returns empty env by default", () => {
		const spec = buildRunSpec(undefined, "/brief.md", "/project");
		expect(spec.env).toEqual({});
	});
});

describe("parseAgentOutput", () => {
	it("classifies error lines", () => {
		const event = parseAgentOutput("Error: something broke");
		expect(event.kind).toBe("error");
		expect((event as { message: string }).message).toBe("something broke");
	});

	it("classifies progress lines", () => {
		const event = parseAgentOutput("Progress: step 3 of 5");
		expect(event.kind).toBe("progress");
		expect((event as { message: string }).message).toBe("step 3 of 5");
	});

	it("classifies result lines", () => {
		const event = parseAgentOutput("Result: task complete");
		expect(event.kind).toBe("result");
		expect((event as { content: string }).content).toBe("task complete");
	});

	it("classifies plain text as raw", () => {
		const event = parseAgentOutput("just some output");
		expect(event.kind).toBe("raw");
		expect((event as { line: string }).line).toBe("just some output");
	});

	it("handles empty lines as raw", () => {
		const event = parseAgentOutput("");
		expect(event.kind).toBe("raw");
	});

	it("is case-insensitive for prefixes", () => {
		expect(parseAgentOutput("error: low").kind).toBe("error");
		expect(parseAgentOutput("ERROR: loud").kind).toBe("error");
		expect(parseAgentOutput("PROGRESS: step").kind).toBe("progress");
		expect(parseAgentOutput("RESULT: done").kind).toBe("result");
	});
});
