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
import { shouldRunInstaller, INSTALLER_SEED_FILES } from "./helpers/fixtures";
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
	const criticalFolders = [
		"00 - Connectivity",
		"00 - Connectivity/input",
		"00 - Connectivity/inbox",
		"00 - Connectivity/imports",
		"00 - Connectivity/share",
		"00 - Connectivity/feedback",
		"01 - Projects",
		"02 - Areas",
		"03 - Resources",
		"03 - Resources/Attachments",
		"03 - Resources/Sample Data",
		"03 - Resources/Documentation",
		"03 - Resources/Templates",
		"04 - Archive",
		"var",
		"var/data",
		"var/events",
		"var/reports",
	];

	for (const folder of criticalFolders) {
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

	// 2. Repair missing seed files
	for (const seedPath of INSTALLER_SEED_FILES) {
		const fullPath = path.join(vaultDir, seedPath);
		if (fs.existsSync(fullPath)) continue;

		const content = getSeedContent(seedPath);
		if (!content) continue;

		// Escape for JS string (single quotes, backslashes, newlines)
		const escaped = content.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
		cli.eval(`(async () => { try { await app.vault.create('${seedPath}', '${escaped}'); } catch {} })()`);
		repaired++;
		console.log(`[e2e] Repaired missing seed file: ${seedPath}`);
	}

	if (repaired > 0) {
		await sleep(500);
		// Re-set the installer gate flag since we've ensured everything is in place
		cli.eval("window._e2eInstallerDone = true");
	}

	console.log(`[e2e] Seed repair complete (${repaired} items repaired).`);
}

/** Returns the default content for a known seed file path. */
function getSeedContent(seedPath: string): string | null {
	if (seedPath === "00 - Connectivity/inbox/Welcome to Flowti.md") {
		return [
			"# Welcome to Flowti!",
			"",
			"Your Integrated Business Development Environment is ready.",
			"",
			"## First Steps",
			"",
			"1. **Explore your dashboard** — Open the Analytics Hub to see your Supplier Overview dashboard with live charts and metrics.",
			"2. **Review sample data** — The supplier overview CSV in `03 - Resources/Sample Data/` contains realistic demo data you can modify.",
			"3. **Import your own data** — Drop CSV files into `00 - Connectivity/imports/` to trigger the ingestion pipeline.",
			"4. **Create subscriptions** — Set up event subscriptions to watch for file changes in specific folders.",
			"5. **Build custom queries** — Use the Analytics Query Builder to slice and dice your data.",
			"",
			"## Key Concepts",
			"",
			"- **Events** drive everything — file changes emit events, subscriptions react.",
			"- **Dashboards** visualize query results as tables, stat cards, and charts.",
			"- **Sessions** are time-boxed documentation periods for focused work.",
			"",
			"> Tip: Use the command palette (`Ctrl+P`) and search for \"Flowti\" to see all available commands.",
		].join("\n");
	}

	if (seedPath === "03 - Resources/Sample Data/supplier-overview.csv") {
		return [
			"Month,Supplier,SKU,Category,Unit Price,Quantity,Total,Lead Time Days,Quality Score,On Time Delivery",
			"2025-09,Acme Components,AC-1001,Fasteners,2.45,1200,2940.00,12,96.2,98.1",
			"2025-09,Nordic Electronics,NE-2001,Sensors,15.30,420,6426.00,10,98.5,99.2",
			"2025-09,Pacific Materials,PM-3001,Raw Aluminum,3.20,2800,8960.00,7,95.0,99.5",
			"2025-10,Acme Components,AC-1001,Fasteners,2.45,1350,3307.50,11,96.5,98.4",
			"2025-10,Nordic Electronics,NE-2001,Sensors,15.30,450,6885.00,10,98.8,99.0",
			"2025-10,Pacific Materials,PM-3001,Raw Aluminum,3.25,2600,8450.00,8,95.2,99.0",
			"2025-11,Acme Components,AC-1001,Fasteners,2.50,1100,2750.00,13,95.8,97.5",
			"2025-11,Nordic Electronics,NE-2001,Sensors,15.50,400,6200.00,11,98.2,98.8",
			"2025-11,Pacific Materials,PM-3001,Raw Aluminum,3.30,2900,9570.00,7,95.5,99.3",
			"2025-12,Acme Components,AC-1001,Fasteners,2.50,950,2375.00,14,96.0,97.8",
			"2025-12,Nordic Electronics,NE-2001,Sensors,15.50,380,5890.00,12,98.0,98.5",
			"2025-12,Pacific Materials,PM-3001,Raw Aluminum,3.35,2500,8375.00,8,94.8,99.1",
			"2026-01,Acme Components,AC-1001,Fasteners,2.55,1250,3187.50,12,96.8,98.5",
			"2026-01,Nordic Electronics,NE-2001,Sensors,15.80,440,6952.00,10,98.9,99.3",
			"2026-01,Pacific Materials,PM-3001,Raw Aluminum,3.40,2700,9180.00,7,95.8,99.5",
			"2026-02,Acme Components,AC-1001,Fasteners,2.55,1300,3315.00,11,97.0,98.8",
			"2026-02,Nordic Electronics,NE-2001,Sensors,16.00,460,7360.00,9,99.1,99.5",
			"2026-02,Pacific Materials,PM-3001,Raw Aluminum,3.45,2850,9832.50,6,96.0,99.8",
		].join("\n");
	}

	return null;
}
