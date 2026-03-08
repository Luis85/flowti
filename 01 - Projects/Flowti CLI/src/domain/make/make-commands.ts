/**
 * make-commands.ts — Non-interactive CLI commands for in-project scaffolding.
 *
 * These commands are invoked from the command line (e.g., `flowti make:hub --name=Inventory`).
 * Project creation is handled by the Scaffold domain — Make only provides
 * in-project boilerplate (hub, journey).
 */

import { paths as nodePaths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { RESET, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import { toKebab, toPascal, getMakePaths } from "./naming.js";
import { createFileWriter } from "./templates/file-writer.js";
import {
	hubViewTemplate, hubTypesTemplate, hubEventsTemplate, hubServiceTemplate,
	hubProviderTemplate, hubTestTemplate, hubCssTemplate, hubPrdTemplate,
	hubJourneyTemplate,
} from "./templates/hub.js";
import { commands as componentCommands } from "./component/component-commands.js";
import type { ProjectContext } from "../../infrastructure/types.js";

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	...componentCommands,
	"make:hub": (flags, _r, _c, project) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:hub --name=Inventory [--icon=package] [--type=domain] [--tabs=overview,items]${RESET}\n`);
			proc.exit(1);
		}
		const kebab = toKebab(name);
		const pascal = toPascal(name);
		const icon = (flags.icon as string) ?? "layout-grid";
		const hubType = (flags.type as string) ?? "domain";
		const tabs = ((flags.tabs as string) ?? "overview,items").split(",").map((t) => t.trim());
		const paths = getMakePaths(project?.config);

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${pascal} Hub\n`);

		if (!project) {
			log(`\n  ${RED}No project selected. Use --project to specify a project.${RESET}\n`);
			proc.exit(1);
		}
		const root = project.path;
		const { write: w, created } = createFileWriter(root);

		w(`${paths.ui}/${kebab}/${pascal}HubView.ts`, hubViewTemplate(pascal, kebab, hubType, icon, tabs));
		w(`${paths.ui}/${kebab}/types.ts`, hubTypesTemplate(pascal, tabs));
		w(`${paths.domain}/${kebab}/events.ts`, hubEventsTemplate(pascal));
		w(`${paths.domain}/${kebab}/${pascal}Service.ts`, hubServiceTemplate(pascal));
		w(`${paths.hubDomain}/${pascal}HubProvider.ts`, hubProviderTemplate(pascal, kebab, icon));
		w(`${paths.tests}/${kebab}/${pascal}HubView.test.ts`, hubTestTemplate(pascal, kebab));

		const cssFiles = disk.existsSync(nodePaths.join(root, paths.css))
			? disk.readdirSync(nodePaths.join(root, paths.css)).filter((f) => f.endsWith(".css")).sort() : [];
		const maxNum = cssFiles.reduce((max, f) => { const m = f.match(/^(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
		w(`${paths.css}/${String(maxNum + 1).padStart(2, "0")}-${kebab}.css`, hubCssTemplate(pascal, kebab));
		w(`${paths.docs}/${pascal}/${pascal} Hub.md`, hubPrdTemplate(pascal));
		w(`${paths.journeys}/${kebab}.journey.json`, hubJourneyTemplate(pascal, kebab));

		log(`\n  ${GREEN}✓${RESET} Created ${created} files.\n`);
	},
};
