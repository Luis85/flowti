/**
 * component-commands.ts — Non-interactive CLI commands for component scaffolding.
 *
 * Invoked from the command line:
 *   flowti make:component --name=UserProfile
 *   flowti make:system --name=PaymentGateway --description="Handles payments"
 *   flowti make:container --name=ApiServer --technology="Node.js"
 *   flowti make:c4-component --name=AuthService
 *   flowti make:person --name=Customer --description="End user"
 */

import { paths } from "../../../infrastructure/paths.js";
import { disk } from "../../../infrastructure/filesystem.js";
import { proc } from "../../../infrastructure/proc.js";
import { toKebab, toPascal, toCamel } from "../naming.js";
import { createFileWriter } from "../templates/file-writer.js";
import { buildComponentPlan } from "./component-plan.js";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "./component-registry.js";
import type { ComponentVariables } from "./component-types.js";
import type { CommandHandler } from "../../../infrastructure/types.js";
import { showSuggestions, afterMakeComponent } from "../../../infrastructure/suggestions.js";
import { renderError, renderSuccess } from "../../../ui/common-renderers.js";
import { renderComponentAdding } from "../../../ui/make-renderers.js";

function buildComponentVars(name: string, flags: Record<string, string | boolean>): ComponentVariables {
	return {
		name,
		kebab: toKebab(name),
		pascal: toPascal(name),
		camel: toCamel(name),
		description: String(flags.description ?? ""),
		technology: String(flags.technology ?? ""),
		containedBy: String(flags.containedBy ?? ""),
		owner: String(flags.owner ?? ""),
	};
}

function makeComponentCommand(definitionId: string): CommandHandler {
	return (flags, _r, _c, project) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			renderError({
				error: "--name is required.",
				hint: `Usage: flowti make:${definitionId} --name=MyComponent [--description="..."]`,
			});
			proc.exit(1);
		}

		if (!project) {
			renderError({ error: "No project selected." });
			proc.exit(1);
		}

		const definitions = loadComponentDefinitions();
		const def = definitions.find((d) => d.id === definitionId);
		if (!def) {
			renderError({ error: `Unknown component type: ${definitionId}` });
			proc.exit(1);
		}

		const vars = buildComponentVars(name, flags);

		const docPath = paths.join(project.path, "docs", "components", `${vars.kebab}.md`);
		if (disk.existsSync(docPath)) {
			renderError({ error: `Component already exists: ${vars.kebab}` });
			proc.exit(1);
		}

		renderComponentAdding(def.label, name);

		const templates = createComponentTemplateRegistry();
		const plan = buildComponentPlan(vars, def, templates);

		const writer = createFileWriter(project.path);
		for (const f of plan) writer.write(f.path, f.content);

		renderSuccess({ message: `Created ${writer.created} files.` });
		showSuggestions(afterMakeComponent(name));
	};
}

export const commands: Record<string, CommandHandler> = {
	"make:component": makeComponentCommand("component"),
	"make:system": makeComponentCommand("c4-system"),
	"make:container": makeComponentCommand("c4-container"),
	"make:c4-component": makeComponentCommand("c4-component"),
	"make:person": makeComponentCommand("c4-person"),
};
