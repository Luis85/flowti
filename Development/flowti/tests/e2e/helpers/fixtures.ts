/**
 * Vault fixture helpers for E2E tests.
 *
 * Creates and tears down test files in the test vault using ObsidianCli.
 * Each test run gets a unique timestamp-prefixed folder under
 * Test Data/ to keep the vault root clean.
 *
 * The test vault is scaffolded and validated by globalSetup.ts before
 * any test file runs.
 *
 * IMPORTANT: Requires Obsidian to be running with the test vault open.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";
import { TestVault } from "./testVault";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..", "..");

const TEST_DATA_ROOT = "Test Data";
export const PLUGIN_ID = "flowti-ibde";

/** Time to wait after enablePlugin for the plugin to initialize. */
const PLUGIN_INIT_MS = 3000;
/** Max attempts to enable and verify the plugin is loaded. */
const ENABLE_RETRIES = 5;
/** Delay between enable retries (ms). */
const ENABLE_RETRY_DELAY = 2000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TestFixture {
	cli: ObsidianCli;
	vault: TestVault;
	/** Unique folder prefix for this test run */
	prefix: string;
	/** Creates a test file under the fixture prefix folder. Returns the full path. */
	createFile(name: string, content: string): string;
	/** Deletes all files created under the fixture prefix folder. */
	cleanup(): void;
}

export function createFixture(vaultName?: string): TestFixture {
	const vault = new TestVault(PLUGIN_ROOT);

	// Use the test vault name unless explicitly overridden
	const targetVault = vaultName ?? vault.vaultName;
	const cli = new ObsidianCli({ vaultName: targetVault, timeout: 15_000 });
	const prefix = `${TEST_DATA_ROOT}/e2e-${Date.now()}`;
	const created: string[] = [];

	return {
		cli,
		vault,
		prefix,
		createFile(name: string, content: string): string {
			const filePath = `${prefix}/${name}`;
			cli.createFile(filePath, content);
			created.push(filePath);
			return filePath;
		},
		cleanup(): void {
			for (const filePath of created) {
				try {
					cli.deleteFile(filePath);
				} catch {
					// Ignore cleanup errors — file may already be deleted
				}
			}
		},
	};
}

/**
 * Registers a wildcard listener on the plugin's EventBus that collects
 * every emitted event (except log.* and perf.*) into an in-memory array
 * on the plugin instance (`_e2eEventTrace`).
 *
 * Call once after `ensurePluginEnabled`. The trace is read back in
 * globalTeardown and written as event-trace.md.
 *
 * Safe to call multiple times — skips if the trace is already running.
 */
export function startEventTrace(cli: ObsidianCli): void {
	cli.eval([
		`const p = app.plugins.plugins['${PLUGIN_ID}'];`,
		"if (p && p.eventBus && !p._e2eEventTrace) {",
		"  p._e2eEventTrace = [];",
		"  p._e2ePerfTrace = [];",
		"  p._e2eTraceUnsub = p.eventBus.on('*', (event) => {",
		"    if (event.type.startsWith('log.')) return;",
		"    if (event.type.startsWith('perf.')) {",
		"      p._e2ePerfTrace.push({",
		"        type: event.type,",
		"        ts: Date.now(),",
		"        payload: JSON.stringify(event.payload ?? {}).substring(0, 500)",
		"      });",
		"      return;",
		"    }",
		"    p._e2eEventTrace.push({",
		"      type: event.type,",
		"      ts: Date.now(),",
		"      payload: JSON.stringify(event.payload ?? {}).substring(0, 200)",
		"    });",
		"  });",
		"}",
	].join(" "));
}

export async function ensurePluginEnabled(cli: ObsidianCli): Promise<void> {
	for (let attempt = 1; attempt <= ENABLE_RETRIES; attempt++) {
		cli.enablePlugin(PLUGIN_ID);
		await sleep(PLUGIN_INIT_MS);

		// Verify the plugin is actually loaded
		const result = cli.eval(`!!app.plugins.plugins['${PLUGIN_ID}']`);
		if (result.success && result.value === "true") {
			return;
		}

		if (attempt < ENABLE_RETRIES) {
			console.log(`[e2e] Plugin not ready after attempt ${attempt}, retrying...`);
			await sleep(ENABLE_RETRY_DELAY);
		}
	}

	throw new Error(
		`Failed to enable plugin "${PLUGIN_ID}" after ${ENABLE_RETRIES} attempts. ` +
		"Ensure Obsidian is running with the test vault open.",
	);
}

/**
 * Verifies that Chapter 1 (Prerequisites) passed by reading a flag
 * stored on `window` (survives plugin reloads, unlike plugin instance flags).
 *
 * Throws in `beforeAll`, causing all tests in the calling file to
 * **fail** instead of running against an unverified environment.
 */
export function ensurePrerequisitesPassed(cli: ObsidianCli): void {
	const check = cli.eval("String(window._e2ePrerequisitesPassed)");
	if (!check.success || check.value !== "true") {
		throw new Error(
			"Chapter 1 (Prerequisites) did not pass. " +
			"Fix the prerequisite tests before running subsequent chapters.",
		);
	}
}

/**
 * Verifies that Chapter 2 (Installer) completed successfully by
 * reading the `_e2eInstallerDone` flag stored on `window`.
 *
 * Uses `window` rather than the plugin instance so the flag survives
 * plugin reloads that happen between test phases.
 *
 * Call in beforeAll of every test file that depends on a fully installed
 * vault (i.e. everything after Chapter 2).
 */
