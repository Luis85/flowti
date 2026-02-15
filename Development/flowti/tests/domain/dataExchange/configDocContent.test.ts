import { describe, it, expect } from "vitest";
import {
	sanitizeDocName,
	getConfigsFolder,
	getReportsFolder,
	getPropertiesFolder,
	getTypesFolder,
	getCsvDocPath,
	getLegacyCsvDocPath,
	getConfigDocPath,
	getPropertyDocPath,
	getPipelineDocPath,
	getEventDocPath,
	getTypeDocPath,
	buildCsvDocContent,
	buildPropertyDocContent,
	buildImportDocContent,
	buildExportDocContent,
	buildPipelineDocContent,
	buildTypeDocContent,
} from "../../../src/domain/dataExchange/configDocContent";
import type {
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
	DataDictionaryEntry,
	DataDictionaryConfigRef,
} from "../../../src/domain/dataExchange/types";
import type { PipelineDocContext, TypeDocContext } from "../../../src/domain/dataExchange/configDocContent";

// ── Fixture factories ────────────────────────────────────

function makeImportConfig(overrides: Partial<SavedImportConfig> = {}): SavedImportConfig {
	return {
		id: "imp-1",
		name: "Test Import",
		createdAt: 1700000000000,
		targetFolder: "Notes/Imported",
		nameColumn: "Name",
		columnMappings: [
			{ csvColumn: "Name", frontmatterKey: "name", included: true },
			{ csvColumn: "Desc", frontmatterKey: "description", included: true },
		],
		conflictStrategy: "skip",
		...overrides,
	};
}

function makeExportConfig(overrides: Partial<SavedExportConfig> = {}): SavedExportConfig {
	return {
		id: "exp-1",
		name: "Test Export",
		createdAt: 1700000000000,
		sourcePath: "Data/source.base",
		sourceType: "base",
		format: "csv",
		outputPath: "Exports/output.csv",
		columns: ["title", "description"],
		fileProperties: ["file.name"],
		...overrides,
	};
}

function makePipeline(overrides: Partial<SavedMultiImportPipeline> = {}): SavedMultiImportPipeline {
	return {
		id: "pipe-1",
		name: "Test Pipeline",
		createdAt: 1700000000000,
		targetFolder: "Notes/Merged",
		mergeKey: "item_id",
		sources: [
			{
				id: "src-1",
				csvPath: "Data/source1.csv",
				mergeKeyColumn: "ID",
				columnMappings: [
					{ csvColumn: "ID", frontmatterKey: "item_id", included: true },
					{ csvColumn: "Title", frontmatterKey: "title", included: true },
					{ csvColumn: "Extra", frontmatterKey: "extra", included: false },
				],
			},
		],
		...overrides,
	};
}

function makePipelineCtx(overrides: Partial<PipelineDocContext> = {}): PipelineDocContext {
	return {
		getExportConfig: () => undefined,
		docsRoot: "Docs/Reference",
		...overrides,
	};
}

function makeTypeCtx(overrides: Partial<TypeDocContext> = {}): TypeDocContext {
	return {
		docsRoot: "Docs/Reference",
		pipelines: [],
		importConfigs: [],
		exportConfigs: [],
		...overrides,
	};
}

// ── sanitizeDocName ──────────────────────────────────────

describe("sanitizeDocName", () => {
	it("returns a normal name unchanged", () => {
		expect(sanitizeDocName("My Config")).toBe("My Config");
	});

	it("strips backslash, colon, asterisk, question mark, quotes, angle brackets, pipe", () => {
		expect(sanitizeDocName('a\\b:c*d?e"f<g>h|i')).toBe("abcdefghi");
	});

	it("strips hash, caret, square brackets", () => {
		expect(sanitizeDocName("tag#1 ^ref [link]")).toBe("tag1 ref link");
	});

	it("collapses multiple whitespace characters into a single space", () => {
		expect(sanitizeDocName("a   b\t\tc")).toBe("a b c");
	});

	it("trims leading and trailing whitespace", () => {
		expect(sanitizeDocName("  hello  ")).toBe("hello");
	});

	it("returns empty string for empty input", () => {
		expect(sanitizeDocName("")).toBe("");
	});

	it("returns empty string when all characters are special", () => {
		expect(sanitizeDocName('\\/:*?"<>|#^[]')).toBe("");
	});

	it("handles forward slash removal", () => {
		expect(sanitizeDocName("a/b/c")).toBe("abc");
	});
});

// ── Folder path helpers ──────────────────────────────────

describe("getConfigsFolder", () => {
	it("returns Configs under the docs root", () => {
		expect(getConfigsFolder("Docs/Reference")).toBe("Docs/Reference/Configs");
	});

	it("strips trailing slash from docs root", () => {
		expect(getConfigsFolder("Docs/Reference/")).toBe("Docs/Reference/Configs");
	});

	it("strips multiple trailing slashes", () => {
		expect(getConfigsFolder("Docs///")).toBe("Docs/Configs");
	});

	it("handles single-segment root", () => {
		expect(getConfigsFolder("Root")).toBe("Root/Configs");
	});
});

describe("getReportsFolder", () => {
	it("returns Reports under the docs root", () => {
		expect(getReportsFolder("Docs/Reference")).toBe("Docs/Reference/Reports");
	});

	it("strips trailing slash", () => {
		expect(getReportsFolder("Docs/")).toBe("Docs/Reports");
	});
});

