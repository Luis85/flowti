/**
 * TestVault — scaffolds an isolated Obsidian vault for E2E testing.
 *
 * Creates a vault directory and copies the plugin build artifacts
 * (main.js, manifest.json, styles.css) into the plugins folder.
 * Obsidian owns `.obsidian/` — the scaffold only places plugin files.
 *
 * One-time setup: open the vault folder in Obsidian to register it.
 * No configuration needed — tests run against a clean baseline vault.
 *
 * Default location: sibling to the main vault — `<projects-root>/flowti-e2e`
 * (e.g. `c:\Projects\flowti-e2e` alongside `c:\Projects\flowti`).
 * Override: set `E2E_VAULT_DIR` environment variable.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const PLUGIN_ID = "flowti-ibde";

/** Files to copy from the dev vault plugin directory into the test vault. */
const PLUGIN_ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

export interface TestVaultOptions {
	/** Absolute path to the test vault directory. */
	vaultDir?: string;
	/** Absolute path to the plugin build output (contains main.js etc.). */
	pluginBuildDir?: string;
}

export class TestVault {
	readonly vaultDir: string;
	readonly vaultName: string;
	private readonly pluginBuildDir: string;

	constructor(pluginRoot: string, options: TestVaultOptions = {}) {
		// Place the test vault as a sibling to the main vault under the projects root.
		// pluginRoot  = c:\Projects\flowti\Development\flowti
		// vault root  = c:\Projects\flowti          (two levels up)
		// projects    = c:\Projects                  (three levels up)
		// test vault  = c:\Projects\flowti-e2e
		const projectsRoot = path.resolve(pluginRoot, "..", "..", "..");

		this.vaultDir =
			options.vaultDir ??
			process.env.E2E_VAULT_DIR ??
			path.join(projectsRoot, "flowti-e2e");

		this.vaultName = path.basename(this.vaultDir);

		// Dev vault plugin build output
		// c:\Projects\flowti\.obsidian\plugins\flowti-ibde
		this.pluginBuildDir =
			options.pluginBuildDir ??
			path.resolve(pluginRoot, "..", "..", ".obsidian", "plugins", PLUGIN_ID);
	}

	/**
	 * Returns true if the vault directory already existed before scaffolding.
	 * A vault that exists on disk but hasn't been opened in Obsidian yet
	 * needs one-time manual registration.
	 */
	exists(): boolean {
		return fs.existsSync(this.vaultDir);
	}

	/**
	 * Creates the test vault directory structure and copies plugin artifacts.
	 * Safe to call multiple times — updates artifacts on every call.
	 */
	scaffold(): void {
		const pluginDir = path.join(this.vaultDir, ".obsidian", "plugins", PLUGIN_ID);

		fs.mkdirSync(pluginDir, { recursive: true });

		// Only place plugin files — Obsidian manages everything else
		// in .obsidian/ (app.json, community-plugins.json, workspace.json, etc.).
		for (const file of PLUGIN_ARTIFACTS) {
			const src = path.join(this.pluginBuildDir, file);
			const dest = path.join(pluginDir, file);

			if (!fs.existsSync(src)) {
				throw new Error(
					`Plugin artifact missing: ${src}\nRun 'npm run build' first.`,
				);
			}

			fs.copyFileSync(src, dest);
		}
	}

	/**
	 * Removes all vault content except the `.obsidian/` directory,
	 * giving a clean slate for the next test run.
	 */
	reset(): void {
		if (!fs.existsSync(this.vaultDir)) return;

		const entries = fs.readdirSync(this.vaultDir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === ".obsidian") continue;

			const fullPath = path.join(this.vaultDir, entry.name);
			fs.rmSync(fullPath, { recursive: true, force: true });
		}

		// Clear workspace layout so Obsidian starts fresh
		const workspacePath = path.join(this.vaultDir, ".obsidian", "workspace.json");
		if (fs.existsSync(workspacePath)) {
			fs.rmSync(workspacePath, { force: true });
		}
	}

	/** Removes the entire test vault directory. */
	destroy(): void {
		if (fs.existsSync(this.vaultDir)) {
			fs.rmSync(this.vaultDir, { recursive: true, force: true });
		}
	}

	/** Returns true if the vault directory and plugin files exist. */
	isScaffolded(): boolean {
		const pluginDir = path.join(
			this.vaultDir,
			".obsidian",
			"plugins",
			PLUGIN_ID,
		);

		return PLUGIN_ARTIFACTS.every((file) =>
			fs.existsSync(path.join(pluginDir, file)),
		);
	}
}