export function ensureInstalled(cli: ObsidianCli): void {
	const check = cli.eval("String(window._e2eInstallerDone)");
	if (!check.success || check.value !== "true") {
		throw new Error(
			"Chapter 2 (Installer) did not complete successfully. " +
			"Fix the installer tests before running subsequent chapters.",
		);
	}
}

// ── Vault operations (cache-safe) ────────────────────────────
//
// Direct filesystem operations bypass Obsidian's file index, causing
// ghost entries and stale cache. These helpers use the vault API (via
// cli.eval) so Obsidian's internal state stays consistent.

/** Seed file paths created by the installer's SeedContentStep. */
export const INSTALLER_SEED_FILES = [
	"00 - Connectivity/inbox/Welcome to Flowti.md",
	"03 - Resources/Sample Data/supplier-overview.csv",
];

/**
 * Deletes a vault file through Obsidian's vault API (cache-safe).
 * Works for all file types (md, csv, etc.) unlike the CLI delete command.
 * No-op if the file doesn't exist in Obsidian's index.
 */
export function vaultDelete(cli: ObsidianCli, vaultPath: string): void {
	cli.eval([
		"(async () => {",
		`  const f = app.vault.getAbstractFileByPath('${vaultPath}');`,
		"  if (f) await app.vault.delete(f, true);",
		"})()",
	].join(" "));
}

/**
 * Checks whether the installer has already run (from a previous E2E session)
 * by looking for seed files on disk AND checking data.json installer state.
 *
 * Returns true if the vault is already set up and the installer can be skipped.
 */
export function isVaultInstalled(vaultDir: string): boolean {
	// Check seed files exist on disk
	for (const relPath of INSTALLER_SEED_FILES) {
		const fullPath = path.join(vaultDir, relPath);
		if (!fs.existsSync(fullPath)) {
			console.log(`[e2e:isVaultInstalled] seed missing: ${fullPath}`);
			return false;
		}
	}

	// Check data.json installer state.
	// TypedStorage key is "installer" (see registry.ts createTypedStorage call),
	// NOT "installerService" (which is the ServiceContainer key).
	const dataJsonPath = path.join(
		vaultDir, ".obsidian", "plugins", PLUGIN_ID, "data.json",
	);
	if (!fs.existsSync(dataJsonPath)) {
		console.log("[e2e:isVaultInstalled] data.json missing");
		return false;
	}

	try {
		const data = JSON.parse(fs.readFileSync(dataJsonPath, "utf-8"));
		const installed = data.installer?.installed === true;
		console.log(`[e2e:isVaultInstalled] installer.installed = ${data.installer?.installed}, result = ${installed}`);
		return installed;
	} catch {
		return false;
	}
}

/**
 * Whether the installer test should run this session.
 * Default: skip if vault is already installed (faster iteration).
 * Set `E2E_RUN_INSTALLER=true` to force the installer test.
 */
export function shouldRunInstaller(vaultDir: string): boolean {
	if (process.env.E2E_RUN_INSTALLER === "true") return true;
	return !isVaultInstalled(vaultDir);
}

// ── EventBus trace helpers ──────────────────────────────────

export interface TraceEntry {
	type: string;
	ts: number;
	payload: string;
}

/**
 * Returns the current length of the E2E event trace.
 * Use as a bookmark — pass to getEventsSince / assertEventEmitted
 * to check only events that occurred after this point.
 */
export function getTraceLength(cli: ObsidianCli): number {
	const result = cli.eval(
		`(app.plugins.plugins['${PLUGIN_ID}']?._e2eEventTrace ?? []).length`,
	);
	return result.success ? Number(result.value) : 0;
}

/**
 * Reads events from the E2E trace since the given index, optionally
 * filtered by event type.
 */
export function getEventsSince(
	cli: ObsidianCli,
	sinceIndex: number,
	eventType?: string,
): TraceEntry[] {
	const filter = eventType
		? `.filter(e => e.type === '${eventType}')`
		: "";
	const result = cli.eval(
		`JSON.stringify((app.plugins.plugins['${PLUGIN_ID}']?._e2eEventTrace ?? []).slice(${sinceIndex})${filter})`,
	);
	if (!result.success) return [];
	try {
		return JSON.parse(result.value) as TraceEntry[];
	} catch {
		return [];
	}
}

/**
 * Asserts that an event of the given type was emitted since the given
 * trace index. Optionally checks that the payload contains specific fields.
 * Throws if no matching event is found.
 */
export function assertEventEmitted(
	cli: ObsidianCli,
	sinceIndex: number,
	eventType: string,
	payloadMatch?: Record<string, unknown>,
): void {
	const events = getEventsSince(cli, sinceIndex, eventType);
	if (events.length === 0) {
		const total = getTraceLength(cli);
		throw new Error(
			`Expected event "${eventType}" was not emitted ` +
			`(checked ${total - sinceIndex} events since index ${sinceIndex})`,
		);
	}
	if (payloadMatch) {
		const matching = events.find((e) => {
			try {
				const payload = JSON.parse(e.payload) as Record<string, unknown>;
				return Object.entries(payloadMatch).every(
					([k, v]) => payload[k] === v,
				);
			} catch {
				return false;
			}
		});
		if (!matching) {
			throw new Error(
				`Event "${eventType}" was emitted but no match for payload: ${JSON.stringify(payloadMatch)}. ` +
				`Found: ${events.map((e) => e.payload).join(", ")}`,
			);
		}
	}
}
