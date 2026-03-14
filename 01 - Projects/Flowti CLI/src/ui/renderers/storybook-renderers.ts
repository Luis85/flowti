/**
 * storybook-renderers.ts — Display renderers for Storybook service.
 *
 * All ANSI-formatted log output for the Storybook lifecycle,
 * extracted from domain/make/component/storybook-service.ts.
 */

import { printHeader } from "../../infrastructure/ui.js";
import { RESET, BOLD, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { Log } from "../../infrastructure/deps.js";

export function renderStorybookAlreadyInstalled(log: Log, sbDir: string): void {
	log(`\n  ${YELLOW}Storybook is already installed at:${RESET} ${sbDir}\n`);
}

export function renderStorybookInstalling(log: Log, sbDir: string): void {
	log(`\n  Installing Storybook into ${DIM}${sbDir}${RESET}...\n`);
}

export function renderStorybookInstallFailed(log: Log): void {
	log(`\n  ${RED}Storybook installation failed.${RESET}\n`);
}

export function renderStorybookInstallSuccess(log: Log, sbDir: string): void {
	log(`\n  ${GREEN}✓${RESET} Storybook installed at ${sbDir}\n`);
}

export function renderStorybookNotInstalled(log: Log): void {
	log(`\n  ${YELLOW}Storybook not installed.${RESET} Use "Install Storybook" first.\n`);
}

export function renderStorybookAlreadyRunning(log: Log): void {
	log(`\n  ${YELLOW}Storybook is already running.${RESET}\n`);
}

export function renderStorybookStarting(log: Log): void {
	log(`\n  ${CYAN}▸${RESET} Starting Storybook...\n`);
}

export function renderStorybookFailedToStart(log: Log): void {
	log(`  ${RED}✗${RESET} Storybook failed to start.\n`);
}

export function renderStorybookFailOutput(log: Log, lines: string[]): void {
	log(`  ${DIM}Output:${RESET}\n`);
	for (const line of lines) log(`    ${DIM}${line}${RESET}`);
	log();
}

export function renderStorybookTimeout(log: Log): void {
	log(`  ${YELLOW}⚠${RESET} Timed out waiting for Storybook — it may still be loading.\n`);
}

export function renderStorybookReady(log: Log, url: string): void {
	log(`  ${GREEN}✓${RESET} Storybook ready at ${DIM}${url}${RESET}\n`);
}

export function renderStorybookStopped(log: Log): void {
	log(`\n  ${GREEN}✓${RESET} Storybook stopped.\n`);
}

export function renderStorybookNotRunning(log: Log): void {
	log(`\n  ${DIM}Storybook is not running.${RESET}\n`);
}

export function renderStorybookView(log: Log, url: string): void {
	printHeader("Storybook");
	log(`  ${GREEN}✓${RESET} Running at ${BOLD}${url}${RESET}`);
	log(`  ${DIM}Press Enter to stop${RESET}\n`);
}

export function renderStorybookBrowserContext(log: Log, message: string): void {
	log(`  ${DIM}${message}${RESET}\n`);
}

export function renderStorybookOpenedIn(log: Log, target: string): void {
	log(`  ${CYAN}▸${RESET} Opened in ${target}\n`);
}

export function renderStorybookProgress(log: Log, line: string): void {
	log(`  ${DIM}${line}${RESET}`);
}
