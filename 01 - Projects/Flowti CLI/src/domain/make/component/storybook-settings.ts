/**
 * storybook-settings.ts — Read/write Storybook-related settings in the project config.
 *
 * Reads and updates the `components` section of `configs/flowti.config.json`.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { ComponentFramework, ComponentsConfig, ProjectConfig } from "../../../infrastructure/types.js";

export type StorybookSettingsDeps = Pick<CliDeps, "disk" | "paths">;

const CONFIGS_DIR = "configs";
const FLOWTI_CONFIG = "flowti.config.json";

export function readComponentsConfig(projectPath: string, deps: StorybookSettingsDeps): ComponentsConfig {
	const cfgPath = deps.paths.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	if (!deps.disk.existsSync(cfgPath)) return {};
	try {
		const raw = JSON.parse(deps.disk.readFileSync(cfgPath, "utf-8")) as ProjectConfig;
		return raw.components ?? {};
	} catch {
		return {};
	}
}

export function writeComponentsConfig(projectPath: string, updates: Partial<ComponentsConfig>, deps: StorybookSettingsDeps): void {
	const cfgPath = deps.paths.join(projectPath, CONFIGS_DIR, FLOWTI_CONFIG);
	let config: ProjectConfig;
	try {
		config = JSON.parse(deps.disk.readFileSync(cfgPath, "utf-8")) as ProjectConfig;
	} catch {
		config = { name: deps.paths.basename(projectPath) };
	}

	config.components = { ...config.components, ...updates };

	const configsDir = deps.paths.join(projectPath, CONFIGS_DIR);
	if (!deps.disk.existsSync(configsDir)) deps.disk.mkdirSync(configsDir, { recursive: true });
	deps.disk.writeFileSync(cfgPath, JSON.stringify(config, null, "\t"), "utf-8");
}

export function getFramework(projectPath: string, deps: StorybookSettingsDeps): ComponentFramework {
	return readComponentsConfig(projectPath, deps).framework ?? "html";
}

export function setFramework(projectPath: string, framework: ComponentFramework, deps: StorybookSettingsDeps): void {
	writeComponentsConfig(projectPath, { framework }, deps);
}
