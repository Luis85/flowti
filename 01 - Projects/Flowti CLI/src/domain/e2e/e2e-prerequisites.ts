/**
 * e2e-prerequisites.ts — Vault validation and readiness checks.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { PrerequisiteResults } from "./e2e-types.js";

export function checkPrerequisites(e2e: E2EPaths): PrerequisiteResults {
	const results: PrerequisiteResults = {
		vaultExists: false,
		artifactsPresent: false,
		missingArtifacts: [],
		cliResponsive: false,
		vaultInstalled: false,
		testDataPresent: false,
	};

	// 1. Vault exists
	results.vaultExists = disk.existsSync(e2e.testVault);

	// 2. Plugin artifacts
	if (results.vaultExists) {
		results.missingArtifacts = e2e.pluginArtifacts.filter(
			(f) => !disk.existsSync(paths.join(e2e.pluginDir, f)),
		);
		results.artifactsPresent = results.missingArtifacts.length === 0;
	}

	// 3. CLI responsive (single eval, best-effort)
	if (results.vaultExists) {
		const output = shell.runSilent(`obsidian vault=${e2e.vaultName} eval code="1+1"`);
		results.cliResponsive = output !== null && output.includes("2");
	}

	// 4. Vault installed (data.json check)
	if (results.vaultExists && disk.existsSync(e2e.dataJsonPath)) {
		try {
			const data = JSON.parse(disk.readFileSync(e2e.dataJsonPath, "utf-8")) as Record<string, unknown>;
			results.vaultInstalled = (data.installer as Record<string, unknown>)?.installed === true;
		} catch {
			results.vaultInstalled = false;
		}
	}

	// 5. Test data present
	results.testDataPresent = disk.existsSync(e2e.testDataCsv);

	return results;
}

export function printPrerequisites(results: PrerequisiteResults, e2e: E2EPaths): void {
	const ok: (msg: string) => void = (msg) => log(`  \x1b[32m✓\x1b[0m ${msg}`);
	const fail: (msg: string) => void = (msg) => log(`  \x1b[31m✗\x1b[0m ${msg}`);
	const info: (msg: string) => void = (msg) => log(`  \x1b[33m○\x1b[0m ${msg}`);

	log("\n  Prerequisites (local):\n");

	if (results.vaultExists) ok(`Test vault exists: ${e2e.testVault}`);
	else fail(`Test vault missing: ${e2e.testVault}`);

	if (results.artifactsPresent) ok("Plugin artifacts: main.js, manifest.json, styles.css");
	else fail(`Plugin artifacts missing: ${results.missingArtifacts.join(", ")}`);

	if (results.cliResponsive) ok("Obsidian CLI responsive");
	else fail("Obsidian CLI not responsive (is Obsidian running?)");

	if (results.vaultInstalled) ok("Vault installed (data.json → installer.installed = true)");
	else info("Vault not installed (installer will run)");

	if (results.testDataPresent) ok("Test data CSV present");
	else info("Test data missing (generated during setup)");

	log();
}

/** Validates prerequisites and exits if critical ones are missing. */
export function validatePrerequisites(prereqResults: PrerequisiteResults): void {
	if (!prereqResults.vaultExists) {
		log("  Cannot proceed — test vault does not exist.");
		log(`  Create it by running: npm run test:e2e\n`);
		proc.exit(1);
	}
	if (!prereqResults.cliResponsive) {
		log("  Cannot proceed — Obsidian is not running or CLI not responsive.");
		log("  Start Obsidian with the test vault open, then try again.\n");
		proc.exit(1);
	}
}

/** Collapses all folders in the file explorer. */
export function collapseFileExplorer(e2e: E2EPaths): void {
	const result = shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="(() => { const explorer = app.workspace.getLeavesOfType('file-explorer')[0]; if (explorer && explorer.view) { const foldStatus = explorer.view.fileItems; if (foldStatus) { Object.values(foldStatus).forEach(item => { if (item.collapsed !== undefined) item.setCollapsed(true); }); } } })()"`,
	);
	if (result !== null) {
		log("  \x1b[32m✓\x1b[0m File navigator folders collapsed");
	}
}
