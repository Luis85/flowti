import { describe, it, expect, beforeEach } from "vitest";
import { BaseQueryEngine } from "../../../src/domain/dataExchange/BaseQueryEngine";
import type { BaseFilterGroup, VaultFileInfo } from "../../../src/domain/dataExchange/types";

/**
 * Creates a minimal VaultFileInfo for testing.
 */
function makeFile(overrides: Partial<VaultFileInfo> = {}): VaultFileInfo {
	const path = overrides.path ?? "folder/test.md";
	return {
		path,
		basename: overrides.basename ?? path.split("/").pop()!.replace(/\.\w+$/, ""),
		extension: overrides.extension ?? "md",
		folder: overrides.folder ?? (path.substring(0, path.lastIndexOf("/")) || ""),
		frontmatter: overrides.frontmatter,
	};
}

describe("BaseQueryEngine", () => {
	let engine: BaseQueryEngine;

	beforeEach(() => {
		engine = new BaseQueryEngine();
	});

	describe("parseFilterExpression", () => {
		it("should parse file.inFolder expression", () => {
			const filter = engine.parseFilterExpression('file.inFolder("03 - Resources/Events")');
			expect(filter.type).toBe("inFolder");
			expect(filter.value).toBe("03 - Resources/Events");
			expect(filter.negated).toBe(false);
		});

		it("should parse file.folder.contains expression", () => {
			const filter = engine.parseFilterExpression('file.folder.contains("features")');
			expect(filter.type).toBe("folderContains");
			expect(filter.value).toBe("features");
		});

		it("should parse file.folder.containsAny expression", () => {
			const filter = engine.parseFilterExpression('file.folder.containsAny("features")');
			expect(filter.type).toBe("folderContains");
			expect(filter.value).toBe("features");
		});

		it("should parse file.ext == expression", () => {
			const filter = engine.parseFilterExpression('file.ext == "md"');
			expect(filter.type).toBe("extEquals");
			expect(filter.value).toBe("md");
		});

		it("should parse file.name.contains expression", () => {
			const filter = engine.parseFilterExpression('file.name.contains("README")');
			expect(filter.type).toBe("nameContains");
			expect(filter.value).toBe("README");
		});

		it("should parse frontmatter property == expression", () => {
			const filter = engine.parseFilterExpression('type == "EventDoc"');
			expect(filter.type).toBe("propertyEquals");
			expect(filter.field).toBe("type");
			expect(filter.value).toBe("EventDoc");
		});

		it("should parse negated expression", () => {
			const filter = engine.parseFilterExpression('!file.ext == "md"');
			expect(filter.type).toBe("extEquals");
			expect(filter.negated).toBe(true);
		});

		it("should handle quoted expressions (single quotes wrapping)", () => {
			const filter = engine.parseFilterExpression("'!file.folder.contains(\"node_modules\")'");
			expect(filter.type).toBe("folderContains");
			expect(filter.value).toBe("node_modules");
			expect(filter.negated).toBe(true);
		});
	});

	describe("evaluateFilters", () => {
		const testFiles: VaultFileInfo[] = [
			makeFile({ path: "03 - Resources/Events/order.placed.md", frontmatter: { type: "EventDoc" } }),
			makeFile({ path: "03 - Resources/Events/user.created.md", frontmatter: { type: "EventDoc" } }),
			makeFile({ path: "features/import.md", frontmatter: { type: "Feature", domain: "Flowti" } }),
			makeFile({ path: "features/export.md", frontmatter: { type: "Feature", domain: "Flowti" } }),
			makeFile({ path: "README.md", folder: "", frontmatter: undefined }),
			makeFile({ path: "notes/meeting.txt", extension: "txt", frontmatter: undefined }),
		];

		it("should filter by inFolder (AND)", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "inFolder", field: "file", value: "03 - Resources/Events", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(2);
			expect(result.every((f) => f.folder.startsWith("03 - Resources/Events"))).toBe(true);
		});

		it("should filter by folderContains", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "folderContains", field: "file.folder", value: "features", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(2);
		});

		it("should filter by extension", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "extEquals", field: "file.ext", value: "txt", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(1);
			expect(result[0].extension).toBe("txt");
		});

		it("should filter by frontmatter property", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "propertyEquals", field: "type", value: "EventDoc", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(2);
		});

		it("should apply AND logic (all must match)", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "folderContains", field: "file.folder", value: "features", negated: false },
					{ type: "propertyEquals", field: "domain", value: "Flowti", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(2);
		});

		it("should apply OR logic (any can match)", () => {
			const group: BaseFilterGroup = {
				operator: "or",
				conditions: [
					{ type: "extEquals", field: "file.ext", value: "txt", negated: false },
					{ type: "propertyEquals", field: "type", value: "EventDoc", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(3);
		});

		it("should apply negation", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "extEquals", field: "file.ext", value: "md", negated: true },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(1);
			expect(result[0].extension).toBe("txt");
		});

		it("should handle nameContains filter", () => {
			const group: BaseFilterGroup = {
				operator: "and",
				conditions: [
					{ type: "nameContains", field: "file.name", value: "README", negated: false },
				],
			};
			const result = engine.evaluateFilters(testFiles, group);
			expect(result).toHaveLength(1);
			expect(result[0].basename).toBe("README");
		});
	});

	describe("parseBaseFile", () => {
		it("should parse a base file with global filters and views", () => {
			const yaml = `filters:
  and:
    - file.inFolder("03 - Resources/Documentation/Reference/Events")
    - type == "EventDoc"
views:
  - type: table
    name: Table`;

			const base = engine.parseBaseFile(yaml);
			expect(base.filters).toBeDefined();
			expect(base.filters!.operator).toBe("and");
			expect(base.filters!.conditions).toHaveLength(2);
			expect(base.views).toHaveLength(1);
			expect(base.views[0].name).toBe("Table");
		});

		it("should parse a base file with view-level filters", () => {
			const yaml = `filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Filtered
    filters:
      and:
        - file.folder.contains("features")`;

			const base = engine.parseBaseFile(yaml);
			expect(base.views[0].filters).toBeDefined();
			expect(base.views[0].filters!.conditions).toHaveLength(1);
		});

		it("should parse a base file with multiple views", () => {
			const yaml = `views:
  - type: table
    name: All
  - type: table
    name: Filtered
    order:
      - file.name
      - stage`;

			const base = engine.parseBaseFile(yaml);
			expect(base.views).toHaveLength(2);
			expect(base.views[1].order).toEqual(["file.name", "stage"]);
		});

		it("should handle empty base file", () => {
			const base = engine.parseBaseFile("");
			expect(base.views).toEqual([]);
			expect(base.filters).toBeUndefined();
		});

		it("should parse properties section with displayName", () => {
			const yaml = `properties:
  file.folder:
    displayName: Folder
  description:
    displayName: Beschreibung
views:
  - type: table
    name: Table`;

			const base = engine.parseBaseFile(yaml);
			expect(base.properties).toBeDefined();
			expect(base.properties!["file.folder"]).toEqual({ displayName: "Folder" });
			expect(base.properties!["description"]).toEqual({ displayName: "Beschreibung" });
		});

		it("should return undefined properties when none defined", () => {
			const base = engine.parseBaseFile(`views:
  - type: table
    name: Table`);

			expect(base.properties).toBeUndefined();
		});

		it("should parse formulas section", () => {
			const yaml = `formulas:
  Total: price
  Desc: description
views:
  - type: table
    name: Table`;

			const base = engine.parseBaseFile(yaml);
			expect(base.formulas).toBeDefined();
			expect(base.formulas!["Total"]).toBe("price");
			expect(base.formulas!["Desc"]).toBe("description");
		});

		it("should return undefined formulas when none defined", () => {
			const base = engine.parseBaseFile(`views:
  - type: table
    name: Table`);

			expect(base.formulas).toBeUndefined();
		});
	});

	describe("resolveView", () => {
		const testFiles: VaultFileInfo[] = [
			makeFile({ path: "03 - Resources/Events/order.placed.md", frontmatter: { type: "EventDoc" } }),
			makeFile({ path: "features/import.md", extension: "md", frontmatter: { type: "Feature" } }),
			makeFile({ path: "notes/todo.md", frontmatter: undefined }),
		];

		it("should apply global and view-level filters", () => {
			const base = engine.parseBaseFile(`filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Events
    filters:
      and:
        - type == "EventDoc"`);

			const result = engine.resolveView(testFiles, base, 0);
			expect(result).toHaveLength(1);
			expect(result[0].path).toBe("03 - Resources/Events/order.placed.md");
		});

		it("should return all files when no filters exist", () => {
			const base = engine.parseBaseFile(`views:
  - type: table
    name: All`);

			const result = engine.resolveView(testFiles, base, 0);
			expect(result).toHaveLength(3);
		});
	});
});