describe("getPropertiesFolder", () => {
	it("returns Properties under the docs root", () => {
		expect(getPropertiesFolder("Docs/Reference")).toBe("Docs/Reference/Properties");
	});

	it("strips trailing slash", () => {
		expect(getPropertiesFolder("Docs/")).toBe("Docs/Properties");
	});
});

describe("getTypesFolder", () => {
	it("returns Types under the docs root", () => {
		expect(getTypesFolder("Docs/Reference")).toBe("Docs/Reference/Types");
	});

	it("strips trailing slash", () => {
		expect(getTypesFolder("Docs/")).toBe("Docs/Types");
	});
});

// ── Document path helpers ────────────────────────────────

describe("getCsvDocPath", () => {
	it("returns basename-only path for root-level csv files", () => {
		expect(getCsvDocPath("Docs", "file.csv")).toBe("Docs/Reports/CSV - file.md");
	});

	it("includes parent folder for nested csv files", () => {
		expect(getCsvDocPath("Docs", "Data/products.csv")).toBe("Docs/Reports/CSV - products (Data).md");
	});

	it("includes full folder path for deeply nested csv files", () => {
		expect(getCsvDocPath("Root", "a/b/c/deep.csv")).toBe("Root/Reports/CSV - deep (a - b - c).md");
	});

	it("sanitizes special characters in csv filename", () => {
		expect(getCsvDocPath("Docs", 'my*file?.csv')).toBe("Docs/Reports/CSV - myfile.md");
	});

	it("strips trailing slash from docs root", () => {
		expect(getCsvDocPath("Docs/", "data.csv")).toBe("Docs/Reports/CSV - data.md");
	});

	it("disambiguates same-named files in different folders", () => {
		const pathA = getCsvDocPath("Docs", "HR/employees.csv");
		const pathB = getCsvDocPath("Docs", "Finance/employees.csv");
		expect(pathA).not.toBe(pathB);
		expect(pathA).toBe("Docs/Reports/CSV - employees (HR).md");
		expect(pathB).toBe("Docs/Reports/CSV - employees (Finance).md");
	});
});

describe("getLegacyCsvDocPath", () => {
	it("returns basename-only path regardless of folder", () => {
		expect(getLegacyCsvDocPath("Docs", "Data/products.csv")).toBe("Docs/Reports/CSV - products.md");
		expect(getLegacyCsvDocPath("Docs", "a/b/c/deep.csv")).toBe("Docs/Reports/CSV - deep.md");
	});

	it("matches getCsvDocPath for root-level files", () => {
		expect(getLegacyCsvDocPath("Docs", "file.csv")).toBe(getCsvDocPath("Docs", "file.csv"));
	});
});

describe("getConfigDocPath", () => {
	it("generates import config doc path", () => {
		expect(getConfigDocPath("Docs", "My Import", "import")).toBe("Docs/Configs/Import - My Import.md");
	});

	it("generates export config doc path", () => {
		expect(getConfigDocPath("Docs", "My Export", "export")).toBe("Docs/Configs/Export - My Export.md");
	});

	it("sanitizes config name", () => {
		expect(getConfigDocPath("Docs", "bad*name?", "import")).toBe("Docs/Configs/Import - badname.md");
	});

	it("strips trailing slash from docs root", () => {
		expect(getConfigDocPath("Docs/", "Cfg", "export")).toBe("Docs/Configs/Export - Cfg.md");
	});
});

describe("getPropertyDocPath", () => {
	it("generates property doc path", () => {
		expect(getPropertyDocPath("Docs", "description")).toBe("Docs/Properties/Property - description.md");
	});

	it("sanitizes property name", () => {
		expect(getPropertyDocPath("Docs", "bad#prop")).toBe("Docs/Properties/Property - badprop.md");
	});

	it("strips trailing slash", () => {
		expect(getPropertyDocPath("Docs/", "title")).toBe("Docs/Properties/Property - title.md");
	});
});

describe("getPipelineDocPath", () => {
	it("generates pipeline doc path", () => {
		expect(getPipelineDocPath("Docs", "My Pipeline")).toBe("Docs/Configs/Pipeline - My Pipeline.md");
	});

	it("sanitizes pipeline name", () => {
		expect(getPipelineDocPath("Docs", "pipe|line")).toBe("Docs/Configs/Pipeline - pipeline.md");
	});

	it("strips trailing slash", () => {
		expect(getPipelineDocPath("Docs/", "P")).toBe("Docs/Configs/Pipeline - P.md");
	});
});

describe("getEventDocPath", () => {
	it("generates event doc path", () => {
		expect(getEventDocPath("Docs", "user.created")).toBe("Docs/Events/user.created.md");
	});

	it("does not sanitize event type (dots are valid)", () => {
		expect(getEventDocPath("Docs", "data.import.completed")).toBe("Docs/Events/data.import.completed.md");
	});

	it("strips trailing slash from docs root", () => {
		expect(getEventDocPath("Docs/", "test.event")).toBe("Docs/Events/test.event.md");
	});
});

describe("getTypeDocPath", () => {
	it("generates type doc path", () => {
		expect(getTypeDocPath("Docs", "Event")).toBe("Docs/Types/Type - Event.md");
	});

	it("sanitizes type name", () => {
		expect(getTypeDocPath("Docs", "My[Type]")).toBe("Docs/Types/Type - MyType.md");
	});

	it("strips trailing slash", () => {
		expect(getTypeDocPath("Docs/", "Asset")).toBe("Docs/Types/Type - Asset.md");
	});
});

