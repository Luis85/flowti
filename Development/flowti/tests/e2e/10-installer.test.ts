/**
 * E2E Chapter 2: Installer Wizard
 *
 * Driven by declarative JSON config — see journeys/installer.journey.json
 * for step definitions and actions.
 *
 * Skip-mode: when the vault is already installed and E2E_RUN_INSTALLER
 * is not set, the entire suite is skipped.
 *
 * Run with: npm run test:e2e
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { executeJourney } from "./helpers/journeyExecutor";
import type { JourneyDefinition } from "./helpers/journeyTypes";
import { createFixture, shouldRunInstaller } from "./helpers/fixtures";

const configPath = path.join(__dirname, "journeys", "installer.journey.json");
const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;

// ── Skip-mode detection ──────────────────────────────────────

const _fixture = createFixture(process.env.OBSIDIAN_VAULT);
const skip = !shouldRunInstaller(_fixture.vault.vaultDir);

if (skip) {
	console.log("[e2e] Installer skipped (vault already installed). Force with E2E_RUN_INSTALLER=true");
}

executeJourney(definition, { skip });
