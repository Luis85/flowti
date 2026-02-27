/**
 * Pure function to resolve capture configuration for a given type.
 *
 * Resolution order (per field):
 *   1. Per-type override in captureConfig.overrides[type]
 *   2. captureFolder (for folder) / captureConfig.defaultTemplate (for template)
 */

import type { CaptureOverride, ResolvedCaptureConfig } from "./types";

export interface CaptureConfigSettings {
	captureFolder: string;
	captureConfig: {
		defaultTemplate: string;
		overrides: Record<string, CaptureOverride>;
	};
}

export function resolveCaptureConfig(
	type: string,
	settings: CaptureConfigSettings,
): ResolvedCaptureConfig {
	const override = settings.captureConfig.overrides[type];
	return {
		folder: override?.folder || settings.captureFolder,
		template: override?.template || settings.captureConfig.defaultTemplate,
	};
}
