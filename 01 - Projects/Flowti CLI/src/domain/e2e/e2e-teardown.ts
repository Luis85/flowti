/**
 * e2e-teardown.ts — Vault reset and rebuild operations.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { input } from "../../infrastructure/input.js";
import { runPipeline } from "../../infrastructure/pipeline/pipeline-runner.js";
import type { E2EPaths } from "./e2e-paths.js";
import { collapseFileExplorer } from "./e2e-prerequisites.js";
import { buildRebuildPipeline } from "./pipelines/rebuild-pipeline.js";

/**
 * Performs the actual teardown steps (non-interactive).
 * Deletes vault content, resets installer state, deactivates plugin,
 * clears workspace layout, and collapses file explorer.
 */
export async function performTeardown(e2e: E2EPaths): Promise<void> {
	// 1. Delete vault content via Obsidian CLI (cache-safe)
	const deleteResult = shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="(async () => { const root = app.vault.getRoot(); const children = root.children || []; for (const child of [...children]) { if (child.path === '.obsidian' || child.path.startsWith('.obsidian/')) continue; try { await app.vault.delete(child, true); } catch(e) {} } })()"`,
	);
	if (deleteResult !== null) {
		await new Promise<void>((r) => setTimeout(r, 1000));
		log("  \x1b[32m✓\x1b[0m Vault content deleted (via Obsidian API)");
	} else {
		log("  \x1b[31m✗\x1b[0m Failed to delete vault content (is Obsidian running?)");
	}

	// 2. Purge ghost file index entries
	const purgeResult = shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="(async () => { const ghosts = []; for (const f of [...app.vault.getAllLoadedFiles()]) { if (f.path === '/' || f.path.startsWith('.obsidian')) continue; const exists = await app.vault.adapter.exists(f.path); if (!exists) ghosts.push(f); } for (const f of ghosts) { try { await app.vault.delete(f, true); } catch {} try { if (f.parent) f.parent.children = f.parent.children.filter(c => c !== f); delete app.vault.fileMap[f.path]; } catch {} } })()"`,
	);
	if (purgeResult !== null) {
		await new Promise<void>((r) => setTimeout(r, 500));
		log("  \x1b[32m✓\x1b[0m Ghost entries purged");
	}

	// 3. Reset data.json
	if (disk.existsSync(e2e.dataJsonPath)) {
		try {
			const data = JSON.parse(disk.readFileSync(e2e.dataJsonPath, "utf-8")) as Record<string, unknown>;
			data.installer = { installed: false, completedSteps: {} };
			disk.writeFileSync(e2e.dataJsonPath, JSON.stringify(data), "utf-8");
			log("  \x1b[32m✓\x1b[0m Installer state reset");
		} catch {
			log("  \x1b[31m✗\x1b[0m Failed to reset data.json");
		}
	} else {
		log("  \x1b[33m○\x1b[0m data.json not found (already fresh)");
	}

	// 4. Deactivate plugin
	const disableResult = shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="app.plugins.disablePlugin('${e2e.pluginId}')"`,
	);
	if (disableResult !== null) {
		await new Promise<void>((r) => setTimeout(r, 1000));
		log("  \x1b[32m✓\x1b[0m Plugin deactivated");
	} else {
		log("  \x1b[33m○\x1b[0m Plugin deactivation skipped (may not be loaded)");
	}

	// 5. Clear workspace layout
	const workspacePath: string = paths.join(e2e.testVault, ".obsidian", "workspace.json");
	if (disk.existsSync(workspacePath)) {
		try {
			disk.rmSync(workspacePath, { force: true });
			log("  \x1b[32m✓\x1b[0m Workspace layout cleared");
		} catch {
			// Non-fatal
		}
	}

	// 6. Collapse all folders in the file navigator
	collapseFileExplorer(e2e);

	log("\n  \x1b[32m✓\x1b[0m Fresh state.\n");
}

/**
 * Interactive teardown — prompts for confirmation before proceeding.
 */
export async function teardownVault(e2e: E2EPaths): Promise<void> {
	log("\n  Teardown will:");
	log("    - Delete all vault content (except .obsidian/)");
	log("    - Reset installer state (data.json → installed: false)");
	log("    - Deactivate plugin");
	log("    - Clear workspace layout");
	log("    - Collapse file navigator folders\n");

	const proceed = await input.askYesNo("Proceed?", true);

	if (!proceed) {
		log("\n  Teardown cancelled.\n");
		return;
	}

	log();
	await performTeardown(e2e);
}

/**
 * Rebuild: teardown + prerequisites + installer run via pipeline.
 */
export async function runRebuild(e2e: E2EPaths): Promise<number> {
	log("\n  Rebuilding vault (teardown → prerequisites → installer)...\n");

	const proceed = await input.askYesNo("This will teardown and rebuild the vault. Proceed?", true);
	if (!proceed) {
		log("\n  Rebuild cancelled.\n");
		return 0;
	}

	const steps = buildRebuildPipeline(e2e);
	const result = await runPipeline(steps, e2e.projectRoot, { label: "Rebuild" });
	return result.failed > 0 ? 1 : 0;
}
