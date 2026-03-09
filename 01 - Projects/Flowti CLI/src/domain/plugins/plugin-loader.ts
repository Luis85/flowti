/**
 * plugin-loader.ts — Plugin discovery, validation, and loading.
 *
 * Plugins live at .flowti/plugins/<name>/manifest.json (vault level).
 * Pure functions where possible. I/O is injected via IFileSystem / IShell.
 */

import type { IFileSystem, IShell } from "../../infrastructure/types.js";
import { paths } from "../../infrastructure/paths.js";
import type {
	PluginManifest,
	PluginCommandDef,
	PluginValidationResult,
	LoadedPlugin,
} from "./plugin-types.js";
import type { CommandHandler } from "../../infrastructure/types.js";

// ── Constants ────────────────────────────────────────────────────────

export const PLUGINS_DIR = ".flowti/plugins";
export const MANIFEST_FILENAME = "manifest.json";

/** Reserved command name pattern (must not start with these prefixes). */
const RESERVED_PREFIXES = ["plugin:list", "plugin:validate"];

// ── Pure helpers ─────────────────────────────────────────────────────

/** Build a namespaced command key: plugin:<pluginName>:<commandName> */
export function namespacedCommandKey(pluginName: string, commandName: string): string {
	return `plugin:${pluginName}:${commandName}`;
}

function validateManifestMeta(obj: Record<string, unknown>, errors: string[], warnings: string[]): void {
	if (typeof obj.name !== "string" || obj.name.trim() === "") {
		errors.push('Missing or empty "name" field');
	} else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(obj.name)) {
		errors.push('"name" must be lowercase alphanumeric with hyphens (e.g. "my-plugin")');
	}
	if (typeof obj.description !== "string" || obj.description.trim() === "") {
		errors.push('Missing or empty "description" field');
	}
	if (obj.version !== undefined && typeof obj.version !== "string") {
		warnings.push('"version" should be a string');
	}
}

function validateSingleCommand(key: string, def: unknown, errors: string[]): void {
	if (def === null || typeof def !== "object" || Array.isArray(def)) {
		errors.push(`Command "${key}" must be an object`);
		return;
	}
	const cmdDef = def as Record<string, unknown>;
	if (typeof cmdDef.description !== "string" || cmdDef.description.trim() === "") {
		errors.push(`Command "${key}" missing "description"`);
	}
	if (typeof cmdDef.run !== "string" || cmdDef.run.trim() === "") {
		errors.push(`Command "${key}" missing "run" command`);
	}
}

function validateManifestCommands(obj: Record<string, unknown>, errors: string[], warnings: string[]): void {
	if (obj.commands === null || typeof obj.commands !== "object" || Array.isArray(obj.commands)) {
		errors.push('"commands" must be an object');
		return;
	}
	const cmds = obj.commands as Record<string, unknown>;
	if (Object.keys(cmds).length === 0) {
		warnings.push("Plugin defines no commands");
	}
	for (const [key, def] of Object.entries(cmds)) {
		validateSingleCommand(key, def, errors);
	}
}

/** Validate a raw JSON value as a PluginManifest. */
export function validateManifest(raw: unknown): PluginValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return { valid: false, errors: ["Manifest must be a JSON object"], warnings };
	}

	const obj = raw as Record<string, unknown>;
	validateManifestMeta(obj, errors, warnings);
	validateManifestCommands(obj, errors, warnings);

	return { valid: errors.length === 0, errors, warnings };
}

// ── I/O functions ────────────────────────────────────────────────────

/**
 * Discover plugin subdirectories containing manifest.json.
 * Scans .flowti/plugins/ for subdirectories with a manifest.json file.
 */
export function discoverPluginFiles(pluginsDir: string, fs: IFileSystem): string[] {
	if (!fs.existsSync(pluginsDir)) return [];

	const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
	const manifests: string[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const manifestPath = paths.join(pluginsDir, entry.name, MANIFEST_FILENAME);
		if (fs.existsSync(manifestPath)) {
			manifests.push(manifestPath);
		}
	}

	return manifests;
}

