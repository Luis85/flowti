/**
 * E2E Global Setup — runs once before any E2E test file.
 *
 * Scaffolds the test vault, aborts the entire vitest run if this is
 * the first run (vault not yet registered in Obsidian), ensures
 * the test vault is the active vault in Obsidian, enables CSV file
 * detection, and generates test data fixtures.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ObsidianCli } from "../../src/infrastructure/cli/ObsidianCli";
import { TestVault } from "./helpers/testVault";
import { shouldRunInstaller } from "./helpers/fixtures";
import { SEED_REGISTRY, SEED_FOLDERS } from "./helpers/seedRegistry";
import { injectHighlightStyles } from "./helpers/highlight";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");

/** Max attempts to verify the test vault is responsive. */
const VAULT_READY_RETRIES = 20;
/** Delay between vault readiness checks (ms). */
const VAULT_READY_DELAY = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function setup(): Promise<void> {
	const vault = new TestVault(PLUGIN_ROOT);
	const isFirstRun = !vault.exists();

	vault.scaffold();

	if (isFirstRun) {
		const msg = [
      "",
      "=".repeat(60),
      "  E2E TEST VAULT CREATED",
      "=".repeat(60),
      "",
      `  Path: ${vault.vaultDir}`,
      "",
      "  Just register this folder as a vault in Obsidian:",
      "  Obsidian > Open another vault > Open folder as vault",
      "",
      "  No configuration needed — do not activate or change",
      "  anything. The plugin files are already in place.",
      "  Trust the Author and then minimze the Vault.",
      "  Tests run against a clean baseline vault.",
      "",
      "  Then re-run the E2E tests.",
      "=".repeat(60),
      "",
    ].join("\n");

		console.log(msg);
		process.exit(1);
	}

	// Determine whether to run the installer or skip.
	const runInstaller = shouldRunInstaller(vault.vaultDir);

	// Warm up — switch Obsidian to the test vault and wait until responsive.
	// If another vault was active, this triggers a vault switch which is async.
	const cli = new ObsidianCli({ vaultName: vault.vaultName, timeout: 15_000 });

	let vaultReady = false;
	for (let attempt = 1; attempt <= VAULT_READY_RETRIES; attempt++) {
		try {
			const result = cli.eval("1+1");
			if (result.success) {
				console.log(`[e2e] Test vault "${vault.vaultName}" is ready.`);
				vaultReady = true;
				break;
			}
		} catch {
			// Vault not ready yet
		}

		if (attempt < VAULT_READY_RETRIES) {
			console.log(`[e2e] Waiting for vault switch (attempt ${attempt}/${VAULT_READY_RETRIES})...`);
			await sleep(VAULT_READY_DELAY);
		}
	}

	if (!vaultReady) {
		console.error(`[e2e] Test vault "${vault.vaultName}" did not become responsive.`);
		console.error("[e2e] Make sure Obsidian is running and the test vault is registered.");
		process.exit(1);
	}

	// ── Backstage: make every setup operation visible via Obsidian notices ──

	const mode = runInstaller ? "Installer" : "Skip";
	cli.notice(`🔧 E2E Setup — ${mode} mode`, 10000);

	// Reset vault content THROUGH Obsidian's API (cache-safe).
	// Using fs.rmSync bypasses Obsidian's file index, causing ghost entries
	// that break file creation in the installer.
	if (runInstaller) {
		cli.notice("🗑 Resetting vault content…", 5000);

		// Delete all top-level vault content via vault API, skip .obsidian/
		cli.eval([
			"(async () => {",
			"  const root = app.vault.getRoot();",
			"  const children = root.children || [];",
			"  for (const child of [...children]) {",
			"    if (child.path === '.obsidian' || child.path.startsWith('.obsidian/')) continue;",
			"    try { await app.vault.delete(child, true); } catch(e) {}",
			"  }",
			"})()",
		].join(" "));
		// Wait for async deletions to complete
		await sleep(1000);

		// Purge ghost entries: files in Obsidian's index that no longer
		// exist on disk (left over from previous fs.rmSync-based resets).
		// vault.delete() silently fails for these, so we reconcile manually.
		cli.notice("🧹 Purging ghost file index entries…", 5000);
		cli.eval([
			"(async () => {",
			"  const ghosts = [];",
			"  for (const f of [...app.vault.getAllLoadedFiles()]) {",
			"    if (f.path === '/' || f.path.startsWith('.obsidian')) continue;",
			"    const exists = await app.vault.adapter.exists(f.path);",
			"    if (!exists) ghosts.push(f);",
			"  }",
			"  for (const f of ghosts) {",
			"    try { await app.vault.delete(f, true); } catch {}",
			"    try {",
			"      if (f.parent) f.parent.children = f.parent.children.filter(c => c !== f);",
			"      delete app.vault.fileMap[f.path];",
			"    } catch {}",
			"  }",
			"  if (ghosts.length > 0) console.log('[e2e] Purged ' + ghosts.length + ' ghost entries');",
			"})()",
		].join(" "));
		await sleep(500);

		cli.notice("✓ Vault reset complete", 3000);
		console.log("[e2e] Vault content reset via Obsidian API (installer mode).");
	} else {
		cli.notice("📦 Vault preserved — verifying seed files…", 5000);
		console.log("[e2e] Vault content preserved (skip mode — installer already ran).");
		await repairSeedFiles(cli, vault.vaultDir);
		cli.notice("✓ Seed files verified", 3000);
	}

	// Close all center pane views for a clean visual baseline
	cli.notice("🧹 Clearing workspace…", 3000);
	cli.eval(
		"app.workspace.iterateAllLeaves(l => { if (l.getRoot() === app.workspace.rootSplit) l.detach(); });",
	);
	console.log("[e2e] Closed all center pane views.");

	// Enable CSV and other non-markdown file types in the test vault
	cli.eval("app.vault.setConfig('detectAllFileExtensions', true)");
	console.log("[e2e] Enabled detectAllFileExtensions.");

	// Inject E2E highlight CSS for screenshot annotations
	injectHighlightStyles(cli);
	console.log("[e2e] Injected E2E highlight styles.");

	// Generate analytics test CSVs in the test vault (same script as main suite)
	cli.notice("📊 Generating test data fixtures…", 5000);
	const testDataDir = path.join(vault.vaultDir, "03 - Resources", "Test Data", "Analytics");
	execSync(`node scripts/generate-test-data.mjs --out "${testDataDir}"`, {
		cwd: PLUGIN_ROOT,
		stdio: "pipe",
	});
	console.log(`[e2e] Test data generated in ${testDataDir}`);

	// ── Create E2E Test Run log file ────────────────────────────────────
	const runMode = runInstaller ? "Installer" : "Skip";
	const runTs = new Date().toISOString().slice(0, 19).replace("T", " ");
	const runLogHeader = `# E2E Test Run\\n\\n> **Started**: ${runTs}\\n> **Mode**: ${runMode}\\n\\n---\\n`;
	cli.eval([
		`(async () => {`,
		`  var path = 'E2E Test Run.md';`,
		`  var existing = app.vault.getAbstractFileByPath(path);`,
		`  if (existing) { await app.vault.modify(existing, '${runLogHeader}'); }`,
		`  else { await app.vault.create(path, '${runLogHeader}'); }`,
		`})()`,
	].join(" "));
	await sleep(500);

	// Open the run log as a tab for live visibility
	cli.eval([
		`(async () => {`,
		`  var f = app.vault.getAbstractFileByPath('E2E Test Run.md');`,
		`  if (f && f.extension !== undefined) {`,
		`    var leaf = app.workspace.getLeaf('tab');`,
		`    await leaf.openFile(f);`,
		`  }`,
		`})()`,
	].join(" "));
	console.log("[e2e] Created and opened E2E Test Run.md");

	cli.notice("✓ E2E setup complete — starting tests", 5000);
}

