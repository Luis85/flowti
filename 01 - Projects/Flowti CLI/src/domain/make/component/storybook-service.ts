/**
 * storybook-service.ts — Storybook lifecycle management for projects.
 *
 * Handles installation, detection, and npm script wrapping for the
 * opt-in Storybook component library.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { shell } from "../../../infrastructure/shell.js";
import { log } from "../../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../../infrastructure/ui.js";
import { isCliAvailable, isVaultInitialized } from "../../knowledgebase/vault-service.js";
import type { ComponentsConfig } from "../../../infrastructure/types.js";

const DEFAULT_STORYBOOK_DIR = "component-library";

// ── Detection ────────────────────────────────────────────────────────

export function resolveStorybookDir(projectPath: string, config: ComponentsConfig): string {
	return paths.resolve(projectPath, config.storybookDir ?? DEFAULT_STORYBOOK_DIR);
}

export function isStorybookInstalled(projectPath: string, config: ComponentsConfig): boolean {
	const sbDir = resolveStorybookDir(projectPath, config);
	return disk.existsSync(paths.join(sbDir, "package.json"));
}

// ── Installation ─────────────────────────────────────────────────────

function writePackageJson(sbDir: string, projectName: string): void {
	const pkg = {
		name: `${projectName}-component-library`,
		version: "1.0.0",
		private: true,
		type: "module",
		scripts: {
			"storybook": "storybook dev -p 6006",
			"build-storybook": "storybook build",
		},
		devDependencies: {
			"@storybook/html": "^10.0.0",
			"@storybook/html-vite": "^10.0.0",
			"storybook": "^10.0.0",
		},
	};
	disk.writeFileSync(paths.join(sbDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
}

function writeStorybookConfig(sbDir: string): void {
	const configDir = paths.join(sbDir, ".storybook");
	disk.mkdirSync(configDir, { recursive: true });

	const mainTs = `import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
	stories: ["../../src/components/**/*.stories.@(ts|tsx)"],
	framework: "@storybook/html-vite",
	core: {
		disableTelemetry: true,
	},
};

export default config;
`;

	const previewTs = `import type { Preview } from "@storybook/html";

const preview: Preview = {
	tags: ["autodocs"],
	parameters: {
		controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
	},
};

export default preview;
`;

	disk.writeFileSync(paths.join(configDir, "main.ts"), mainTs, "utf-8");
	disk.writeFileSync(paths.join(configDir, "preview.ts"), previewTs, "utf-8");
}

export function installStorybook(projectPath: string, projectName: string, config: ComponentsConfig): boolean {
	const sbDir = resolveStorybookDir(projectPath, config);

	if (isStorybookInstalled(projectPath, config)) {
		log(`\n  ${YELLOW}Storybook is already installed at:${RESET} ${sbDir}\n`);
		return true;
	}

	log(`\n  Installing Storybook into ${DIM}${sbDir}${RESET}...\n`);

	// Create directory structure
	disk.mkdirSync(sbDir, { recursive: true });
	disk.mkdirSync(paths.join(sbDir, "src"), { recursive: true });

	// Write configuration files
	writePackageJson(sbDir, projectName);
	writeStorybookConfig(sbDir);

	// Install dependencies
	const code = shell.run("npm install", { cwd: sbDir, label: "Installing Storybook dependencies" });
	if (code !== 0) {
		log(`\n  ${RED}Storybook installation failed.${RESET}\n`);
		return false;
	}

	log(`\n  ${GREEN}✓${RESET} Storybook installed at ${sbDir}\n`);
	return true;
}

// ── Obsidian Web Viewer ──────────────────────────────────────────────

const DEFAULT_STORYBOOK_PORT = 6006;

function openInObsidianWebViewer(url: string): boolean {
	if (!isCliAvailable() || !isVaultInitialized()) return false;
	shell.runSilent(`obsidian web url=${url} newtab`);
	return true;
}

// ── Script wrappers ──────────────────────────────────────────────────

export function runStorybookDev(projectPath: string, config: ComponentsConfig): void {
	const sbDir = resolveStorybookDir(projectPath, config);
	if (!isStorybookInstalled(projectPath, config)) {
		log(`\n  ${YELLOW}Storybook not installed.${RESET} Use "Install Storybook" first.\n`);
		return;
	}
	const url = `http://localhost:${DEFAULT_STORYBOOK_PORT}`;
	if (openInObsidianWebViewer(url)) {
		log(`  ${CYAN}▸${RESET} Opening ${url} in Obsidian Web Viewer\n`);
	}
	shell.run("npm run storybook", { cwd: sbDir, label: "Storybook dev" });
}

export function runStorybookBuild(projectPath: string, config: ComponentsConfig): void {
	const sbDir = resolveStorybookDir(projectPath, config);
	if (!isStorybookInstalled(projectPath, config)) {
		log(`\n  ${YELLOW}Storybook not installed.${RESET} Use "Install Storybook" first.\n`);
		return;
	}
	shell.run("npm run build-storybook", { cwd: sbDir, label: "Storybook build" });
}
