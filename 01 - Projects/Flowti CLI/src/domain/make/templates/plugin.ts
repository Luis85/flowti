/**
 * plugin.ts — Scaffolding templates for standalone Obsidian plugin generation.
 */

import { toPascal } from "../naming.js";
import {
	manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, gitignoreTemplate,
} from "./config.js";

export function pluginManifestTemplate(pluginName: string, pluginId: string, author: string): string {
	return manifestTemplate({ id: pluginId, name: pluginName, author });
}

export function pluginPackageTemplate(pluginName: string, pluginId: string): string {
	return packageTemplate("plugin", pluginName, pluginId);
}

export function pluginTsconfigTemplate(): string {
	return tsconfigTemplate("plugin");
}

export function pluginEsbuildTemplate(pluginId: string): string {
	return esbuildTemplate(pluginId);
}

export function pluginMainTemplate(pluginName: string): string {
	const pascal = toPascal(pluginName);
	return `import { Plugin } from "obsidian";

export default class ${pascal}Plugin extends Plugin {

\tasync onload(): Promise<void> {
\t\tconsole.log(\`[${pluginName}] loaded\`);
\t}

\tasync onunload(): Promise<void> {
\t\tconsole.log(\`[${pluginName}] unloaded\`);
\t}
}
`;
}

export function pluginGitignoreTemplate(): string {
	return gitignoreTemplate("plugin");
}