// ── buildCsvDocContent ───────────────────────────────────

describe("buildCsvDocContent", () => {
	it("includes YAML frontmatter with type CsvDoc", () => {
		const content = buildCsvDocContent("data.csv", ["A", "B"], 10);
		expect(content.includes("type: CsvDoc")).toBe(true);
	});

	it("includes csv file path in frontmatter", () => {
		const content = buildCsvDocContent("Data/test.csv", ["Col1"], 5);
		expect(content.includes('filePath: "Data/test.csv"')).toBe(true);
	});

	it("includes basename as H1 heading", () => {
		const content = buildCsvDocContent("folder/products.csv", ["A"], 1);
		expect(content.includes("# products.csv")).toBe(true);
	});

	it("includes column count and row count", () => {
		const content = buildCsvDocContent("f.csv", ["X", "Y", "Z"], 42);
		expect(content.includes("columns: 3")).toBe(true);
		expect(content.includes("rows: 42")).toBe(true);
	});

	it("includes headers array in frontmatter", () => {
		const content = buildCsvDocContent("f.csv", ["Name", "Age"], 1);
		expect(content.includes('headers: ["Name", "Age"]')).toBe(true);
	});

	it("defaults delimiter to comma", () => {
		const content = buildCsvDocContent("f.csv", [], 0);
		expect(content.includes('delimiter: ","')).toBe(true);
	});

	it("uses custom delimiter when provided", () => {
		const content = buildCsvDocContent("f.csv", [], 0, "\t");
		expect(content.includes('delimiter: "\t"')).toBe(true);
	});

	it("produces empty headers array for no headers", () => {
		const content = buildCsvDocContent("f.csv", [], 0);
		expect(content.includes("headers: []")).toBe(true);
		expect(content.includes("columns: 0")).toBe(true);
	});

	it("includes Overview section with file wikilink", () => {
		const content = buildCsvDocContent("my.csv", ["A"], 5);
		expect(content.includes("## Overview")).toBe(true);
		expect(content.includes("[[my.csv]]")).toBe(true);
	});

	it("extracts basename from nested path", () => {
		const content = buildCsvDocContent("a/b/c/deep.csv", ["H"], 1);
		expect(content.includes("# deep.csv")).toBe(true);
		expect(content.includes('name: "deep.csv"')).toBe(true);
	});
});

// ── buildImportDocContent ────────────────────────────────

describe("buildImportDocContent", () => {
	it("includes ImportConfigDoc type in frontmatter", () => {
		const content = buildImportDocContent(makeImportConfig());
		expect(content.includes("type: ImportConfigDoc")).toBe(true);
	});

	it("includes config name as H1 heading", () => {
		const content = buildImportDocContent(makeImportConfig({ name: "Products Import" }));
		expect(content.includes("# Products Import")).toBe(true);
	});

	it("includes configId in frontmatter", () => {
		const content = buildImportDocContent(makeImportConfig({ id: "abc-123" }));
		expect(content.includes('configId: "abc-123"')).toBe(true);
	});

	it("includes target folder in settings table", () => {
		const content = buildImportDocContent(makeImportConfig({ targetFolder: "My/Notes" }));
		expect(content.includes("`My/Notes`")).toBe(true);
	});

	it("includes name column in settings table", () => {
		const content = buildImportDocContent(makeImportConfig({ nameColumn: "Title" }));
		expect(content.includes("`Title`")).toBe(true);
	});

	it("shows conflict strategy in settings table", () => {
		const content = buildImportDocContent(makeImportConfig({ conflictStrategy: "overwrite" }));
		expect(content.includes("overwrite")).toBe(true);
	});

	it("includes column mappings table", () => {
		const content = buildImportDocContent(makeImportConfig());
		expect(content.includes("## Column Mappings")).toBe(true);
		expect(content.includes("| Name | `name` | Yes |")).toBe(true);
		expect(content.includes("| Desc | `description` | Yes |")).toBe(true);
	});

	it("shows included column count in settings", () => {
		const config = makeImportConfig({
			columnMappings: [
				{ csvColumn: "A", frontmatterKey: "a", included: true },
				{ csvColumn: "B", frontmatterKey: "b", included: false },
				{ csvColumn: "C", frontmatterKey: "c", included: true },
			],
		});
		const content = buildImportDocContent(config);
		expect(content.includes("2 of 3")).toBe(true);
	});

	it("includes custom properties section when present", () => {
		const config = makeImportConfig({
			customProperties: { status: "draft", category: "imported" },
		});
		const content = buildImportDocContent(config);
		expect(content.includes("## Custom Properties")).toBe(true);
		expect(content.includes("`status` = `draft`")).toBe(true);
		expect(content.includes("`category` = `imported`")).toBe(true);
	});

	it("omits custom properties section when empty", () => {
		const content = buildImportDocContent(makeImportConfig({ customProperties: {} }));
		expect(content.includes("## Custom Properties")).toBe(false);
	});

	it("omits custom properties section when undefined", () => {
		const content = buildImportDocContent(makeImportConfig());
		expect(content.includes("## Custom Properties")).toBe(false);
	});

	it("includes user notes when provided", () => {
		const content = buildImportDocContent(makeImportConfig(), "Run weekly on Mondays.");
		expect(content.includes("## Notes")).toBe(true);
		expect(content.includes("Run weekly on Mondays.")).toBe(true);
	});

	it("includes default notes placeholder when no user notes", () => {
		const content = buildImportDocContent(makeImportConfig());
		expect(content.includes("> Document usage notes, scheduling, or workflow context.")).toBe(true);
	});

	it("includes noteType in frontmatter and settings table when present", () => {
		const content = buildImportDocContent(makeImportConfig({ noteType: "Event" }));
		expect(content.includes('noteType: "Event"')).toBe(true);
		expect(content.includes("Type - Event")).toBe(true);
	});

	it("omits noteType lines when not present", () => {
		const content = buildImportDocContent(makeImportConfig({ noteType: undefined }));
		expect(content.includes("noteType:")).toBe(false);
		expect(content.includes("Note Type")).toBe(false);
	});

	it("includes sourcePath in frontmatter and settings table when present", () => {
		const content = buildImportDocContent(makeImportConfig({ sourcePath: "Data/input.csv" }));
		expect(content.includes('sourcePath: "Data/input.csv"')).toBe(true);
		expect(content.includes("input.csv")).toBe(true);
	});

	it("omits sourcePath lines when not present", () => {
		const content = buildImportDocContent(makeImportConfig({ sourcePath: undefined }));
		expect(content.includes("sourcePath:")).toBe(false);
		expect(content.includes("Source CSV")).toBe(false);
	});

	it("shows name prefix and suffix when present", () => {
		const content = buildImportDocContent(makeImportConfig({ namePrefix: "PRE-", nameSuffix: "-SUF" }));
		expect(content.includes("`PRE-`")).toBe(true);
		expect(content.includes("`-SUF`")).toBe(true);
	});

	it("shows _(none)_ for missing prefix and suffix", () => {
		const content = buildImportDocContent(makeImportConfig());
		expect(content.includes("_(none)_")).toBe(true);
	});
});

