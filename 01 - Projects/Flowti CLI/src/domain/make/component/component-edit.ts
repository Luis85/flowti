/**
 * component-edit.ts — Non-interactive CLI command for editing component properties.
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
import { proc } from "../../../infrastructure/proc.js";
import { toKebab } from "../naming.js";
import type { CommandHandler } from "../../../infrastructure/types.js";
import { renderError, renderSuccess } from "../../../ui/common-renderers.js";

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

// ── Command handler ─────────────────────────────────────────────────

function editComponentCommand(): CommandHandler {
	return (flags, _r, _c, project) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			renderError({
				error: "--name is required.",
				hint: "Usage: flowti edit:component --name=MyComponent --prop.status=active",
			});
			return proc.exit(1);
		}

		if (!project) {
			renderError({ error: "No project selected." });
			return proc.exit(1);
		}

		const kebab = toKebab(name);
		const docPath = paths.join(project.path, "docs", "components", `${kebab}.md`);

		if (!disk.existsSync(docPath)) {
			renderError({
				error: `Component not found: ${kebab}`,
				hint: `Expected file: ${docPath}`,
			});
			return proc.exit(1);
		}

		const propUpdates = extractPropFlags(flags);
		if (Object.keys(propUpdates).length === 0) {
			renderError({
				error: "No properties specified.",
				hint: "Use --prop.key=value to update properties.",
			});
			return proc.exit(1);
		}

		const content = disk.readFileSync(docPath, "utf-8");
		const parsed = splitFrontmatter(content);

		if (!parsed) {
			renderError({ error: `No frontmatter found in ${kebab}.md` });
			return proc.exit(1);
		}

		const fm = parsed.frontmatter;
		for (const [key, value] of Object.entries(propUpdates)) {
			fm[key] = value;
		}

		const updated = joinFrontmatter(fm, parsed.body);
		disk.writeFileSync(docPath, updated, "utf-8");

		const propList = Object.entries(propUpdates).map(([k, v]) => `${k}=${v}`).join(", ");
		renderSuccess({ message: `Updated ${kebab}: ${propList}` });
	};
}

export const commands: Record<string, CommandHandler> = {
	"edit:component": editComponentCommand(),
};
