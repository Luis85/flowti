/**
 * make-service.ts — Make domain orchestrator.
 *
 * Manages template registry and available templates.
 * Interactive menu moved to src/ui/menus/make-menu.ts.
 */

import { readProjectConfig } from "../project/project-config.js";
import type { MakeTemplateId } from "../../infrastructure/types.js";

const ALL_TEMPLATES: MakeTemplateId[] = ["journey", "component"];

export function getAvailableTemplates(projectRoot: string): MakeTemplateId[] {
	const { config: cfg } = readProjectConfig(projectRoot);
	return cfg?.make?.templates ?? ALL_TEMPLATES;
}
