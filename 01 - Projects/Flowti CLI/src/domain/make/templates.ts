/**
 * templates.ts — Re-export shim for backward compatibility.
 *
 * Implementation moved to templates/hub.ts, templates/journey.ts, templates/plugin.ts.
 */

export {
	hubViewTemplate, hubTypesTemplate, hubEventsTemplate, hubServiceTemplate,
	hubProviderTemplate, hubTestTemplate, hubCssTemplate, hubPrdTemplate,
	hubJourneyTemplate,
} from "./templates/hub.js";

export {
	journeyDefinitionTemplate, journeyTestTemplate, journeyCanvasTemplate,
} from "./templates/journey.js";

export {
	pluginManifestTemplate, pluginPackageTemplate, pluginTsconfigTemplate,
	pluginEsbuildTemplate, pluginMainTemplate, pluginGitignoreTemplate,
} from "./templates/plugin.js";
