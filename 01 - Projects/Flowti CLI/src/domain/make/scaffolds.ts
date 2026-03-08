/**
 * scaffolds.ts — Project scaffolding functions used by "Create Project".
 *
 * Each scaffold function writes a full project skeleton to a given directory.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { cliConfig } from "../../infrastructure/config.js";
import { GREEN, RESET } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import { toKebab, toPascal } from "./naming.js";
import { createFileWriter } from "./templates/file-writer.js";
import {
	manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
} from "./templates/config.js";
import { pluginMainTemplate } from "./templates/plugin.js";
import {
	appMainTemplate, appEventBusTemplate, appEventTypesTemplate, appEventsTemplate,
	appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate,
	appEventBusTestTemplate,
} from "./templates/app.js";
import { cliMainTemplate, cliMainTestTemplate } from "./templates/cli.js";
import type { ProjectTemplateId, ProjectTemplate } from "./make-types.js";

// ── Scaffold functions ───────────────────────────────────────────────

export function scaffoldPlugin(projectPath: string, name: string): void {
	const id = toKebab(name);
	const author = cliConfig.defaultAuthor ?? "";
	const { write: w, report } = createFileWriter(projectPath);

	w("manifest.json", manifestTemplate({ id, name, author }));
	w("package.json", packageTemplate("plugin", name, id));
	w("tsconfig.json", tsconfigTemplate("plugin"));
	w("esbuild.config.mjs", esbuildTemplate(id));
	w(".gitignore", gitignoreTemplate("plugin"));
	w("src/main.ts", pluginMainTemplate(name));
	w("css/00-base.css", `/* ── Base styles for ${name} ── */\n`);
	w("src/infrastructure/events/.gitkeep", "");
	w("src/domain/.gitkeep", "");
	w("src/ui/.gitkeep", "");
	w("tests/.gitkeep", "");

	report("Starter Plugin");
}

export function scaffoldApp(projectPath: string, name: string): void {
	const id = toKebab(name);
	const pascal = toPascal(name);
	const author = cliConfig.defaultAuthor ?? "";
	const { write: w, report } = createFileWriter(projectPath);

	w("manifest.json", manifestTemplate({ id, name, author }));
	w("package.json", packageTemplate("app", name, id));
	w("tsconfig.json", tsconfigTemplate("app"));
	w("esbuild.config.mjs", esbuildTemplate(id));
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

	report("DDD Application");
}

export function scaffoldCli(projectPath: string, name: string): void {
	const id = toKebab(name);
	const { write: w, report } = createFileWriter(projectPath);

	w("package.json", packageTemplate("cli", name, id));
	w("tsconfig.json", tsconfigTemplate("cli"));
	w("vitest.config.ts", vitestTemplate("cli"));
	w(".gitignore", gitignoreTemplate("cli"));
	w("src/main.ts", cliMainTemplate(name));
	w("tests/main.test.ts", cliMainTestTemplate(name));

	report("CLI App");
}

export function scaffoldEmpty(projectPath: string, _name: string): void {
	disk.mkdirSync(projectPath, { recursive: true });
	log(`  ${GREEN}✓${RESET} Created empty project.\n`);
}

// ── Registry ─────────────────────────────────────────────────────────

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplate> = {
	app:    { label: "Application (DDD Obsidian plugin with EventBus)", scaffold: scaffoldApp },
	plugin: { label: "Starter Plugin (basic Obsidian plugin)", scaffold: scaffoldPlugin },
	cli:    { label: "CLI App (Node.js ESM with TypeScript)", scaffold: scaffoldCli },
	empty:  { label: "Empty", scaffold: scaffoldEmpty },
};

export const PROJECT_TEMPLATE_IDS: ProjectTemplateId[] = ["app", "plugin", "cli", "empty"];