// ── buildExportDocContent ────────────────────────────────

describe("buildExportDocContent", () => {
	it("includes ExportConfigDoc type in frontmatter", () => {
		const content = buildExportDocContent(makeExportConfig());
		expect(content.includes("type: ExportConfigDoc")).toBe(true);
	});

	it("includes config name as H1 heading", () => {
		const content = buildExportDocContent(makeExportConfig({ name: "Quarterly Export" }));
		expect(content.includes("# Quarterly Export")).toBe(true);
	});

	it("includes configId in frontmatter", () => {
		const content = buildExportDocContent(makeExportConfig({ id: "exp-xyz" }));
		expect(content.includes('configId: "exp-xyz"')).toBe(true);
	});

	it("shows CSV format label for csv format", () => {
		const content = buildExportDocContent(makeExportConfig({ format: "csv" }));
		expect(content.includes("| CSV |")).toBe(true);
	});

	it("shows Tab-delimited format label for tab format", () => {
		const content = buildExportDocContent(makeExportConfig({ format: "tab" }));
		expect(content.includes("| Tab-delimited |")).toBe(true);
	});

	it("includes source path as wikilink in settings table", () => {
		const content = buildExportDocContent(makeExportConfig({ sourcePath: "Data/source.base" }));
		expect(content.includes("[[Data/source.base")).toBe(true);
		expect(content.includes("source.base")).toBe(true);
	});

	it("includes source type in settings table", () => {
		const content = buildExportDocContent(makeExportConfig({ sourceType: "folder" }));
		expect(content.includes("| folder |")).toBe(true);
	});

	it("includes output path in settings table", () => {
		const content = buildExportDocContent(makeExportConfig({ outputPath: "Exports/out.csv" }));
		expect(content.includes("`Exports/out.csv`")).toBe(true);
	});

	it("includes note properties section with columns", () => {
		const content = buildExportDocContent(makeExportConfig({ columns: ["title", "status", "priority"] }));
		expect(content.includes("## Note Properties")).toBe(true);
		expect(content.includes("`title`")).toBe(true);
		expect(content.includes("`status`")).toBe(true);
		expect(content.includes("`priority`")).toBe(true);
	});

	it("includes file properties section", () => {
		const content = buildExportDocContent(makeExportConfig({ fileProperties: ["file.name", "file.path"] }));
		expect(content.includes("## File Properties")).toBe(true);
		expect(content.includes("`file.name`")).toBe(true);
		expect(content.includes("`file.path`")).toBe(true);
	});

	it("includes isExternal flag in frontmatter when true", () => {
		const content = buildExportDocContent(makeExportConfig({ isExternal: true }));
		expect(content.includes("isExternal: true")).toBe(true);
		expect(content.includes("| **External**")).toBe(true);
		expect(content.includes("| Yes |")).toBe(true);
	});

	it("omits isExternal when not set", () => {
		const content = buildExportDocContent(makeExportConfig({ isExternal: undefined }));
		expect(content.includes("isExternal")).toBe(false);
		expect(content.includes("External")).toBe(false);
	});

	it("includes noteType when present", () => {
		const content = buildExportDocContent(makeExportConfig({ noteType: "Asset" }));
		expect(content.includes('noteType: "Asset"')).toBe(true);
		expect(content.includes("Type - Asset")).toBe(true);
	});

	it("omits noteType when not present", () => {
		const content = buildExportDocContent(makeExportConfig({ noteType: undefined }));
		expect(content.includes("noteType:")).toBe(false);
	});

	it("includes user notes when provided", () => {
		const content = buildExportDocContent(makeExportConfig(), "Export for reporting.");
		expect(content.includes("## Notes")).toBe(true);
		expect(content.includes("Export for reporting.")).toBe(true);
	});

	it("includes default notes placeholder when no user notes", () => {
		const content = buildExportDocContent(makeExportConfig());
		expect(content.includes("> Document usage notes, scheduling, or workflow context.")).toBe(true);
	});

	it("defaults conflict strategy to overwrite", () => {
		const content = buildExportDocContent(makeExportConfig({ conflictStrategy: undefined }));
		expect(content.includes("overwrite")).toBe(true);
	});

	it("shows explicit conflict strategy", () => {
		const content = buildExportDocContent(makeExportConfig({ conflictStrategy: "append" }));
		expect(content.includes("append")).toBe(true);
	});

	it("omits note properties section when columns is empty", () => {
		const content = buildExportDocContent(makeExportConfig({ columns: [] }));
		expect(content.includes("## Note Properties")).toBe(false);
	});

	it("omits file properties section when fileProperties is empty", () => {
		const content = buildExportDocContent(makeExportConfig({ fileProperties: [] }));
		expect(content.includes("## File Properties")).toBe(false);
	});
});

