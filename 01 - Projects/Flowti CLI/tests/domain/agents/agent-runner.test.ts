import { describe, it, expect } from "vitest";
import { buildRunSpec, buildClaudeArgs } from "../../../src/domain/agents/agent-runner.js";
import type { AgentAIConfig } from "../../../src/domain/agents/agent-types.js";

describe("buildClaudeArgs", () => {
	it("omits model args when provider only", () => {
		const ai: AgentAIConfig = { provider: "anthropic" };
		const args = buildClaudeArgs(ai);
		expect(args).not.toContain("--model");
	});
});

describe("buildClaudeArgs — stream-json", () => {
	it("produces -p and --output-format stream-json by default", () => {
		const args = buildClaudeArgs(undefined);
		expect(args).toContain("-p");
		expect(args).toContain("--output-format");
		expect(args).toContain("stream-json");
		expect(args).toContain("--verbose");
		expect(args).not.toContain("--print");
	});

	it("produces --print when outputFormat is text", () => {
		const ai: AgentAIConfig = { outputFormat: "text" };
		const args = buildClaudeArgs(ai);
		expect(args).toContain("--print");
		expect(args).not.toContain("--output-format");
		expect(args).not.toContain("--verbose");
	});

	it("includes --allowedTools when set", () => {
		const ai: AgentAIConfig = { allowedTools: ["Read", "Edit"] };
		const args = buildClaudeArgs(ai);
		expect(args).toContain("--allowedTools");
		expect(args).toContain("Read,Edit");
	});

	it("includes both outputFormat text and allowedTools", () => {
		const ai: AgentAIConfig = { outputFormat: "text", allowedTools: ["Bash"] };
		const args = buildClaudeArgs(ai);
		expect(args).toContain("--print");
		expect(args).not.toContain("--output-format");
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
		const ai: AgentAIConfig = { provider: "anthropic" };
		const spec = buildRunSpec(ai, "/brief.md", "/project");
		expect(spec.args).toContain("-p");
		expect(spec.args).not.toContain("--model");
	});

	it("returns empty env by default", () => {
		const spec = buildRunSpec(undefined, "/brief.md", "/project");
		expect(spec.env).toEqual({});
	});
});
