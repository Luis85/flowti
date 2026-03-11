/**
 * make-service.ts — Make domain orchestrator.
 *
 * Manages template registry and available templates.
 * Interactive menu moved to src/ui/menus/make-menu.ts.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import { readProjectConfig } from "../project/project-config.js";
import type { MakeTemplateId } from "../../infrastructure/types.js";

export type MakeServiceDeps = Pick<CliDeps, "disk" | "paths">;

const ALL_TEMPLATES: MakeTemplateId[] = ["journey", "component"];

export function getAvailableTemplates(projectRoot: string, deps: MakeServiceDeps): MakeTemplateId[] {
	const { config: cfg } = readProjectConfig(projectRoot, deps);
	return cfg?.make?.templates ?? ALL_TEMPLATES;
}
