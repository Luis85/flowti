import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string, ext?: string) => {
			const base = p.split("/").pop() ?? "";
			return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
		},
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/mock",
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00Z", ms: () => 1000000 },
}));

import {
	findMatchingBrace,
	parseEntityBlock,
	extractEntityTypes,
	groupLabel,
} from "../../../../src/domain/reports/generators/data-dictionary.js";

// ── Tests ────────────────────────────────────────────────────────────

describe("findMatchingBrace", () => {
	it("finds matching closing brace", () => {
		const source = "{ inner }";
		expect(findMatchingBrace(source, 0)).toBe(8);
	});

	it("handles nested braces", () => {
		const source = "{ { inner } }";
		expect(findMatchingBrace(source, 0)).toBe(12);
	});

	it("returns openPos when no match", () => {
		expect(findMatchingBrace("{ unclosed", 0)).toBe(0);
	});
});

describe("parseEntityBlock", () => {
	it("parses a complete entity block", () => {
		const block = `{
			typeName: "EventDefinition",
			group: "catalog",
			tab: "Events",
			folder: "events",
			nameField: "event_name",
			filePattern: "*.md",
			description: "Defines an event in the catalog",
			fields: [
				{ name: "event_name", type: "string", required: true, description: "Unique event name" },
				{ name: "category", type: "string", required: false, description: "Event category" },
			],
		}`;
		const result = parseEntityBlock(block)!;
		expect(result.typeName).toBe("EventDefinition");
		expect(result.group).toBe("catalog");
		expect(result.tab).toBe("Events");
		expect(result.folder).toBe("events");
		expect(result.nameField).toBe("event_name");
		expect(result.filePattern).toBe("*.md");
		expect(result.description).toBe("Defines an event in the catalog");
		expect(result.fields).toHaveLength(2);
		expect(result.fields[0]).toEqual({ name: "event_name", type: "string", required: true, description: "Unique event name" });
		expect(result.fields[1].required).toBe(false);
	});

	it("returns null when no typeName", () => {
		expect(parseEntityBlock("{ group: \"test\" }")).toBeNull();
	});

	it("handles block with no fields", () => {
		const block = '{ typeName: "Simple", group: "misc", tab: "Other", folder: "other", nameField: "name", filePattern: "*.md", description: "A simple type" }';
		const result = parseEntityBlock(block)!;
		expect(result.typeName).toBe("Simple");
		expect(result.fields).toEqual([]);
	});
});

describe("extractEntityTypes", () => {
	it("extracts entities from registry source", () => {
		const source = `
const ENTITY_TYPE_REGISTRY: EntityTypeMeta[] = [
	{
		typeName: "Subscription",
		group: "data-exchange",
		tab: "Data",
		folder: "subscriptions",
		nameField: "name",
		filePattern: "*.md",
		description: "Data subscription",
		fields: [
			{ name: "name", type: "string", required: true, description: "Sub name" },
		],
	},
	{
		typeName: "Signal",
		group: "special",
		tab: "Signals",
		folder: "signals",
		nameField: "signal_name",
		filePattern: "*.md",
		description: "External signal",
		fields: [],
	},
];`;
		const entities = extractEntityTypes(source);
		expect(entities).toHaveLength(2);
		expect(entities[0].typeName).toBe("Subscription");
		expect(entities[0].group).toBe("data-exchange");
		expect(entities[0].fields).toHaveLength(1);
		expect(entities[1].typeName).toBe("Signal");
		expect(entities[1].fields).toEqual([]);
	});

	it("returns empty when ENTITY_TYPE_REGISTRY not found", () => {
		expect(extractEntityTypes("const OTHER = [];")).toEqual([]);
	});

	it("skips non-entity blocks", () => {
		const source = `ENTITY_TYPE_REGISTRY = [
			{ notAnEntity: true },
			{ typeName: "Real", group: "a", tab: "b", folder: "c", nameField: "d", filePattern: "e", description: "f", fields: [] },
		]`;
		const entities = extractEntityTypes(source);
		expect(entities).toHaveLength(1);
		expect(entities[0].typeName).toBe("Real");
	});
});

describe("groupLabel", () => {
	it("maps known group labels", () => {
		expect(groupLabel("catalog")).toBe("Event Catalog");
		expect(groupLabel("data-exchange")).toBe("Data Exchange");
		expect(groupLabel("special")).toBe("Special");
	});

	it("capitalizes unknown groups", () => {
		expect(groupLabel("analytics")).toBe("Analytics");
		expect(groupLabel("user")).toBe("User");
	});
});