// ── buildPipelineDocContent ──────────────────────────────

describe("buildPipelineDocContent", () => {
	it("includes PipelineConfigDoc type in frontmatter", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		expect(content.includes("type: PipelineConfigDoc")).toBe(true);
	});

	it("includes pipeline name as H1 heading", () => {
		const content = buildPipelineDocContent(makePipeline({ name: "Product Merge" }), makePipelineCtx());
		expect(content.includes("# Product Merge")).toBe(true);
	});

	it("includes target folder and merge key in settings", () => {
		const content = buildPipelineDocContent(
			makePipeline({ targetFolder: "Notes/All", mergeKey: "sku" }),
			makePipelineCtx(),
		);
		expect(content.includes("`Notes/All`")).toBe(true);
		expect(content.includes("`sku`")).toBe(true);
	});

	it("includes source count in settings", () => {
		const pipeline = makePipeline({
			sources: [
				{ id: "s1", csvPath: "a.csv", mergeKeyColumn: "id", columnMappings: [] },
				{ id: "s2", csvPath: "b.csv", mergeKeyColumn: "id", columnMappings: [] },
			],
		});
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes("| 2 |")).toBe(true);
	});

	it("includes sources section with csv wikilinks", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		expect(content.includes("## Sources")).toBe(true);
		expect(content.includes("[[Data/source1.csv|source1.csv]]")).toBe(true);
	});

	it("shows merge key column mapping for each source", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		expect(content.includes("`ID` \u2192 `item_id`")).toBe(true);
	});

	it("shows mapped column count for sources", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		// 2 included out of 3
		expect(content.includes("2 of 3")).toBe(true);
	});

	it("includes column mappings table for source", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		expect(content.includes("| ID | `item_id` |")).toBe(true);
		expect(content.includes("| Title | `title` |")).toBe(true);
	});

	it("excludes non-included columns from mappings table", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		// "Extra" column is not included, so should not appear in the table
		expect(content.includes("| Extra | `extra` |")).toBe(false);
	});

	it("includes export steps table when exportConfigIds present and configs resolved", () => {
		const exportCfg = makeExportConfig({ id: "exp-a", name: "Out CSV", format: "csv", outputPath: "out.csv", conflictStrategy: "skip" });
		const ctx = makePipelineCtx({
			getExportConfig: (id) => (id === "exp-a" ? exportCfg : undefined),
		});
		const pipeline = makePipeline({ exportConfigIds: ["exp-a"] });
		const content = buildPipelineDocContent(pipeline, ctx);
		expect(content.includes("## Export Steps")).toBe(true);
		expect(content.includes("Export - Out CSV")).toBe(true);
		expect(content.includes("| CSV |")).toBe(true);
		expect(content.includes("skip")).toBe(true);
	});

	it("shows _(deleted config)_ for missing export configs", () => {
		const ctx = makePipelineCtx({ getExportConfig: () => undefined });
		const pipeline = makePipeline({ exportConfigIds: ["missing-id"] });
		const content = buildPipelineDocContent(pipeline, ctx);
		expect(content.includes("_(deleted config)_")).toBe(true);
	});

	it("shows Tab format label for tab export config", () => {
		const exportCfg = makeExportConfig({ id: "exp-t", name: "Tab Out", format: "tab", outputPath: "out.txt" });
		const ctx = makePipelineCtx({
			getExportConfig: (id) => (id === "exp-t" ? exportCfg : undefined),
		});
		const pipeline = makePipeline({ exportConfigIds: ["exp-t"] });
		const content = buildPipelineDocContent(pipeline, ctx);
		expect(content.includes("| Tab |")).toBe(true);
	});

	it("includes base view section when createBase and basePath set", () => {
		const pipeline = makePipeline({ createBase: true, basePath: "Views/merged.base" });
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes("## Base View")).toBe(true);
		expect(content.includes("[[Views/merged.base]]")).toBe(true);
	});

	it("omits base view section when createBase is false", () => {
		const pipeline = makePipeline({ createBase: false, basePath: "Views/merged.base" });
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes("## Base View")).toBe(false);
	});

	it("includes lastExecutedAt in frontmatter and settings when present", () => {
		const pipeline = makePipeline({ lastExecutedAt: 1700100000000 });
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		const lastRunIso = new Date(1700100000000).toISOString();
		expect(content.includes(`lastExecuted: "${lastRunIso}"`)).toBe(true);
		expect(content.includes("**Last Run**")).toBe(true);
	});

	it("omits lastExecuted when not present", () => {
		const pipeline = makePipeline({ lastExecutedAt: undefined });
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes("lastExecuted:")).toBe(false);
	});

	it("includes noteType in frontmatter and settings when present", () => {
		const pipeline = makePipeline({ noteType: "Product" });
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes('noteType: "Product"')).toBe(true);
		expect(content.includes("Type - Product")).toBe(true);
	});

	it("includes namePrefix and nameSuffix in settings when present", () => {
		const pipeline = makePipeline({ namePrefix: "P-", nameSuffix: "-v2" });
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes("`P-`")).toBe(true);
		expect(content.includes("`-v2`")).toBe(true);
	});

	it("includes custom properties for sources when present", () => {
		const pipeline = makePipeline({
			sources: [
				{
					id: "s1",
					csvPath: "data.csv",
					mergeKeyColumn: "id",
					columnMappings: [{ csvColumn: "id", frontmatterKey: "id", included: true }],
					customProperties: { source: "csv", batch: "2024-Q1" },
				},
			],
		});
		const content = buildPipelineDocContent(pipeline, makePipelineCtx());
		expect(content.includes("**Custom Properties**")).toBe(true);
		expect(content.includes("`source`=`csv`")).toBe(true);
		expect(content.includes("`batch`=`2024-Q1`")).toBe(true);
	});

	it("includes related section with target folder and source files", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		expect(content.includes("## Related")).toBe(true);
		expect(content.includes("**Target folder**")).toBe(true);
		expect(content.includes("**Source files**")).toBe(true);
	});

	it("includes related export configs when exportConfigIds present", () => {
		const exportCfg = makeExportConfig({ id: "exp-r", name: "Related Export" });
		const ctx = makePipelineCtx({
			getExportConfig: (id) => (id === "exp-r" ? exportCfg : undefined),
		});
		const pipeline = makePipeline({ exportConfigIds: ["exp-r"] });
		const content = buildPipelineDocContent(pipeline, ctx);
		expect(content.includes("**Export configs**")).toBe(true);
		expect(content.includes("Export - Related Export")).toBe(true);
	});

	it("includes user notes when provided", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx(), "Pipeline scheduled weekly.");
		expect(content.includes("Pipeline scheduled weekly.")).toBe(true);
	});

	it("includes default notes placeholder when no user notes", () => {
		const content = buildPipelineDocContent(makePipeline(), makePipelineCtx());
		expect(content.includes("> Document usage notes, scheduling, or workflow context.")).toBe(true);
	});

	it("includes export step names in settings table when exportConfigIds present", () => {
		const exportCfg = makeExportConfig({ id: "exp-s", name: "Step Export" });
		const ctx = makePipelineCtx({
			getExportConfig: (id) => (id === "exp-s" ? exportCfg : undefined),
		});
		const pipeline = makePipeline({ exportConfigIds: ["exp-s"] });
		const content = buildPipelineDocContent(pipeline, ctx);
		expect(content.includes("**Export Steps**")).toBe(true);
		expect(content.includes("Step Export")).toBe(true);
	});
});

