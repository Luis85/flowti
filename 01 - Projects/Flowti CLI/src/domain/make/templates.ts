/**
 * templates.ts — Re-export shim for backward compatibility.
 *
 * Implementation moved to templates/journey.ts, templates/plugin.ts.
 */

export {
	journeyDefinitionTemplate, journeyTestTemplate, journeyCanvasTemplate,
} from "./templates/journey.js";

export {
	pluginManifestTemplate, pluginPackageTemplate, pluginTsconfigTemplate,
	pluginEsbuildTemplate, pluginMainTemplate, pluginGitignoreTemplate,
} from "./templates/plugin.js";
