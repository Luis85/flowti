/**
 * storybook-renderers.ts — Display renderers for Storybook service.
 *
 * All ANSI-formatted log output for the Storybook lifecycle,
 * extracted from domain/make/component/storybook-service.ts.
 */

import { printHeader } from "../../infrastructure/ui.js";
import { RESET, BOLD, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { Log } from "../../infrastructure/deps.js";

export function renderStorybookAlreadyInstalled(sbDir: string, log: Log): void {
	log(`
  ${YELLOW}Storybook is already installed at:${RESET} ${sbDir}
`);
}

export function renderStorybookInstalling(sbDir: string, log: Log): void {
	log(`
  Installing Storybook into ${DIM}${sbDir}${RESET}...
`);
}

export function renderStorybookInstallFailed(log: Log): void {
	log(`
  ${RED}Storybook installation failed.${RESET}
`);
}

export function renderStorybookInstallSuccess(sbDir: string, log: Log): void {
	log(`
  ${GREEN}✓${RESET} Storybook installed at ${sbDir}
`);
}

export function renderStorybookNotInstalled(log: Log): void {
	log(`
  ${YELLOW}Storybook not installed.${RESET} Use "Install Storybook" first.
`);
}

export function renderStorybookAlreadyRunning(log: Log): void {
	log(`
  ${YELLOW}Storybook is already running.${RESET}
`);
}

export function renderStorybookStarting(log: Log): void {
	log(`
  ${CYAN}▸${RESET} Starting Storybook...
`);
}

export function renderStorybookFailedToStart(log: Log): void {
	log(`  ${RED}✗${RESET} Storybook failed to start.
`);
}

export function renderStorybookFailOutput(lines: string[], log: Log): void {
	log(`  ${DIM}Output:${RESET}
`);
	for (const line of lines) log(`    ${DIM}${line}${RESET}`);
	log();
}

export function renderStorybookTimeout(log: Log): void {
	log(`  ${YELLOW}⚠${RESET} Timed out waiting for Storybook — it may still be loading.
`);
}

export function renderStorybookReady(url: string, log: Log): void {
	log(`  ${GREEN}✓${RESET} Storybook ready at ${DIM}${url}${RESET}
`);
}

export function renderStorybookStopped(log: Log): void {
	log(`
  ${GREEN}✓${RESET} Storybook stopped.
`);
}

export function renderStorybookNotRunning(log: Log): void {
	log(`
  ${DIM}Storybook is not running.${RESET}
`);
}

export function renderStorybookView(url: string, log: Log): void {
	printHeader("Storybook");
	log(`  ${GREEN}✓${RESET} Running at ${BOLD}${url}${RESET}`);
	log(`  ${DIM}Press Enter to stop${RESET}
`);
}

export function renderStorybookBrowserContext(message: string, log: Log): void {
	log(`  ${DIM}${message}${RESET}
`);
}

export function renderStorybookOpenedIn(target: string, log: Log): void {
	log(`  ${CYAN}▸${RESET} Opened in ${target}
`);
}

export function renderStorybookProgress(line: string, log: Log): void {
	log(`  ${DIM}${line}${RESET}`);
}

// ── CLI command renderers ────────────────────────────────────────────

export interface StorybookInstallResultModel {
	installed: boolean;
	framework: string;
	sbDir: string;
}

export function renderStorybookInstallResult(data: StorybookInstallResultModel, log: Log): void {
	if (data.installed) {
		log(`\n  ${GREEN}✓${RESET} Storybook installed (${data.framework}) at ${DIM}${data.sbDir}${RESET}\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Storybook installation failed.\n`);
	}
}

export interface StorybookStartResultModel {
	started: boolean;
	url: string;
	pid?: number;
	error?: string;
}

export function renderStorybookStartResult(data: StorybookStartResultModel, log: Log): void {
	if (data.started) {
		log(`\n  ${GREEN}✓${RESET} Storybook running at ${DIM}${data.url}${RESET}\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Storybook failed to start: ${data.error ?? "unknown"}\n`);
	}
}

export interface StorybookStopResultModel {
	stopped: boolean;
	wasRunning: boolean;
}

export function renderStorybookStopResult(data: StorybookStopResultModel, log: Log): void {
	if (data.wasRunning) {
		log(`\n  ${GREEN}✓${RESET} Storybook stopped.\n`);
	} else {
		log(`\n  ${DIM}Storybook was not running.${RESET}\n`);
	}
}

export interface StorybookBuildResultModel {
	built: boolean;
}

export function renderStorybookBuildResult(data: StorybookBuildResultModel, log: Log): void {
	if (data.built) {
		log(`\n  ${GREEN}✓${RESET} Storybook build complete.\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Storybook build failed.\n`);
	}
}

export interface StorybookGenerateResultModel {
	generated: boolean;
	exitCode: number;
}

export function renderStorybookGenerateResult(data: StorybookGenerateResultModel, log: Log): void {
	if (data.generated) {
		log(`\n  ${GREEN}✓${RESET} Sitemap stories generated.\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Story generation failed (exit code ${data.exitCode}).\n`);
	}
}

// ── Scaffold renderer ────────────────────────────────────────────────

export interface StorybookScaffoldResultModel {
	files: Array<{ path: string; content: string }>;
	framework: string;
	pageCount: number;
	outputDir?: string;
	adoptedImport?: boolean;
	noSitemap?: boolean;
	pendingImport?: boolean;
}

export function renderStorybookScaffoldResult(data: StorybookScaffoldResultModel, log: Log): void {
	if (data.pendingImport) {
		log(`\n  ${YELLOW}Found imported-sitemap.json${RESET} — use --adopt-import to make it the project sitemap.\n`);
		return;
	}
	if (data.noSitemap) {
		log(`\n  ${YELLOW}No sitemap found at configs/sitemap.json.${RESET} Run "Import Markdown → Sitemap" first.\n`);
		return;
	}
	if (data.adoptedImport) {
		log(`\n  ${GREEN}✓${RESET} Adopted imported-sitemap.json as project sitemap ${DIM}(configs/sitemap.json)${RESET}`);
	}
	if (data.pageCount === 0) {
		log(`\n  ${YELLOW}No pages found in sitemap.${RESET} Nothing to scaffold.\n`);
		return;
	}
	const dir = data.outputDir ? ` in ${DIM}${data.outputDir}${RESET}` : "";
	log(`\n  ${GREEN}✓${RESET} Scaffolded ${BOLD}${data.files.length}${RESET} files for ${BOLD}${data.pageCount}${RESET} pages (${data.framework})${dir}\n`);
	for (const file of data.files) {
		log(`    ${DIM}${file.path}${RESET}`);
	}
	log();
}

// ── Import renderer ─────────────────────────────────────────────────

export interface StorybookImportResultModel {
	componentCount: number;
	skippedCount: number;
	warnings: ReadonlyArray<{ file: string; reason: string }>;
	outputPath: string;
	configured: boolean;
}

export function renderStorybookImportResult(data: StorybookImportResultModel, log: Log): void {
	if (!data.configured) {
		log(`\n  ${YELLOW}No markdownSource configured in components config.${RESET}\n`);
		return;
	}

	if (data.componentCount === 0 && data.skippedCount === 0) {
		log(`\n  ${YELLOW}No markdown files found in source folder.${RESET}\n`);
		return;
	}

	log(`\n  ${GREEN}✓${RESET} Imported ${BOLD}${data.componentCount}${RESET} components → ${DIM}${data.outputPath}${RESET}`);

	if (data.skippedCount > 0) {
		log(`  ${YELLOW}⚠${RESET} Skipped ${data.skippedCount} file(s):`);
		for (const w of data.warnings) {
			log(`    ${DIM}${w.file}${RESET}: ${w.reason}`);
		}
	}
	log();
}
