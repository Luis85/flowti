/**
 * component-edit.ts — Pure domain logic for editing component properties.
 *
 * Returns typed results; rendering is handled by the controller.
 *
 * Usage:
 *   flowti edit:component --name=MyComponent --prop.status=active --prop.technology=React
 *
 * Reads the existing markdown file from docs/components/, updates frontmatter
 * properties, and saves. Only modifies specified properties; preserves everything else.
 */

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { splitFrontmatter, joinFrontmatter } from "../../../infrastructure/frontmatter.js";
import { toKebab } from "../naming.js";

// ── Result types ─────────────────────────────────────────────────────

export interface EditComponentResult {
	success: true;
	kebab: string;
	propList: string;
}

export interface EditComponentError {
	success: false;
	error: string;
	hint?: string;
}

export type EditComponentOutcome = EditComponentResult | EditComponentError;

// ── Helpers ─────────────────────────────────────────────────────────

/** Extract --prop.* flags from a flags object. */
export function extractPropFlags(flags: Record<string, string | boolean>): Record<string, string> {
	const props: Record<string, string> = {};
	for (const [key, value] of Object.entries(flags)) {
		if (key.startsWith("prop.")) {
			props[key.slice(5)] = String(value);
		}
	}
	return props;
}

// ── Pure domain function ─────────────────────────────────────────────

export function editComponent(
	name: string | undefined,
	flags: Record<string, string | boolean>,
	projectPath: string,
): EditComponentOutcome {
	if (!name || typeof name !== "string") {
		return {
			success: false,
			error: "--name is required.",
			hint: "Usage: flowti edit:component --name=MyComponent --prop.status=active",
		};
	}

	const kebab = toKebab(name);
	const docPath = paths.join(projectPath, "docs", "components", `${kebab}.md`);

	if (!disk.existsSync(docPath)) {
		return {
			success: false,
			error: `Component not found: ${kebab}`,
			hint: `Expected file: ${docPath}`,
		};
	}

	const propUpdates = extractPropFlags(flags);
	if (Object.keys(propUpdates).length === 0) {
		return {
			success: false,
			error: "No properties specified.",
			hint: "Use --prop.key=value to update properties.",
		};
	}

	const content = disk.readFileSync(docPath, "utf-8");
	const parsed = splitFrontmatter(content);

	if (!parsed) {
		return { success: false, error: `No frontmatter found in ${kebab}.md` };
	}

	const fm = parsed.frontmatter;
	for (const [key, value] of Object.entries(propUpdates)) {
		fm[key] = value;
	}

	const updated = joinFrontmatter(fm, parsed.body);
	disk.writeFileSync(docPath, updated, "utf-8");

	const propList = Object.entries(propUpdates).map(([k, v]) => `${k}=${v}`).join(", ");
	return { success: true, kebab, propList };
}