// ── buildTypeDocContent ──────────────────────────────────

describe("buildTypeDocContent", () => {
	it("includes TypeDoc type in frontmatter", () => {
		const content = buildTypeDocContent("Event", [], makeTypeCtx());
		expect(content.includes("type: TypeDoc")).toBe(true);
	});

	it("includes type name as H1 heading", () => {
		const content = buildTypeDocContent("Product", [], makeTypeCtx());
		expect(content.includes("# Product")).toBe(true);
	});

	it("includes type name in frontmatter", () => {
		const content = buildTypeDocContent("Asset", [], makeTypeCtx());
		expect(content.includes('name: "Asset"')).toBe(true);
	});

	it("includes properties array in frontmatter", () => {
		const content = buildTypeDocContent("Event", ["title", "status"], makeTypeCtx());
		expect(content.includes('properties: ["title", "status"]')).toBe(true);
	});

	it("shows expected properties count in overview", () => {
		const content = buildTypeDocContent("Event", ["a", "b", "c"], makeTypeCtx());
		expect(content.includes("**Expected Properties**: 3")).toBe(true);
	});

	it("shows total config count in overview", () => {
		const ctx = makeTypeCtx({
			pipelines: [{ name: "P1", sources: [] }],
			importConfigs: [{ name: "I1" }],
			exportConfigs: [{ name: "E1" }],
		});
		const content = buildTypeDocContent("Event", [], ctx);
		expect(content.includes("**Used by Configs**: 3")).toBe(true);
	});

	it("includes expected properties table when properties present", () => {
		const content = buildTypeDocContent("Event", ["title", "status"], makeTypeCtx());
		expect(content.includes("## Expected Properties")).toBe(true);
		expect(content.includes("Property - title")).toBe(true);
		expect(content.includes("Property - status")).toBe(true);
	});

	it("omits expected properties table when properties empty", () => {
		const content = buildTypeDocContent("Event", [], makeTypeCtx());
		expect(content.includes("## Expected Properties")).toBe(false);
	});

	it("includes configs section with pipeline links", () => {
		const ctx = makeTypeCtx({
			pipelines: [
				{ name: "Data Pipeline", sources: [{ columnMappings: [{ included: true }] }, { columnMappings: [] }] },
			],
		});
		const content = buildTypeDocContent("Event", [], ctx);
		expect(content.includes("## Configs")).toBe(true);
		expect(content.includes("Pipeline - Data Pipeline")).toBe(true);
		expect(content.includes("2 sources")).toBe(true);
	});

	it("shows singular 'source' for pipeline with 1 source", () => {
		const ctx = makeTypeCtx({
			pipelines: [
				{ name: "Solo", sources: [{ columnMappings: [] }] },
			],
		});
		const content = buildTypeDocContent("T", [], ctx);
		expect(content.includes("1 source)")).toBe(true);
	});

	it("includes import config links", () => {
		const ctx = makeTypeCtx({
			importConfigs: [{ name: "CSV Importer" }],
		});
		const content = buildTypeDocContent("Event", [], ctx);
		expect(content.includes("Import - CSV Importer")).toBe(true);
		expect(content.includes("\u2014 Import")).toBe(true);
	});

	it("includes export config links", () => {
		const ctx = makeTypeCtx({
			exportConfigs: [{ name: "Report Export" }],
		});
		const content = buildTypeDocContent("Event", [], ctx);
		expect(content.includes("Export - Report Export")).toBe(true);
		expect(content.includes("\u2014 Export")).toBe(true);
	});

	it("omits configs section when no configs at all", () => {
		const content = buildTypeDocContent("Event", [], makeTypeCtx());
		expect(content.includes("## Configs")).toBe(false);
	});

	it("includes lifecycle events section with CRUD events", () => {
		const content = buildTypeDocContent("Product", [], makeTypeCtx());
		expect(content.includes("## Lifecycle Events")).toBe(true);
		expect(content.includes("product.created")).toBe(true);
		expect(content.includes("product.read")).toBe(true);
		expect(content.includes("product.updated")).toBe(true);
		expect(content.includes("product.deleted")).toBe(true);
	});

	it("uses lowercase type name for lifecycle events", () => {
		const content = buildTypeDocContent("MyEvent", [], makeTypeCtx());
		expect(content.includes("myevent.created")).toBe(true);
		expect(content.includes("myevent.deleted")).toBe(true);
	});

	it("includes lifecycle event labels", () => {
		const content = buildTypeDocContent("Event", [], makeTypeCtx());
		expect(content.includes("\u2014 Created")).toBe(true);
		expect(content.includes("\u2014 Read")).toBe(true);
		expect(content.includes("\u2014 Updated")).toBe(true);
		expect(content.includes("\u2014 Deleted")).toBe(true);
	});

	it("includes user notes when provided", () => {
		const content = buildTypeDocContent("Event", [], makeTypeCtx(), "Custom type notes.");
		expect(content.includes("## Notes")).toBe(true);
		expect(content.includes("Custom type notes.")).toBe(true);
	});

	it("includes default notes placeholder when no user notes", () => {
		const content = buildTypeDocContent("Event", [], makeTypeCtx());
		expect(content.includes("> Describe this type, its purpose, and usage guidelines.")).toBe(true);
	});

	it("uses correct docsRoot for property links", () => {
		const ctx = makeTypeCtx({ docsRoot: "Custom/Root" });
		const content = buildTypeDocContent("T", ["myProp"], ctx);
		// Property link should use the docsRoot's Properties folder
		expect(content.includes("Property - myProp")).toBe(true);
	});
});