/**
 * Ensures seed files and folders exist when the installer is skipped.
 *
 * The installer creates folders, a welcome note, and sample CSV during
 * its first run. When subsequent E2E runs skip the installer (vault
 * already installed), these files may be missing if a previous run's
 * teardown deleted them. This function repairs any gaps via the
 * Obsidian vault API (cache-safe).
 */
async function repairSeedFiles(cli: ObsidianCli, vaultDir: string): Promise<void> {
	let repaired = 0;

	// 1. Repair missing folders — the installer scaffolds 26 folders.
	//    We only repair the critical subset needed by journey tests.
	for (const folder of SEED_FOLDERS) {
		const fullPath = path.join(vaultDir, folder);
		if (!fs.existsSync(fullPath)) {
			cli.eval(`(async () => { try { await app.vault.createFolder('${folder}'); } catch {} })()`);
			repaired++;
		}
	}

	if (repaired > 0) {
		await sleep(500);
		console.log(`[e2e] Repaired ${repaired} missing folders.`);
	}

	// 2. Repair missing seed files (content from seedRegistry)
	for (const entry of SEED_REGISTRY) {
		const fullPath = path.join(vaultDir, entry.path);
		if (fs.existsSync(fullPath)) continue;

		// Escape for JS string (single quotes, backslashes, newlines)
		const escaped = entry.content.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
		cli.eval(`(async () => { try { await app.vault.create('${entry.path}', '${escaped}'); } catch {} })()`);
		repaired++;
		console.log(`[e2e] Repaired missing seed file: ${entry.path}`);
	}

	if (repaired > 0) {
		await sleep(500);
		// Re-set the installer gate flag since we've ensured everything is in place
		cli.eval("window._e2eInstallerDone = true");
	}

	console.log(`[e2e] Seed repair complete (${repaired} items repaired).`);
}

