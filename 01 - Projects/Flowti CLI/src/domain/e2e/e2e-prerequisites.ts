/**
 * e2e-prerequisites.ts — Vault validation and readiness checks.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { PrerequisiteResults } from "./e2e-types.js";

export function checkPrerequisites(e2e: E2EPaths, deps: Pick<CliDeps, "disk" | "paths" | "shell">): PrerequisiteResults {
	const { disk, paths, shell } = deps;
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

/** Validates prerequisites and exits if critical ones are missing. */
export function validatePrerequisites(prereqResults: PrerequisiteResults, deps: Pick<CliDeps, "proc" | "log">): void {
	if (!prereqResults.vaultExists) {
		deps.log("  Cannot proceed — test vault does not exist.");
		deps.log("  Create it by running: npm run test:e2e");
		deps.proc.exit(1);
	}
	if (!prereqResults.cliResponsive) {
		deps.log("  Cannot proceed — Obsidian is not running or CLI not responsive.");
		deps.log("  Start Obsidian with the test vault open, then try again.");
		deps.proc.exit(1);
	}
}

/** Collapses all folders in the file explorer. */
export function collapseFileExplorer(e2e: E2EPaths, deps: Pick<CliDeps, "shell" | "log">): void {
	const result = deps.shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="(() => { const explorer = app.workspace.getLeavesOfType('file-explorer')[0]; if (explorer && explorer.view) { const foldStatus = explorer.view.fileItems; if (foldStatus) { Object.values(foldStatus).forEach(item => { if (item.collapsed !== undefined) item.setCollapsed(true); }); } } })()"`,
	);
	if (result !== null) {
		deps.log("  ✓ File navigator folders collapsed");
	}
}
