/**
 * templates/index.ts — Barrel re-export for all make templates.
 */

export {
	toJson, manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
	type ManifestOptions, type ProjectKind,
} from "./config.js";

export { createFileWriter, type FileWriter } from "./file-writer.js";

export {
	journeyDefinitionTemplate, journeyTestTemplate, journeyCanvasTemplate,
} from "./journey.js";

export {
	pluginManifestTemplate, pluginPackageTemplate, pluginTsconfigTemplate,
	pluginEsbuildTemplate, pluginMainTemplate, pluginGitignoreTemplate,
} from "./plugin.js";

export {
	appManifestTemplate, appPackageTemplate, appTsconfigTemplate,
	appEsbuildTemplate, appVitestTemplate, appMainTemplate,
	appEventBusTemplate, appEventTypesTemplate, appEventsTemplate,
	appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate,
	appEventBusTestTemplate, appGitignoreTemplate,
} from "./app.js";

export {
	cliPackageTemplate, cliTsconfigTemplate, cliMainTemplate,
	cliMainTestTemplate, cliVitestTemplate, cliGitignoreTemplate,
} from "./cli.js";
