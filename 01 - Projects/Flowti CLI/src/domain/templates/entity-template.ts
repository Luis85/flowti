/**
 * entity-template.ts — User-defined entity templates for the Flowti CLI.
 *
 * Loads markdown templates from $project/docs/templates/{entityType}.md
 * and merges user-defined frontmatter + body with CLI-generated content.
 * User properties always take precedence over CLI defaults.
 */

import { splitFrontmatter } from "../../infrastructure/frontmatter.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { TemplatesConfig } from "../../infrastructure/types.js";

export type EntityTemplateDeps = Pick<CliDeps, "disk" | "paths">;

export interface UserTemplate {
	frontmatter: Record<string, string>;
	body: string;
}

/** Resolve the templates directory for a project. */
function templatesDir(deps: EntityTemplateDeps, projectPath: string, config?: TemplatesConfig): string {
	return deps.paths.join(projectPath, config?.dir ?? "docs/templates");
}

/** Load a user template for the given entity type. Returns null if no template file exists. */
export function loadUserTemplate(
	deps: EntityTemplateDeps,
	projectPath: string,
	entityType: string,
	config?: TemplatesConfig,
): UserTemplate | null {
	const dir = templatesDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, `${entityType}.md`);

	if (!deps.disk.existsSync(filePath)) return null;

	const content = deps.disk.readFileSync(filePath, "utf-8");
	const parsed = splitFrontmatter(content);

	if (!parsed) {
		return { frontmatter: {}, body: content.trim() };
	}

	return {
		frontmatter: parsed.frontmatter,
		body: parsed.body.trim(),
	};
}

/**
 * Merge a user template with CLI-generated properties.
 * User frontmatter properties override CLI properties.
 * User body replaces CLI body if non-empty.
 */
export function mergeTemplate(
	cliProperties: Record<string, unknown>,
	cliBody: string,
	userTemplate: UserTemplate | null,
): { frontmatter: Record<string, unknown>; body: string } {
	if (!userTemplate) {
		return { frontmatter: { ...cliProperties }, body: cliBody };
	}

	return {
		frontmatter: { ...cliProperties, ...userTemplate.frontmatter },
		body: userTemplate.body || cliBody,
	};
}
