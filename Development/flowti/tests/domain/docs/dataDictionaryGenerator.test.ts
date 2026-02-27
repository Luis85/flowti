import { describe, it, expect } from "vitest";
import type { EntityTypeMeta } from "../../../src/domain/docs/entityTypeRegistry";
import {
	groupByGroup,
	buildGroupSummary,
	generateDataDictionary,
} from "../../../src/domain/docs/dataDictionaryGenerator";

const makeEntity = (overrides: Partial<EntityTypeMeta> = {}): EntityTypeMeta => ({
	typeName: "TestDoc",
	group: "catalog",
	tab: "Tests",
	folder: "Tests/",
	nameField: "test",
	filePattern: "{docsRoot}/Tests/{testName}.md",
	description: "Test document",
	fields: [
		{ name: "type", type: "string", required: true, description: "Type discriminator" },
		{ name: "name", type: "string", required: true, description: "Name" },
	],
	...overrides,
});

describe("groupByGroup", () => {
	it("groups entities by their group field", () => {
		const entities = [
			makeEntity({ typeName: "A", group: "catalog" }),
			makeEntity({ typeName: "B", group: "data-exchange" }),
			makeEntity({ typeName: "C", group: "catalog" }),
		];
		const groups = groupByGroup(entities);
		expect(groups.size).toBe(2);
		expect(groups.get("catalog")!.map((e) => e.typeName)).toEqual(["A", "C"]);
		expect(groups.get("data-exchange")!.map((e) => e.typeName)).toEqual(["B"]);
	});

	it("returns empty map for empty input", () => {
		expect(groupByGroup([]).size).toBe(0);
	});

	it("preserves insertion order", () => {
		const entities = [
			makeEntity({ typeName: "X", group: "special" }),
			makeEntity({ typeName: "Y", group: "catalog" }),
		];
		const keys = [...groupByGroup(entities).keys()];
		expect(keys).toEqual(["special", "catalog"]);
	});
});

describe("buildGroupSummary", () => {
	it("counts entities per group", () => {
		const entities = [
			makeEntity({ group: "catalog" }),
			makeEntity({ group: "catalog" }),
			makeEntity({ group: "data-exchange" }),
		];
		const summary = buildGroupSummary(entities);
		expect(summary.get("catalog")).toBe(2);
		expect(summary.get("data-exchange")).toBe(1);
	});

	it("returns empty map for empty input", () => {
		expect(buildGroupSummary([]).size).toBe(0);
	});
});

describe("generateDataDictionary", () => {
	const date = "2026-02-27T12:00:00.000Z";

	it("generates valid frontmatter", () => {
		const entities = [makeEntity()];
		const md = generateDataDictionary(entities, date);
		expect(md).toContain("---");
		expect(md).toContain("type: DataDictionary");
		expect(md).toContain(`date: "${date}"`);
		expect(md).toContain("total_types: 1");
		expect(md).toContain("groups: 1");
		expect(md).toContain("total_fields: 2");
	});

	it("includes summary callout", () => {
		const entities = [makeEntity()];
		const md = generateDataDictionary(entities, date);
		expect(md).toContain("> [!info] Summary");
		expect(md).toContain("Total types: 1 | Groups: 1 | Total fields: 2");
	});

	it("includes group summary table", () => {
		const entities = [
			makeEntity({ group: "catalog" }),
			makeEntity({ group: "data-exchange" }),
		];
		const md = generateDataDictionary(entities, date);
		expect(md).toContain("## Group Summary");
		expect(md).toContain("| Event Catalog | 1 |");
		expect(md).toContain("| Data Exchange | 1 |");
	});

	it("includes type overview table", () => {
		const entity = makeEntity({ typeName: "FlowDoc", tab: "Flows", folder: "Flows/" });
		const md = generateDataDictionary([entity], date);
		expect(md).toContain("## Type Overview");
		expect(md).toContain("| FlowDoc |");
		expect(md).toContain("| Flows |");
	});

	it("renders detailed sections per group", () => {
		const entity = makeEntity({
			typeName: "EventDoc",
			group: "catalog",
			description: "Event documentation",
		});
		const md = generateDataDictionary([entity], date);
		expect(md).toContain("## Event Catalog Types");
		expect(md).toContain("### EventDoc");
		expect(md).toContain("> Event documentation");
	});

	it("renders field tables with required indicator", () => {
		const entity = makeEntity({
			fields: [
				{ name: "type", type: "string", required: true, description: "Discriminator" },
				{ name: "name", type: "string", required: false, description: "Optional name" },
			],
		});
		const md = generateDataDictionary([entity], date);
		expect(md).toContain("| `type` | string | Yes | Discriminator |");
		expect(md).toContain("| `name` | string | No | Optional name |");
	});

	it("renders entity metadata fields", () => {
		const entity = makeEntity({
			tab: "Events",
			folder: "Events/",
			nameField: "event",
			filePattern: "{docsRoot}/Events/{eventType}.md",
		});
		const md = generateDataDictionary([entity], date);
		expect(md).toContain("- **Tab**: Events");
		expect(md).toContain("- **Folder**: `Events/`");
		expect(md).toContain("- **Name field**: `event`");
		expect(md).toContain("- **File pattern**: `{docsRoot}/Events/{eventType}.md`");
	});

	it("counts total fields across all entities", () => {
		const entities = [
			makeEntity({ fields: [{ name: "a", type: "string", required: true, description: "" }] }),
			makeEntity({
				group: "special",
				fields: [
					{ name: "b", type: "string", required: true, description: "" },
					{ name: "c", type: "number", required: false, description: "" },
				],
			}),
		];
		const md = generateDataDictionary(entities, date);
		expect(md).toContain("total_fields: 3");
	});

	it("handles empty entities array", () => {
		const md = generateDataDictionary([], date);
		expect(md).toContain("total_types: 0");
		expect(md).toContain("groups: 0");
		expect(md).toContain("total_fields: 0");
	});

	it("maps group labels correctly", () => {
		const entities = [
			makeEntity({ group: "catalog" }),
			makeEntity({ group: "data-exchange" }),
			makeEntity({ group: "special" }),
		];
		const md = generateDataDictionary(entities, date);
		expect(md).toContain("## Event Catalog Types");
		expect(md).toContain("## Data Exchange Types");
		expect(md).toContain("## Special Types");
	});

	it("renders multiple entities within the same group", () => {
		const entities = [
			makeEntity({ typeName: "Alpha", group: "catalog" }),
			makeEntity({ typeName: "Beta", group: "catalog" }),
		];
		const md = generateDataDictionary(entities, date);
		expect(md).toContain("### Alpha");
		expect(md).toContain("### Beta");
	});
});
