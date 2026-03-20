/**
 * Event Catalog entity markdown generation and parsing.
 * Pure functions — no I/O. Generates markdown strings for each entity type.
 */

import type { CatalogEntity, CatalogEntityDef } from "./types.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";

/** Convert a name to kebab-case for filenames. */
export function toKebabCase(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Split a comma-separated string into bullet list items. */
function toBulletList(csv: string | undefined): string {
	if (!csv) return "";
	return csv.split(",").map((s) => `- ${s.trim()}`).join("\n");
}

export function generateDomainMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Domain",
		name: def.name,
		status: def.status ?? "active",
		date,
	};
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Services",
		"",
		"",
		"## Events",
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

export function generateServiceMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Service",
		name: def.name,
		domain: def.domain,
		status: def.status ?? "active",
		date,
	};
	const produces = toBulletList(def.producers);
	const consumes = toBulletList(def.consumers);
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Produces",
		"",
		produces,
		"",
		"## Consumes",
		"",
		consumes,
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

export function generateEventMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Event",
		name: def.name,
		domain: def.domain,
		version: def.version ?? "1.0.0",
		status: def.status ?? "draft",
		date,
		producers: def.producers,
		consumers: def.consumers,
	};
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Producers",
		"",
		toBulletList(def.producers),
		"",
		"## Consumers",
		"",
		toBulletList(def.consumers),
		"",
		"## Payload",
		"",
		"| Field | Type | Required | Description |",
		"| --- | --- | --- | --- |",
		"",
		"## Version History",
		"",
		`- **v${def.version ?? "1.0.0"}** — ${date}`,
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

export function generateFlowMarkdown(def: CatalogEntityDef, date: string): string {
	const fields: Record<string, string | undefined> = {
		type: "Flow",
		name: def.name,
		domain: def.domain,
		status: def.status ?? "active",
		date,
	};
	const body = [
		`# ${def.name}`,
		"",
		def.description ?? "",
		"",
		"## Steps",
		"",
	].join("\n");
	return serializeFrontmatter(fields, body);
}

/** Parse a CatalogEntity from markdown content. Returns null if frontmatter is invalid. */
export function parseEntityFromMarkdown(md: string, path: string): CatalogEntity | null {
	const { fields } = parseFrontmatter(md);
	if (!fields.name || !fields.type) return null;
	return {
		name: fields.name,
		type: fields.type,
		domain: fields.domain || undefined,
		status: fields.status || "draft",
		date: fields.date || "",
		path,
	};
}