/** Load and validate a single plugin manifest. Returns a LoadedPlugin (possibly invalid). */
export function loadPluginFile(
	pluginPath: string,
	fs: IFileSystem,
	shellRunner: IShell,
	projectPath: string,
): LoadedPlugin {
	try {
		const raw = JSON.parse(fs.readFileSync(pluginPath, "utf-8")) as unknown;
		const validation = validateManifest(raw);
		const pluginDir = paths.dirname(pluginPath);
		const dirName = paths.basename(pluginDir);

		if (!validation.valid) {
			return {
				manifest: { name: dirName, description: "", commands: {} },
				path: pluginPath,
				commands: {},
				valid: false,
				errors: validation.errors,
			};
		}

		const manifest = raw as PluginManifest;
		const commands = buildCommandHandlers(manifest, shellRunner, projectPath);

		return { manifest, path: pluginPath, commands, valid: true, errors: [] };
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		const pluginDir = paths.dirname(pluginPath);
		const dirName = paths.basename(pluginDir);
		return {
			manifest: { name: dirName, description: "", commands: {} },
			path: pluginPath,
			commands: {},
			valid: false,
			errors: [`Failed to parse: ${message}`],
		};
	}
}

/** Load all plugins from the vault-level plugins directory. */
export function loadPlugins(
	vaultRoot: string,
	fs: IFileSystem,
	shellRunner: IShell,
): LoadedPlugin[] {
	const pluginsDir = paths.join(vaultRoot, PLUGINS_DIR);
	const files = discoverPluginFiles(pluginsDir, fs);
	return files.map((f) => loadPluginFile(f, fs, shellRunner, vaultRoot));
}

// ── Scaffolding ──────────────────────────────────────────────────────

/** Scaffold a new plugin directory with a starter manifest.json. */
export function scaffoldPlugin(
	vaultRoot: string,
	pluginName: string,
	description: string,
	fs: IFileSystem,
): { path: string } | { error: string } {
	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(pluginName)) {
		return { error: "Plugin name must be lowercase alphanumeric with hyphens (e.g. \"my-plugin\")" };
	}

	const pluginDir = paths.join(vaultRoot, PLUGINS_DIR, pluginName);
	if (fs.existsSync(pluginDir)) {
		return { error: `Plugin "${pluginName}" already exists` };
	}

	const manifest: PluginManifest = {
		name: pluginName,
		description,
		version: "1.0.0",
		commands: {
			hello: {
				description: "Example command",
				run: "echo Hello from " + pluginName,
			},
		},
	};

	fs.mkdirSync(pluginDir, { recursive: true });
	fs.writeFileSync(
		paths.join(pluginDir, MANIFEST_FILENAME),
		JSON.stringify(manifest, null, 2),
		"utf-8",
	);

	return { path: pluginDir };
}

// ── Command wrapping ─────────────────────────────────────────────────

/** Wrap a plugin's shell commands as CommandHandler functions. */
function buildCommandHandlers(
	manifest: PluginManifest,
	shellRunner: IShell,
	projectPath: string,
): Record<string, CommandHandler> {
	const handlers: Record<string, CommandHandler> = {};

	for (const [cmdName, cmdDef] of Object.entries(manifest.commands)) {
		const key = namespacedCommandKey(manifest.name, cmdName);
		const def: PluginCommandDef = cmdDef;

		handlers[key] = () => {
			const exitCode = shellRunner.run(def.run, {
				cwd: projectPath,
				label: `[${manifest.name}] ${def.description}`,
			});
			if (exitCode !== 0) {
				process.exitCode = exitCode;
			}
		};
	}

	return handlers;
}

/** Check that no plugin command collides with built-in commands. */
export function detectCollisions(
	plugins: LoadedPlugin[],
	builtinKeys: Set<string>,
): string[] {
	const collisions: string[] = [];
	const seen = new Set<string>();

	for (const plugin of plugins) {
		if (!plugin.valid) continue;
		for (const key of Object.keys(plugin.commands)) {
			if (builtinKeys.has(key)) {
				collisions.push(`Plugin "${plugin.manifest.name}": command "${key}" collides with a built-in command`);
			}
			if (RESERVED_PREFIXES.includes(key)) {
				collisions.push(`Plugin "${plugin.manifest.name}": command "${key}" uses a reserved name`);
			}
			if (seen.has(key)) {
				collisions.push(`Duplicate plugin command: "${key}"`);
			}
			seen.add(key);
		}
	}

	return collisions;
}
