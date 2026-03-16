/**
 * test-vault.ts — Test vault lifecycle management.
 *
 * Creates isolated vault structures for integration testing.
 * Test vaults live as siblings to the main vault root, never
 * inside the CLI source tree.
 *
 * Usage:
 *   const root = resolveTestVaultRoot("my-test", VAULT_ROOT);
 *   scaffoldTestVault(root, { name: "my-test" }, disk);
 *   // ... run tests ...
 *   teardownTestVault(root, disk);
 */

import { paths } from "./paths.js";
import type { IFileSystem, FlowtiCliConfig } from "./types.js";

export interface TestVaultOptions {
	/** Display name / directory name for the test vault. */
	name: string;
	/** Override the projects folder name (default: "01 - Projects"). */
	projectsFolder?: string;
	/** Extra CLI config fields to merge into the generated config. */
	config?: Partial<FlowtiCliConfig>;
	/** Source .flowti/bin/ directory to copy the CLI build from. */
	sourceBinDir?: string;
}

export interface TestVaultLayout {
	root: string;
	configPath: string;
	statePath: string;
	stateDir: string;
	binDir: string;
	projectsDir: string;
}

/**
 * Derive the test vault root path (sibling to the main vault).
 * e.g. vaultRoot = "/vaults/main" → "/vaults/my-test"
 */
export function resolveTestVaultRoot(name: string, vaultRoot: string): string {
	return paths.resolve(vaultRoot, "..", name);
}

/**
 * Compute the standard layout paths for a test vault.
 * Pure function — no I/O.
 */
export function resolveTestVaultLayout(root: string, projectsFolder: string = "01 - Projects"): TestVaultLayout {
	return {
		root,
		configPath: paths.join(root, ".flowti", "config.json"),
		stateDir: paths.join(root, ".flowti", "var"),
		statePath: paths.join(root, ".flowti", "var", "state.json"),
		binDir: paths.join(root, ".flowti", "bin"),
		projectsDir: paths.join(root, projectsFolder),
	};
}

/**
 * Build the CLI config JSON for a test vault.
 * Pure function — no I/O.
 */
export function buildTestVaultConfig(opts: TestVaultOptions): FlowtiCliConfig {
	return {
		version: "1.0.0",
		projectsFolder: opts.projectsFolder ?? "01 - Projects",
		...opts.config,
	};
}

/**
 * Scaffold a minimal vault directory structure at the given path.
 * Creates: .flowti/config.json, .flowti/var/, .flowti/bin/, projects folder.
 */
export function scaffoldTestVault(root: string, opts: TestVaultOptions, fs: IFileSystem): TestVaultLayout {
	const projectsFolder = opts.projectsFolder ?? "01 - Projects";
	const layout = resolveTestVaultLayout(root, projectsFolder);

	fs.mkdirSync(paths.join(root, ".flowti"), { recursive: true });
	fs.mkdirSync(layout.stateDir, { recursive: true });
	fs.mkdirSync(layout.binDir, { recursive: true });
	fs.mkdirSync(layout.projectsDir, { recursive: true });

	const config = buildTestVaultConfig(opts);
	fs.writeFileSync(layout.configPath, JSON.stringify(config, null, "\t"), "utf-8");

	// Copy CLI build into the test vault so `node .flowti/bin` works
	if (opts.sourceBinDir) {
		const binFiles = ["main.mjs", "main.mjs.map", "index.mjs"];
		for (const file of binFiles) {
			const src = paths.join(opts.sourceBinDir, file);
			if (fs.existsSync(src)) {
				fs.copyFileSync(src, paths.join(layout.binDir, file));
			}
		}
		fs.writeFileSync(
			paths.join(layout.binDir, "package.json"),
			'{ "type": "module" }\n',
			"utf-8",
		);
	}

	return layout;
}

/**
 * Remove a test vault directory tree.
 */
export function teardownTestVault(root: string, fs: IFileSystem): void {
	fs.rmSync(root, { recursive: true, force: true });
}
