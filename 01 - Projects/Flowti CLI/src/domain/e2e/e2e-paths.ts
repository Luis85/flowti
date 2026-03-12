/**
 * e2e-paths.ts — Resolved E2E path configuration.
 *
 * Provides a project-aware path resolution function that both
 * run-e2e.ts and e2e-report.ts use instead of hardcoded constants.
 */

import { VAULT_ROOT } from "../../infrastructure/config.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { ReviewConfig } from "../../infrastructure/types.js";

export interface E2EPaths {
	/** Project source root (e.g., Development/flowti) */
	projectRoot: string;
	/** Obsidian plugin ID */
	pluginId: string;
	/** Directory containing journey definitions */
	journeysDir: string;
	/** Path to the E2E test vault */
	testVault: string;
	/** Basename of the test vault (for Obsidian CLI commands) */
	vaultName: string;
	/** Plugin directory inside the test vault */
	pluginDir: string;
	/** Path to data.json inside the test vault plugin dir */
	dataJsonPath: string;
	/** Plugin artifacts that must be present */
	pluginArtifacts: string[];
	/** Path to test data CSV */
	testDataCsv: string;
	/** Reports directory for the project */
	reportsDir: string;
	/** Dev vault runs directory for E2E report archives */
	devRunsDir: string;
	/** Dev vault traces directory */
	devTracesDir: string;
	/** Dev vault journeys directory */
	devJourneysDir: string;
	/** Vitest JSON results path (temp artifact) */
	vitestResults: string;
	/** Data.json candidates for startup perf metrics */
	dataJsonCandidates: string[];
}

/**
 * Resolve all E2E paths from a project root and its review config.
 * Falls back to sensible defaults for each field.
 */
export function resolveE2EPaths(projectRoot: string, review: ReviewConfig | undefined, deps: Pick<CliDeps, "paths" | "proc">): E2EPaths {
	const { paths, proc } = deps;
	const pluginId = review?.pluginId ?? "flowti-ibde";
	const journeysDir = paths.join(projectRoot, review?.journeysDir ?? "tests/e2e/journeys");

	// Test vault: from config (relative to vault root), env var override, or sibling convention
	let testVault: string;
	const envVault = proc.env().E2E_VAULT_DIR;
	if (envVault) {
		testVault = envVault;
	} else if (review?.testVault) {
		// Resolve relative to vault root
		testVault = paths.resolve(VAULT_ROOT, review.testVault);
	} else {
		// Convention: sibling to the vault root
		testVault = paths.join(paths.resolve(VAULT_ROOT, ".."), "flowti-e2e");
	}

	const vaultName = paths.basename(testVault);
	const pluginDir = paths.join(testVault, ".obsidian", "plugins", pluginId);

	return {
		projectRoot,
		pluginId,
		journeysDir,
		testVault,
		vaultName,
		pluginDir,
		dataJsonPath: paths.join(pluginDir, "data.json"),
		pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
		testDataCsv: paths.join(testVault, "03 - Resources", "Test Data", "Analytics", "Suppliers.csv"),
		reportsDir: paths.join(projectRoot, "docs", "reports"),
		devRunsDir: paths.join(projectRoot, "docs", "reports", "e2e", "runs"),
		devTracesDir: paths.join(projectRoot, "docs", "reports", "e2e", "traces"),
		devJourneysDir: paths.join(projectRoot, "docs", "journeys"),
		vitestResults: paths.join(projectRoot, "docs", "reports", "e2e", "e2e-results.json"),
		dataJsonCandidates: [
			paths.resolve(projectRoot, "..", "..", ".obsidian", "plugins", pluginId, "data.json"),
			paths.join(projectRoot, "data.json"),
		],
	};
}
