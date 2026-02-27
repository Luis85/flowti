/**
 * dataDictionaryGenerator.ts
 *
 * Pure functions to generate a Data Dictionary reference document
 * from EntityTypeMeta arrays. Used by build-time scripts.
 */

import type { EntityTypeMeta } from "./entityTypeRegistry";

export interface DataDictionaryReport {
	type: "DataDictionary";
	date: string;
	total_types: number;
	groups: number;
	total_fields: number;
}

/**
 * Group entity types by their group field, preserving insertion order.
 */
export function groupByGroup(
	entities: EntityTypeMeta[],
): Map<string, EntityTypeMeta[]> {
	const groups = new Map<string, EntityTypeMeta[]>();
	for (const entity of entities) {
		const existing = groups.get(entity.group) ?? [];
		existing.push(entity);
		groups.set(entity.group, existing);
	}
	return groups;
}

/**
 * Build a group summary: group → type count.
 */
export function buildGroupSummary(entities: EntityTypeMeta[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const entity of entities) {
		counts.set(entity.group, (counts.get(entity.group) ?? 0) + 1);
	}
	return counts;
}

const GROUP_LABELS: Record<string, string> = {
	"catalog": "Event Catalog",
	"data-exchange": "Data Exchange",
	"special": "Special",
};

function groupLabel(group: string): string {
	return GROUP_LABELS[group] ?? capitalize(group);
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate the full Data Dictionary markdown document.
 */
export function generateDataDictionary(
	entities: EntityTypeMeta[],
	date: string,
): string {
	const groups = groupByGroup(entities);
	const totalFields = entities.reduce((sum, e) => sum + e.fields.length, 0);

	const fm: DataDictionaryReport = {
		type: "DataDictionary",
		date,
		total_types: entities.length,
		groups: groups.size,
		total_fields: totalFields,
	};

	const lines: string[] = [
		"---",
		`type: ${fm.type}`,
		`date: "${fm.date}"`,
		`total_types: ${fm.total_types}`,
		`groups: ${fm.groups}`,
		`total_fields: ${fm.total_fields}`,
		"---",
		"",
		"# Data Dictionary",
		"",
		"> [!info] Summary",
		`> Total types: ${fm.total_types} | Groups: ${fm.groups} | Total fields: ${fm.total_fields}`,
		"",
	];

	// Group summary table
	lines.push("## Group Summary", "");
	lines.push("| Group | Types |");
	lines.push("|-------|-------|");
	for (const [group, typesList] of groups) {
		lines.push(`| ${groupLabel(group)} | ${typesList.length} |`);
	}
	lines.push("");

	// Type overview table
	lines.push("## Type Overview", "");
	lines.push("| Type | Group | Tab | Folder | Fields | Description |");
	lines.push("|------|-------|-----|--------|--------|-------------|");
	for (const entity of entities) {
		lines.push(
			`| ${entity.typeName} | ${groupLabel(entity.group)} | ${entity.tab} | \`${entity.folder}\` | ${entity.fields.length} | ${entity.description} |`,
		);
	}
	lines.push("");

	// Detailed sections per group
	for (const [group, typesList] of groups) {
		lines.push(`## ${groupLabel(group)} Types`, "");

		for (const entity of typesList) {
			lines.push(`### ${entity.typeName}`, "");
			lines.push(`> ${entity.description}`, "");
			lines.push(`- **Tab**: ${entity.tab}`);
			lines.push(`- **Folder**: \`${entity.folder}\``);
			lines.push(`- **Name field**: \`${entity.nameField}\``);
			lines.push(`- **File pattern**: \`${entity.filePattern}\``);
			lines.push("");

			lines.push("| Field | Type | Required | Description |");
			lines.push("|-------|------|----------|-------------|");
			for (const field of entity.fields) {
				const req = field.required ? "Yes" : "No";
				lines.push(`| \`${field.name}\` | ${field.type} | ${req} | ${field.description} |`);
			}
			lines.push("");
		}
	}

	return lines.join("\n");
}
