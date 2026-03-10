import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-09" },
}));

import { generateAiToolReference } from "../../../src/domain/ai-tools/ai-tool-reference.js";
import type { LoadedAiTool } from "../../../src/domain/ai-tools/ai-tool-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function validTool(overrides: Partial<LoadedAiTool> = {}): LoadedAiTool {
	return {
		definition: {
			name: "search-docs",
			description: "Search project documentation",
			run: "grep -r $QUERY docs/",
			version: "1.0.0",
		},
		path: "/tools/search-docs.json",
		valid: true,
		errors: [],
		...overrides,
	};
}

function invalidTool(overrides: Partial<LoadedAiTool> = {}): LoadedAiTool {
	return {
		definition: {
			name: "broken-tool",
			description: "A broken tool",
			run: "",
		},
		path: "/tools/broken-tool.json",
		valid: false,
		errors: ["missing run command", "invalid params"],
		...overrides,
	};
}

// ── generateAiToolReference ──────────────────────────────────────────

describe("generateAiToolReference", () => {
	it("returns doc with 0 totals for empty tools list", () => {
		const doc = generateAiToolReference([]);
		const text = doc.toString();

		expect(text).toContain("total_tools: 0");
		expect(text).toContain("valid_tools: 0");
		expect(text).toContain("tags: 0");
		expect(text).toContain("Total tools: 0 | Valid: 0 | Tags: 0");
		expect(text).not.toContain("## Tools");
		expect(text).not.toContain("## Invalid Tools");
	});

	it("produces correct frontmatter for a single valid tool", () => {
		const doc = generateAiToolReference([validTool()]);
		const text = doc.toString();

		expect(text).toContain("type: AiToolReference");
		expect(text).toContain("date: 2026-03-09");
		expect(text).toContain("total_tools: 1");
		expect(text).toContain("valid_tools: 1");
		expect(text).toContain("tags: 0");
	});

	it("renders summary table for a single valid tool", () => {
		const doc = generateAiToolReference([validTool()]);
		const text = doc.toString();

		expect(text).toContain("## Tools");
		expect(text).toContain("| Tool | Version | Description | Params |");
		expect(text).toContain("| search-docs | 1.0.0 | Search project documentation | 0 |");
	});

	it("renders tool details section", () => {
		const doc = generateAiToolReference([validTool()]);
		const text = doc.toString();

		expect(text).toContain("### search-docs");
		expect(text).toContain("Search project documentation");
		expect(text).toContain("**Run**: `grep -r $QUERY docs/`");
	});

	it("renders params table when tool has params", () => {
		const tool = validTool({
			definition: {
				name: "search-docs",
				description: "Search project documentation",
				run: "grep -r $QUERY docs/",
				version: "1.0.0",
				params: [
					{ name: "query", type: "string", description: "Search term", required: true },
					{ name: "limit", type: "number", description: "Max results", required: false },
				],
			},
		});

		const doc = generateAiToolReference([tool]);
		const text = doc.toString();

		expect(text).toContain("#### Parameters");
		expect(text).toContain("| Name | Type | Required | Description |");
		expect(text).toContain("| query | string | Yes | Search term |");
		expect(text).toContain("| limit | number | No | Max results |");
	});

	it("renders cwd when tool has a working directory", () => {
		const tool = validTool({
			definition: {
				name: "search-docs",
				description: "Search project documentation",
				run: "grep -r $QUERY docs/",
				cwd: "/project/root",
			},
		});

		const doc = generateAiToolReference([tool]);
		const text = doc.toString();

		expect(text).toContain("**Working directory**: `/project/root`");
	});

	it("renders tags line when tool has tags", () => {
		const tool = validTool({
			definition: {
				name: "search-docs",
				description: "Search project documentation",
				run: "grep -r $QUERY docs/",
				tags: ["search", "docs"],
			},
		});

		const doc = generateAiToolReference([tool]);
		const text = doc.toString();

		expect(text).toContain("**Tags**: search, docs");
	});

	it("renders invalid tools in a warning callout with errors", () => {
		const tool = invalidTool();
		const doc = generateAiToolReference([tool]);
		const text = doc.toString();

		expect(text).toContain("## Invalid Tools");
		expect(text).toContain("> [!warning] Validation Errors");
		expect(text).toContain("**broken-tool**: missing run command, invalid params");
	});

	it("renders both valid and invalid sections with correct counts", () => {
		const tools = [validTool(), invalidTool()];
		const doc = generateAiToolReference(tools);
		const text = doc.toString();

		expect(text).toContain("total_tools: 2");
		expect(text).toContain("valid_tools: 1");
		expect(text).toContain("Total tools: 2 | Valid: 1 | Tags: 0");
		expect(text).toContain("## Tools");
		expect(text).toContain("## Invalid Tools");
	});

	it("collects and deduplicates tags across tools", () => {
		const tools = [
			validTool({
				definition: {
					name: "tool-a",
					description: "A",
					run: "a",
					tags: ["search", "docs"],
				},
			}),
			validTool({
				definition: {
					name: "tool-b",
					description: "B",
					run: "b",
					tags: ["docs", "build"],
				},
			}),
		];

		const doc = generateAiToolReference(tools);
		const text = doc.toString();

		// 3 unique tags: build, docs, search (sorted)
		expect(text).toContain("tags: 3");
		expect(text).toContain("Tags: 3");
	});

	it("does not count tags from invalid tools", () => {
		const tools = [
			invalidTool({
				definition: {
					name: "broken",
					description: "Broken",
					run: "",
					tags: ["ignored"],
				},
			}),
		];

		const doc = generateAiToolReference(tools);
		const text = doc.toString();

		expect(text).toContain("tags: 0");
	});

	it("version defaults to dash when not specified", () => {
		const tool = validTool({
			definition: {
				name: "no-version",
				description: "No version",
				run: "echo hello",
			},
		});

		const doc = generateAiToolReference([tool]);
		const text = doc.toString();

		expect(text).toContain("| no-version | - | No version | 0 |");
	});
});
