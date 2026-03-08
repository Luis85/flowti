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
import { RESET, DIM, GREEN, RED, CYAN } from "../../../infrastructure/ui.js";
import { log } from "../../../infrastructure/logger.js";
import { proc } from "../../../infrastructure/proc.js";
import { toKebab, toPascal, toCamel } from "../naming.js";
import { createFileWriter } from "../templates/file-writer.js";
import { buildComponentPlan } from "./component-plan.js";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "./component-registry.js";
import type { ComponentVariables } from "./component-types.js";
import type { ProjectContext } from "../../../infrastructure/types.js";

type CommandHandler = (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void;

function makeComponentCommand(definitionId: string): CommandHandler {
	return (flags, _r, _c, project) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: flowti make:${definitionId} --name=MyComponent [--description="..."]${RESET}\n`);
			proc.exit(1);
		}

		if (!project) {
			log(`\n  ${RED}No project selected.${RESET}\n`);
			proc.exit(1);
		}

		const definitions = loadComponentDefinitions();
		const def = definitions.find((d) => d.id === definitionId);
		if (!def) {
			log(`\n  ${RED}Unknown component type: ${definitionId}${RESET}\n`);
			proc.exit(1);
		}

		const kebab = toKebab(name);
		const pascal = toPascal(name);
		const camel = toCamel(name);

		const docPath = paths.join(project.path, "docs", "components", `${kebab}.md`);
		if (disk.existsSync(docPath)) {
			log(`\n  ${RED}Component already exists:${RESET} ${kebab}\n`);
			proc.exit(1);
		}

		// Build variables from flags
		const vars: ComponentVariables = {
			name,
			kebab,
			pascal,
			camel,
			description: String(flags.description ?? ""),
			technology: String(flags.technology ?? ""),
			containedBy: String(flags.containedBy ?? ""),
			owner: String(flags.owner ?? ""),
		};

		log(`\n  ${CYAN}▸${RESET} Adding ${def.label}: ${name}\n`);

		const templates = createComponentTemplateRegistry();
		const plan = buildComponentPlan(vars, def, templates);

		const writer = createFileWriter(project.path);
		for (const f of plan) writer.write(f.path, f.content);

		log(`\n  ${GREEN}✓${RESET} Created ${writer.created} files.\n`);
	};
}

export const commands: Record<string, CommandHandler> = {
	"make:component": makeComponentCommand("component"),
	"make:system": makeComponentCommand("c4-system"),
	"make:container": makeComponentCommand("c4-container"),
	"make:c4-component": makeComponentCommand("c4-component"),
	"make:person": makeComponentCommand("c4-person"),
};
