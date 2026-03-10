/**
 * storybook-renderers.ts — Display renderers for Storybook service.
 *
 * All ANSI-formatted log output for the Storybook lifecycle,
 * extracted from domain/make/component/storybook-service.ts.
 */

import { log } from "../infrastructure/logger.js";
import { printHeader } from "../infrastructure/ui.js";
import { RESET, BOLD, DIM, GREEN, RED, YELLOW, CYAN } from "../infrastructure/ui.js";

export function renderStorybookAlreadyInstalled(sbDir: string): void {
	log(`\n  ${YELLOW}Storybook is already installed at:${RESET} ${sbDir}\n`);
}

export function renderStorybookInstalling(sbDir: string): void {
	log(`\n  Installing Storybook into ${DIM}${sbDir}${RESET}...\n`);
}

export function renderStorybookInstallFailed(): void {
	log(`\n  ${RED}Storybook installation failed.${RESET}\n`);
}

export function renderStorybookInstallSuccess(sbDir: string): void {
	log(`\n  ${GREEN}✓${RESET} Storybook installed at ${sbDir}\n`);
}

export function renderStorybookNotInstalled(): void {
	log(`\n  ${YELLOW}Storybook not installed.${RESET} Use "Install Storybook" first.\n`);
}

export function renderStorybookAlreadyRunning(): void {
	log(`\n  ${YELLOW}Storybook is already running.${RESET}\n`);
}

export function renderStorybookStarting(): void {
	log(`\n  ${CYAN}▸${RESET} Starting Storybook...\n`);
}

export function renderStorybookFailedToStart(): void {
	log(`  ${RED}✗${RESET} Storybook failed to start.\n`);
}

export function renderStorybookFailOutput(lines: string[]): void {
	log(`  ${DIM}Output:${RESET}\n`);
	for (const line of lines) log(`    ${DIM}${line}${RESET}`);
	log();
}

export function renderStorybookTimeout(): void {
	log(`  ${YELLOW}⚠${RESET} Timed out waiting for Storybook — it may still be loading.\n`);
}

export function renderStorybookReady(url: string): void {
	log(`  ${GREEN}✓${RESET} Storybook ready at ${DIM}${url}${RESET}\n`);
}

export function renderStorybookStopped(): void {
	log(`\n  ${GREEN}✓${RESET} Storybook stopped.\n`);
}

export function renderStorybookNotRunning(): void {
	log(`\n  ${DIM}Storybook is not running.${RESET}\n`);
}

export function renderStorybookView(url: string): void {
	printHeader("Storybook");
	log(`  ${GREEN}✓${RESET} Running at ${BOLD}${url}${RESET}`);
	log(`  ${DIM}Press Enter to stop${RESET}\n`);
}

export function renderStorybookBrowserContext(message: string): void {
	log(`  ${DIM}${message}${RESET}\n`);
}

export function renderStorybookOpenedIn(target: string): void {
	log(`  ${CYAN}▸${RESET} Opened in ${target}\n`);
}
