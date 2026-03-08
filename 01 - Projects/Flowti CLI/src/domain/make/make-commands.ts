/**
 * make-commands.ts — Non-interactive CLI commands for scaffolding.
 *
 * These commands are invoked from the command line (e.g., `flowti make:hub --name=Inventory`).
 */

import { paths as nodePaths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { PROJECTS_DIR, cliConfig } from "../../infrastructure/config.js";
import { RESET, DIM, GREEN, RED, CYAN } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import { toKebab, toPascal, getMakePaths } from "./naming.js";
import { createFileWriter } from "./templates/file-writer.js";
import {
	manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
} from "./templates/config.js";
import {
	hubViewTemplate, hubTypesTemplate, hubEventsTemplate, hubServiceTemplate,
	hubProviderTemplate, hubTestTemplate, hubCssTemplate, hubPrdTemplate,
	hubJourneyTemplate,
} from "./templates/hub.js";
import { pluginMainTemplate } from "./templates/plugin.js";
import {
	appMainTemplate, appEventBusTemplate, appEventTypesTemplate, appEventsTemplate,
	appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate,
	appEventBusTestTemplate,
} from "./templates/app.js";
import { cliMainTemplate, cliMainTestTemplate } from "./templates/cli.js";
import type { ProjectContext } from "../../infrastructure/types.js";

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
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

	"make:app": (flags) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:app --name="My App" [--id=my-app] [--author=Name]${RESET}\n`);
			proc.exit(1);
		}
		const appId = (flags.id as string) ?? toKebab(name);
		const author = (flags.author as string) ?? cliConfig.defaultAuthor ?? "";
		const pascal = toPascal(name);
		const appRoot = nodePaths.resolve(PROJECTS_DIR, appId);

		if (disk.existsSync(appRoot)) {
			log(`\n  ${RED}Folder already exists: ${appRoot}${RESET}\n`);
			proc.exit(1);
		}

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		const { write: w, created } = createFileWriter(appRoot);

		w("manifest.json", manifestTemplate({ id: appId, name, author }));
		w("package.json", packageTemplate("app", name, appId));
		w("tsconfig.json", tsconfigTemplate("app"));
		w("esbuild.config.mjs", esbuildTemplate(appId));
		w("vitest.config.ts", vitestTemplate("app"));
		w(".gitignore", gitignoreTemplate("app"));
		w("css/00-base.css", appCssTemplate(name));
		w("src/main.ts", appMainTemplate(name, pascal));
		w("src/infrastructure/events/EventBus.ts", appEventBusTemplate());
		w("src/infrastructure/events/types.ts", appEventTypesTemplate());
		w("src/infrastructure/events/events.ts", appEventsTemplate());
		w("src/infrastructure/errors/types.ts", appErrorTypesTemplate());
		w("src/infrastructure/services/.gitkeep", "");
		w("src/domain/.gitkeep", "");
		w("src/ui/.gitkeep", "");
		w("tests/mocks/obsidian-stub.ts", appObsidianStubTemplate());
		w("tests/infrastructure/EventBus.test.ts", appEventBusTestTemplate());

		log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${appRoot}\n`);
	},

	"make:cli": (flags) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:cli --name="My CLI" [--id=my-cli]${RESET}\n`);
			proc.exit(1);
		}
		const appId = (flags.id as string) ?? toKebab(name);
		const cliRoot = nodePaths.resolve(PROJECTS_DIR, appId);

		if (disk.existsSync(cliRoot)) {
			log(`\n  ${RED}Folder already exists: ${cliRoot}${RESET}\n`);
			proc.exit(1);
		}

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		const { write: w, created } = createFileWriter(cliRoot);

		w("package.json", packageTemplate("cli", name, appId));
		w("tsconfig.json", tsconfigTemplate("cli"));
		w("vitest.config.ts", vitestTemplate("cli"));
		w(".gitignore", gitignoreTemplate("cli"));
		w("src/main.ts", cliMainTemplate(name));
		w("tests/main.test.ts", cliMainTestTemplate(name));

		log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${cliRoot}\n`);
	},

	"make:plugin": (flags) => {
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}--name is required.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- make:plugin --name="My Plugin" [--id=my-plugin] [--author=Name]${RESET}\n`);
			proc.exit(1);
		}
		const pluginId = (flags.id as string) ?? toKebab(name);
		const author = (flags.author as string) ?? cliConfig.defaultAuthor ?? "";
		const pluginRoot = nodePaths.resolve(PROJECTS_DIR, pluginId);

		if (disk.existsSync(pluginRoot)) {
			log(`\n  ${RED}Folder already exists: ${pluginRoot}${RESET}\n`);
			proc.exit(1);
		}

		log(`\n  ${CYAN}▸${RESET} Scaffolding: ${name}\n`);

		const { write: w, created } = createFileWriter(pluginRoot);

		w("manifest.json", manifestTemplate({ id: pluginId, name, author }));
		w("package.json", packageTemplate("plugin", name, pluginId));
		w("tsconfig.json", tsconfigTemplate("plugin"));
		w("esbuild.config.mjs", esbuildTemplate(pluginId));
		w(".gitignore", gitignoreTemplate("plugin"));
		w("src/main.ts", pluginMainTemplate(name));
		w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
		w("src/infrastructure/events/.gitkeep", "");
		w("src/domain/.gitkeep", "");
		w("src/ui/.gitkeep", "");
		w("tests/.gitkeep", "");

		log(`\n  ${GREEN}✓${RESET} Created ${created} files at ${pluginRoot}\n`);
	},
};
