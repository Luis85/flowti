/**
 * scaffold-commands.ts — Non-interactive CLI commands for the scaffold domain.
 *
 * Commands:
 *   scaffold:new          --name=X [--definition=flowti-project] [--author=Y] [--output=path]
 *   scaffold:list
 *   scaffold:marketplace  [--project=path]
 *   scaffold:import       --file=<path> [--project=path]
 */

import { RESET, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { CommandHandler } from "../../infrastructure/types.js";
import { scaffold, listDefinitions, BUNDLED_DEFINITIONS, getKnownTemplateIds } from "./scaffold-service.js";
import { displayMarketplaceCommand, importDefinitionCommand } from "./marketplace.js";

export const commands: Record<string, CommandHandler> = {
	"scaffold:new": (flags) => {
		const name = flags.name as string | undefined;
		const definitionId = (flags.definition as string) ?? "flowti-project";
		const author = flags.author as string | undefined;
		const output = flags.output as string | undefined;

		if (!name) {
			log(`\n  ${RED}Missing required flag: --name${RESET}\n  Usage: scaffold:new --name="My Project" [--definition=flowti-project]\n`);
			return;
		}

		const result = scaffold({
			definitionId,
			name,
			author,
			outputDir: output,
		});

		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Scaffolded ${result.created} files → ${result.outputPath}\n`);
		}
	},

	"scaffold:list": () => {
		const defs = listDefinitions();
		if (defs.length === 0) {
			log(`\n  ${DIM}No scaffold definitions available.${RESET}\n`);
			return;
		}
		log(`\n  ${CYAN}Available scaffold definitions:${RESET}\n`);
		for (const def of defs) {
			log(`    ${GREEN}${def.id}${RESET}  ${def.label}`);
			log(`    ${DIM}${def.description}${RESET}\n`);
		}
	},

	"scaffold:marketplace": (_flags, _rawArgs, _command, project) => {
		const knownIds = getKnownTemplateIds();
		displayMarketplaceCommand(BUNDLED_DEFINITIONS, project?.path, knownIds);
	},

	"scaffold:import": (flags, _rawArgs, _command, project) => {
		const file = flags.file as string | undefined;

		if (!file) {
			log(`\n  ${RED}Missing required flag: --file${RESET}\n  Usage: scaffold:import --file=<path>\n`);
			return;
		}

		if (!project) {
			log(`\n  ${RED}No project selected.${RESET}`);
			log(`  ${DIM}Select a project first or use --project=<name>${RESET}\n`);
			return;
		}

		const knownIds = getKnownTemplateIds();
		importDefinitionCommand(file, project.path, knownIds);
	},
};
