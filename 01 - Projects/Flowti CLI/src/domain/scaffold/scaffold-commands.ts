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
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import type { CommandHandler } from "../../infrastructure/types.js";
import { scaffold, scaffoldDryRun, listDefinitions, BUNDLED_DEFINITIONS, getKnownTemplateIds } from "./scaffold-service.js";
import { displayMarketplaceCommand, importDefinitionCommand } from "./marketplace.js";
import { exportBundle, saveBundle, loadBundle, importAiToolsFromBundle } from "./marketplace-export.js";
import { VAULT_ROOT } from "../../infrastructure/config.js";
import { showSuggestions, afterScaffold } from "../../infrastructure/suggestions.js";

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

		const opts = { definitionId, name, author, outputDir: output };

		if (flags["dry-run"]) {
			const result = scaffoldDryRun(opts);
			if ("error" in result) {
				log(`\n  ${RED}${result.error}${RESET}\n`);
				return;
			}
			const format = resolveFormat(flags);
			printOutput(format, result, () => {
				log(`\n  ${CYAN}Dry run — scaffold preview${RESET}\n`);
				log(`  ${DIM}Definition:${RESET}  ${result.definition}`);
				log(`  ${DIM}Output:${RESET}      ${result.outputPath}`);
				log(`  ${DIM}Files (${result.files.length}):${RESET}\n`);
				for (const file of result.files) {
					log(`    ${GREEN}+${RESET} ${file}`);
				}
				log();
			});
			return;
		}

		const result = scaffold(opts);

		if ("error" in result) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
		} else {
			log(`\n  ${GREEN}✓${RESET} Scaffolded ${result.created} files → ${result.outputPath}\n`);
			showSuggestions(afterScaffold(opts.name));
		}
	},

	"scaffold:list": (flags) => {
		const defs = listDefinitions();
		const format = resolveFormat(flags);
		printOutput(format, defs.map((d) => ({ id: d.id, label: d.label, description: d.description })), () => {
			if (defs.length === 0) {
				log(`\n  ${DIM}No scaffold definitions available.${RESET}\n`);
				return;
			}
			log(`\n  ${CYAN}Available scaffold definitions:${RESET}\n`);
			for (const def of defs) {
				log(`    ${GREEN}${def.id}${RESET}  ${def.label}`);
				log(`    ${DIM}${def.description}${RESET}\n`);
			}
		});
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

	"marketplace:export": (flags, _rawArgs, _command, project) => {
		const output = flags.output as string | undefined;
		const bundle = exportBundle(VAULT_ROOT, project?.path);
		const format = resolveFormat(flags);
		const total = bundle.aiTools.length + bundle.plugins.length + bundle.scaffolds.length;

		if (output) {
			saveBundle(bundle, output);
			log(`\n  ${GREEN}✓${RESET} Exported ${total} definitions → ${output}\n`);
		} else {
			printOutput(format, bundle, () => {
				log(`\n  ${CYAN}Marketplace Export Preview${RESET}\n`);
				log(`  ${DIM}Vault:${RESET} ${bundle.vault}`);
				log(`  ${DIM}AI Tools:${RESET} ${bundle.aiTools.length}`);
				log(`  ${DIM}Plugins:${RESET} ${bundle.plugins.length}`);
				log(`  ${DIM}Scaffolds:${RESET} ${bundle.scaffolds.length}`);
				for (const t of bundle.aiTools) log(`    ${GREEN}▸${RESET} ${t.name}  ${DIM}${t.description}${RESET}`);
				for (const p of bundle.plugins) log(`    ${GREEN}▸${RESET} ${p.name}  ${DIM}${p.description}${RESET}`);
				for (const s of bundle.scaffolds) log(`    ${GREEN}▸${RESET} ${s.name}  ${DIM}${s.description}${RESET}`);
				log(`\n  ${DIM}Use --output=<path> to save the bundle.${RESET}\n`);
			});
		}
	},

	"marketplace:import-bundle": (flags) => {
		const file = flags.file as string | undefined;
		if (!file) {
			log(`\n  ${RED}Missing --file flag.${RESET}`);
			log(`  ${DIM}Usage: marketplace:import-bundle --file=<bundle.json>${RESET}\n`);
			return;
		}
		const bundle = loadBundle(file);
		if (!bundle) {
			log(`\n  ${RED}Invalid or unreadable bundle: ${file}${RESET}\n`);
			return;
		}
		const imported = importAiToolsFromBundle(bundle, VAULT_ROOT);
		log(`\n  ${GREEN}✓${RESET} Imported ${imported} AI tool${imported !== 1 ? "s" : ""} from ${bundle.vault}\n`);
	},
};