// ── buildPropertyDocContent ──────────────────────────────

describe("buildPropertyDocContent", () => {
	const docsRoot = "Docs/Reference";

	it("includes PropertyDoc type in frontmatter", () => {
		const content = buildPropertyDocContent("title", docsRoot, undefined, [], []);
		expect(content.includes("type: PropertyDoc")).toBe(true);
	});

	it("includes property name as H1 heading", () => {
		const content = buildPropertyDocContent("description", docsRoot, undefined, [], []);
		expect(content.includes("# description")).toBe(true);
	});

	it("includes property name in frontmatter", () => {
		const content = buildPropertyDocContent("status", docsRoot, undefined, [], []);
		expect(content.includes('property: "status"')).toBe(true);
	});

	it("includes property name in overview section", () => {
		const content = buildPropertyDocContent("category", docsRoot, undefined, [], []);
		expect(content.includes("`category`")).toBe(true);
	});

	it("shows csv columns when entry has csvColumnNames", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: ["Title", "TITLE"],
			usedInConfigs: [],
			sampleValues: [],
		};
		const content = buildPropertyDocContent("title", docsRoot, entry, [], []);
		expect(content.includes("**CSV Columns**: Title, TITLE")).toBe(true);
	});

	it("omits csv columns line when entry has no csvColumnNames", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [],
			sampleValues: [],
		};
		const content = buildPropertyDocContent("title", docsRoot, entry, [], []);
		expect(content.includes("CSV Columns")).toBe(false);
	});

	it("omits csv columns line when entry is undefined", () => {
		const content = buildPropertyDocContent("title", docsRoot, undefined, [], []);
		expect(content.includes("CSV Columns")).toBe(false);
	});

	it("includes configs frontmatter when entry has usedInConfigs", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "imp-1", configName: "My Import", configType: "import" },
			],
			sampleValues: [],
		};
		const content = buildPropertyDocContent("title", docsRoot, entry, [], []);
		expect(content.includes('configs: ["My Import"]')).toBe(true);
	});

	it("includes config doc links section for import configs", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "imp-1", configName: "Products Import", configType: "import" },
			],
			sampleValues: [],
		};
		const content = buildPropertyDocContent("title", docsRoot, entry, [], []);
		expect(content.includes("## Configs")).toBe(true);
		expect(content.includes("Import - Products Import")).toBe(true);
	});

	it("includes config doc links section for export configs", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "exp-1", configName: "Report Export", configType: "export" },
			],
			sampleValues: [],
		};
		const content = buildPropertyDocContent("title", docsRoot, entry, [], []);
		expect(content.includes("## Configs")).toBe(true);
		expect(content.includes("Export - Report Export")).toBe(true);
	});

	it("includes related files from import config source paths", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "imp-1", configName: "Imp", configType: "import" },
			],
			sampleValues: [],
		};
		const importConfigs = [{ id: "imp-1", name: "Imp", sourcePath: "Data/input.csv" }];
		const content = buildPropertyDocContent("title", docsRoot, entry, importConfigs, []);
		expect(content.includes("## Related Files")).toBe(true);
		expect(content.includes("[[input.csv]]")).toBe(true);
	});

	it("includes related files from export config source and output paths", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "exp-1", configName: "Exp", configType: "export" },
			],
			sampleValues: [],
		};
		const exportConfigs = [
			{ id: "exp-1", name: "Exp", sourcePath: "Data/source.base", outputPath: "Exports/out.csv" },
		];
		const content = buildPropertyDocContent("title", docsRoot, entry, [], exportConfigs);
		expect(content.includes("## Related Files")).toBe(true);
		expect(content.includes("[[source.base]]")).toBe(true);
		expect(content.includes("[[out.csv]]")).toBe(true);
	});

	it("excludes output path for external export configs", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "exp-1", configName: "Exp", configType: "export" },
			],
			sampleValues: [],
		};
		const exportConfigs = [
			{ id: "exp-1", name: "Exp", sourcePath: "Data/source.base", outputPath: "/external/out.csv", isExternal: true },
		];
		const content = buildPropertyDocContent("title", docsRoot, entry, [], exportConfigs);
		// Source path should still be included
		expect(content.includes("[[source.base]]")).toBe(true);
		// External output path should not be linked
		expect(content.includes("[[out.csv]]")).toBe(false);
	});

	it("includes reports section for csv files in related files", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "imp-1", configName: "Imp", configType: "import" },
			],
			sampleValues: [],
		};
		const importConfigs = [{ id: "imp-1", name: "Imp", sourcePath: "Data/report.csv" }];
		const content = buildPropertyDocContent("title", docsRoot, entry, importConfigs, []);
		expect(content.includes("## Reports")).toBe(true);
		expect(content.includes("CSV - report")).toBe(true);
	});

	it("omits reports section when no csv files in related files", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "exp-1", configName: "Exp", configType: "export" },
			],
			sampleValues: [],
		};
		const exportConfigs = [
			{ id: "exp-1", name: "Exp", sourcePath: "Data/source.base", outputPath: "Exports/out.txt" },
		];
		const content = buildPropertyDocContent("title", docsRoot, entry, [], exportConfigs);
		expect(content.includes("## Reports")).toBe(false);
	});

	it("omits configs section when entry has no usedInConfigs", () => {
		const content = buildPropertyDocContent("title", docsRoot, undefined, [], []);
		expect(content.includes("## Configs")).toBe(false);
	});

	it("omits related files section when no related files found", () => {
		const content = buildPropertyDocContent("title", docsRoot, undefined, [], []);
		expect(content.includes("## Related Files")).toBe(false);
	});

	it("always includes Notes section", () => {
		const content = buildPropertyDocContent("title", docsRoot, undefined, [], []);
		expect(content.includes("## Notes")).toBe(true);
		expect(content.includes("> Document usage context, data lineage, or related properties.")).toBe(true);
	});

	it("includes Description section", () => {
		const content = buildPropertyDocContent("title", docsRoot, undefined, [], []);
		expect(content.includes("## Description")).toBe(true);
	});

	it("handles multiple config refs with both import and export", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "status",
			csvColumnNames: ["Status", "STATE"],
			usedInConfigs: [
				{ configId: "imp-1", configName: "Import A", configType: "import" },
				{ configId: "exp-1", configName: "Export B", configType: "export" },
			],
			sampleValues: [],
		};
		const importConfigs = [{ id: "imp-1", name: "Import A", sourcePath: "a.csv" }];
		const exportConfigs = [{ id: "exp-1", name: "Export B", sourcePath: "s.base", outputPath: "b.csv" }];
		const content = buildPropertyDocContent("status", docsRoot, entry, importConfigs, exportConfigs);
		expect(content.includes("Import - Import A")).toBe(true);
		expect(content.includes("Export - Export B")).toBe(true);
		expect(content.includes("**CSV Columns**: Status, STATE")).toBe(true);
	});

	it("includes basePath from import configs", () => {
		const entry: DataDictionaryEntry = {
			propertyName: "title",
			csvColumnNames: [],
			usedInConfigs: [
				{ configId: "imp-1", configName: "Imp", configType: "import" },
			],
			sampleValues: [],
		};
		const importConfigs = [{ id: "imp-1", name: "Imp", basePath: "Views/view.base" }];
		const content = buildPropertyDocContent("title", docsRoot, entry, importConfigs, []);
		expect(content.includes("[[view.base]]")).toBe(true);
	});
});
