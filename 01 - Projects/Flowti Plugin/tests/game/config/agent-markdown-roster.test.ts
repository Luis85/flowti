import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	collectAgentMarkdownPaths,
	dashboardAgentFromFrontmatter,
	dashboardAgentsFromAgentsMarkdownDir,
	parseFrontmatter,
} from "../../../src/game/config/agent-markdown-roster";

describe("parseFrontmatter", () => {
	it("parses nested attributes block", () => {
		const md = `---
type: Agent
name: Test
attributes:
  int: 14
  cha: 10
---
body
`;
		const fm = parseFrontmatter(md);
		expect(fm.type).toBe("Agent");
		expect(fm.name).toBe("Test");
		expect(fm.attributes).toEqual({ int: 14, cha: 10 });
	});
});

describe("dashboardAgentFromFrontmatter", () => {
	it("returns null for non-Agent type", () => {
		expect(dashboardAgentFromFrontmatter({ type: "Note", name: "x" })).toBeNull();
	});

	it("maps Agent row with domain and status", () => {
		const row = dashboardAgentFromFrontmatter({
			type: "Agent",
			name: "Atlas",
			domain: "engineering",
			status: "busy",
			agentType: "ai",
		});
		expect(row).toMatchObject({
			name: "Atlas",
			domain: "engineering",
			status: "busy",
			agentType: "ai",
		});
	});
});

describe("dashboardAgentsFromAgentsMarkdownDir", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "ft-agents-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("returns [] when folder missing", () => {
		expect(dashboardAgentsFromAgentsMarkdownDir(join(dir, "no-such"))).toEqual([]);
	});

	it("loads top-level Agent markdown", () => {
		const agentsDir = join(dir, "03 - Resources", "Agents");
		mkdirSync(agentsDir, { recursive: true });
		writeFileSync(
			join(agentsDir, "Atlas.md"),
			`---
type: Agent
name: Atlas
domain: hub
---
`,
			"utf-8",
		);
		const rows = dashboardAgentsFromAgentsMarkdownDir(dir, join("03 - Resources", "Agents"));
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe("Atlas");
		expect(rows[0].domain).toBe("hub");
	});

	it("skips output folder and *.prompt.md", () => {
		const agentsDir = join(dir, "Agents");
		mkdirSync(join(agentsDir, "output"), { recursive: true });
		writeFileSync(join(agentsDir, "output", "junk.md"), "---\ntype: Agent\nname: Bad\n---\n", "utf-8");
		writeFileSync(join(agentsDir, "x.prompt.md"), "---\ntype: Agent\nname: PromptOnly\n---\n", "utf-8");
		writeFileSync(join(agentsDir, "Good.md"), "---\ntype: Agent\nname: Good\n---\n", "utf-8");
		const rows = dashboardAgentsFromAgentsMarkdownDir(dir, "Agents");
		expect(rows.map((r) => r.name)).toEqual(["Good"]);
	});

	it("collectAgentMarkdownPaths includes one subfolder level", () => {
		const agentsDir = join(dir, "Agents");
		mkdirSync(join(agentsDir, "sub"), { recursive: true });
		writeFileSync(join(agentsDir, "sub", "Nested.md"), "# x", "utf-8");
		const paths = collectAgentMarkdownPaths(agentsDir);
		expect(paths.some((p) => p.endsWith(join("sub", "Nested.md")))).toBe(true);
	});
});
