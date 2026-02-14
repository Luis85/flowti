/**
 * BaseQueryEngine — parses `.base` YAML files and evaluates their
 * filter expressions against a set of vault files.
 *
 * Since Obsidian's Bases API (`BasesView` / `QueryController`) is designed
 * for rendering and does not expose programmatic query execution, this engine
 * implements a custom filter evaluator covering all filter expression patterns
 * observed in the vault.
 *
 * Supported filter expressions:
 * - `file.inFolder("path")` — file's parent folder starts with path
 * - `file.folder.contains("text")` — folder path includes substring
 * - `file.folder.containsAny("text")` — same as contains
 * - `file.ext == "value"` — file extension equals value
 * - `file.name.contains("text")` — basename includes substring
 * - `property == "value"` — frontmatter property equals value
 * - `!expr` — negation prefix
 * - `and: [...]` / `or: [...]` — logical operators
 *
 * Unknown expressions silently pass (forgiving).
 */

import { parseYaml } from "obsidian";
import type {
	BaseFilter,
	BaseFilterGroup,
	BaseFilterType,
	BasePropertyConfig,
	BaseViewConfig,
	ParsedBaseFile,
	VaultFileInfo,
} from "./types";

// Pre-compiled filter expression patterns
const RE_IN_FOLDER = /^file\.inFolder\(["'](.+?)["']\)$/;
const RE_FOLDER_CONTAINS = /^file\.folder\.contains(?:Any)?\(["'](.+?)["']\)$/;
const RE_EXT_EQUALS = /^file\.ext\s*==\s*["'](.+?)["']$/;
const RE_NAME_CONTAINS = /^file\.name\.contains\(["'](.+?)["']\)$/;
const RE_PROPERTY_EQUALS = /^([\w.]+)\s*==\s*["'](.+?)["']$/;

export class BaseQueryEngine {
	/**
	 * Parses a `.base` file's YAML content into a structured representation.
	 */
	parseBaseFile(yamlContent: string): ParsedBaseFile {
		const raw = parseYaml(yamlContent) as Record<string, unknown> | null;

		if (!raw) {
			return { views: [] };
		}

		const globalFilters = this.parseFilterGroupFromYaml(
			raw.filters as Record<string, unknown> | undefined,
		);

		const rawViews = Array.isArray(raw.views) ? raw.views : [];
		const views: BaseViewConfig[] = rawViews.map(
			(v: Record<string, unknown>) => {
				const viewConfig: BaseViewConfig = {
					name: String(v.name ?? "Untitled"),
					type: String(v.type ?? "table"),
					order: Array.isArray(v.order)
						? v.order.map(String)
						: undefined,
				};

				if (v.filters) {
					viewConfig.filters = this.parseFilterGroupFromYaml(
						v.filters as Record<string, unknown>,
					);
				}

				return viewConfig;
			},
		);

		// Parse per-property config (e.g. displayName)
		const properties = this.parseProperties(
			raw.properties as Record<string, unknown> | undefined,
		);

		// Parse formulas: { name: expression }
		const formulas = this.parseFormulas(
			raw.formulas as Record<string, unknown> | undefined,
		);

		return { filters: globalFilters, views, properties, formulas };
	}

	/**
	 * Resolves files for a specific view in a `.base` file.
	 * Applies global filters first, then view-specific filters.
	 */
	resolveView(
		files: VaultFileInfo[],
		base: ParsedBaseFile,
		viewIndex: number,
	): VaultFileInfo[] {
		let result = files;

		// Apply global filters
		if (base.filters) {
			result = this.evaluateFilters(result, base.filters);
		}

		// Apply view-specific filters
		const view = base.views[viewIndex];
		if (view?.filters) {
			result = this.evaluateFilters(result, view.filters);
		}

		return result;
	}

	/**
	 * Evaluates a filter group against a set of vault files.
	 */
	evaluateFilters(
		files: VaultFileInfo[],
		group: BaseFilterGroup,
	): VaultFileInfo[] {
		return files.filter((file) => this.matchesGroup(file, group));
	}

	/**
	 * Returns the column order for a specific view, if defined.
	 */
	getViewColumns(base: ParsedBaseFile, viewIndex: number): string[] | undefined {
		return base.views[viewIndex]?.order;
	}

	// ── Private helpers ──────────────────────────────────────

	private matchesGroup(file: VaultFileInfo, group: BaseFilterGroup): boolean {
		if (group.operator === "and") {
			return group.conditions.every((c) => this.matchesCondition(file, c));
		}
		return group.conditions.some((c) => this.matchesCondition(file, c));
	}

	private matchesCondition(
		file: VaultFileInfo,
		condition: BaseFilter | BaseFilterGroup,
	): boolean {
		if ("operator" in condition) {
			return this.matchesGroup(file, condition);
		}
		return this.evaluateFilter(file, condition);
	}

	private evaluateFilter(file: VaultFileInfo, filter: BaseFilter): boolean {
		let result: boolean;

		switch (filter.type) {
			case "inFolder":
				result =
					file.folder === filter.value ||
					file.folder.startsWith(filter.value + "/");
				break;

			case "folderContains":
				result = file.folder
					.toLowerCase()
					.includes(filter.value.toLowerCase());
				break;

			case "extEquals":
				result = file.extension === filter.value;
				break;

			case "nameContains":
				result = file.basename
					.toLowerCase()
					.includes(filter.value.toLowerCase());
				break;

			case "propertyEquals": {
				const fmValue = file.frontmatter?.[filter.field];
				result = fmValue !== undefined && String(fmValue) === filter.value;
				break;
			}

			default:
				// Unknown filter type — pass through (forgiving)
				result = true;
		}

		return filter.negated ? !result : result;
	}

	/**
	 * Parses a YAML filter object (with `and`/`or` keys) into a BaseFilterGroup.
	 */
	private parseFilterGroupFromYaml(
		raw: Record<string, unknown> | undefined,
	): BaseFilterGroup | undefined {
		if (!raw) return undefined;

		if (Array.isArray(raw.and)) {
			return {
				operator: "and",
				conditions: raw.and.map((expr: unknown) =>
					this.parseCondition(expr),
				),
			};
		}

		if (Array.isArray(raw.or)) {
			return {
				operator: "or",
				conditions: raw.or.map((expr: unknown) =>
					this.parseCondition(expr),
				),
			};
		}

		return undefined;
	}

	private parseCondition(expr: unknown): BaseFilter | BaseFilterGroup {
		if (typeof expr === "object" && expr !== null && !Array.isArray(expr)) {
			const group = this.parseFilterGroupFromYaml(
				expr as Record<string, unknown>,
			);
			if (group) return group;
		}

		return this.parseFilterExpression(String(expr));
	}

	/**
	 * Parses a single filter expression string into a BaseFilter.
	 *
	 * @example
	 * parseFilterExpression('file.inFolder("03 - Resources/Events")')
	 * // → { type: "inFolder", field: "file", value: "03 - Resources/Events", negated: false }
	 *
	 * parseFilterExpression('!file.ext == "md"')
	 * // → { type: "extEquals", field: "file.ext", value: "md", negated: true }
	 */
	parseFilterExpression(expr: string): BaseFilter {
		let negated = false;
		let cleanExpr = expr.trim();

		// Strip surrounding quotes if the entire expression is quoted
		if (
			(cleanExpr.startsWith("'") && cleanExpr.endsWith("'")) ||
			(cleanExpr.startsWith('"') && cleanExpr.endsWith('"'))
		) {
			cleanExpr = cleanExpr.slice(1, -1);
		}

		// Handle negation prefix
		if (cleanExpr.startsWith("!")) {
			negated = true;
			cleanExpr = cleanExpr.slice(1).trim();
		}

		// file.inFolder("path")
		const inFolderMatch = cleanExpr.match(RE_IN_FOLDER);
		if (inFolderMatch) {
			return this.filter("inFolder", "file", inFolderMatch[1], negated);
		}

		// file.folder.contains("text") or file.folder.containsAny("text")
		const folderContainsMatch = cleanExpr.match(RE_FOLDER_CONTAINS);
		if (folderContainsMatch) {
			return this.filter(
				"folderContains",
				"file.folder",
				folderContainsMatch[1],
				negated,
			);
		}

		// file.ext == "value"
		const extMatch = cleanExpr.match(RE_EXT_EQUALS);
		if (extMatch) {
			return this.filter("extEquals", "file.ext", extMatch[1], negated);
		}

		// file.name.contains("text")
		const nameContainsMatch = cleanExpr.match(RE_NAME_CONTAINS);
		if (nameContainsMatch) {
			return this.filter(
				"nameContains",
				"file.name",
				nameContainsMatch[1],
				negated,
			);
		}

		// property == "value" (frontmatter)
		const propMatch = cleanExpr.match(RE_PROPERTY_EQUALS);
		if (propMatch) {
			return this.filter(
				"propertyEquals",
				propMatch[1],
				propMatch[2],
				negated,
			);
		}

		// Fallback: unknown expression — pass through
		return this.filter("propertyEquals", "__unknown__", "", negated);
	}

	private filter(
		type: BaseFilterType,
		field: string,
		value: string,
		negated: boolean,
	): BaseFilter {
		return { type, field, value, negated };
	}

	/**
	 * Parses the `formulas` section of a `.base` YAML.
	 * Returns a map of formula name → expression string.
	 */
	private parseFormulas(
		raw: Record<string, unknown> | undefined,
	): Record<string, string> | undefined {
		if (!raw || typeof raw !== "object") return undefined;

		const result: Record<string, string> = {};
		for (const [key, val] of Object.entries(raw)) {
			if (val !== undefined && val !== null) {
				result[key] = String(val);
			}
		}
		return Object.keys(result).length > 0 ? result : undefined;
	}

	/**
	 * Parses the `properties` section of a `.base` YAML into a config map.
	 *
	 * @example
	 * properties:
	 *   file.folder:
	 *     displayName: Folder
	 */
	private parseProperties(
		raw: Record<string, unknown> | undefined,
	): Record<string, BasePropertyConfig> | undefined {
		if (!raw || typeof raw !== "object") return undefined;

		const result: Record<string, BasePropertyConfig> = {};
		for (const [key, val] of Object.entries(raw)) {
			if (val && typeof val === "object" && !Array.isArray(val)) {
				const obj = val as Record<string, unknown>;
				const config: BasePropertyConfig = {};
				if (typeof obj.displayName === "string") {
					config.displayName = obj.displayName;
				}
				result[key] = config;
			}
		}
		return Object.keys(result).length > 0 ? result : undefined;
	}
}
