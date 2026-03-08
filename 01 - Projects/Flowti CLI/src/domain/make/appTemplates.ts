/**
 * appTemplates.ts — Re-export shim for backward compatibility.
 *
 * Implementation moved to templates/app.ts.
 */

export {
	appManifestTemplate, appPackageTemplate, appTsconfigTemplate,
	appEsbuildTemplate, appVitestTemplate, appMainTemplate,
	appEventBusTemplate, appEventTypesTemplate, appEventsTemplate,
	appErrorTypesTemplate, appCssTemplate, appObsidianStubTemplate,
	appEventBusTestTemplate, appGitignoreTemplate,
} from "./templates/app.js";
