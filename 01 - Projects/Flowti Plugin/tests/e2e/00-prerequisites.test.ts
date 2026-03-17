/**
 * E2E Chapter 1: Prerequisites
 *
 * Driven by declarative JSON config — see journeys/prerequisites.journey
 * for step definitions and actions.
 *
 * Handles skip-mode detection: when a previous run passed (anchor file),
 * the full suite is skipped and only gate flags are set.
 *
 * Run with: npm run test:e2e
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";
import {
	createFixture,
	shouldRunPrerequisites,
	shouldRunInstaller,
	ensurePluginEnabled,
	startEventTrace,
	openActivityLog,
} from "./helpers/fixtures";

const configPath = path.join(__dirname, "journeys", "prerequisites.journey");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

// ── Skip-mode detection (before any describe block) ──────────

const _fixture = createFixture(process.env.OBSIDIAN_VAULT);
const skip = !shouldRunPrerequisites(_fixture.vault.vaultDir);
const installerMode = shouldRunInstaller(_fixture.vault.vaultDir);

if (skip) {
	console.log("[e2e] Prerequisites skipped (previous run passed). Force with E2E_RUN_PREREQUISITES=true");
}

executeJourney(definition, {
	skip,
	onSkip: async (cli) => {
		await ensurePluginEnabled(cli);
		startEventTrace(cli);
		openActivityLog(cli);
		cli.eval("window._e2ePrerequisitesPassed = true");
		cli.eval("window._e2eInstallerDone = true");
	},
	variables: {
		installerMode: installerMode ? "installer" : "skip",
	},
});
