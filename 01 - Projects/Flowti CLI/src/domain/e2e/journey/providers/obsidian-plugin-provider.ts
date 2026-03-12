/**
 * obsidian-plugin-provider.ts — Environment provider for Obsidian plugin projects.
 *
 * Extends the vault provider with plugin lifecycle tools: build, deploy,
 * Obsidian CLI interaction, and plugin state management.
 */

import type { EnvironmentProvider } from "../journey-environment.js";
import type { JourneyExecutorOptions } from "../journey-types.js";
import type { ToolDeps } from "../journey-executor.js";
import type { ToolExecutor } from "../journey-tools.js";
import { resolveString } from "../journey-tools.js";

/**
 * Tool: obsidian-cli — execute an Obsidian CLI command.
 * Action: { tool: "obsidian-cli", command: "reload flowti-ibde" }
 * Action: { tool: "obsidian-cli", command: "eval document.title", storeAs: "title" }
 *
 * Requires Obsidian 1.12+ with CLI enabled.
 */
const toolObsidianCli: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const command = resolveString(action, "command", opts.variables ?? {});
	if (!command) return { tool: "obsidian-cli", success: false, error: "No command specified", durationMs: deps.clock.ms() - start };

	try {
		const obsidianCmd = `obsidian-cli ${command}`;
		const result = deps.exec(obsidianCmd, {
			cwd: opts.cwd,
			timeout: opts.commandTimeout ?? 15000,
			env: opts.env,
		});
		const storeAs = action.storeAs as string;
		if (storeAs && opts.variables) opts.variables[storeAs] = result.stdout.trim();
		return {
			tool: "obsidian-cli",
			success: result.exitCode === 0,
			output: result.stdout.slice(0, 300),
			error: result.exitCode !== 0 ? `Obsidian CLI failed: ${result.stderr}` : undefined,
			durationMs: deps.clock.ms() - start,
		};
	} catch (e) {
		return { tool: "obsidian-cli", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

/**
 * Tool: plugin-deploy — build and deploy plugin artifacts to a vault.
 * Action: { tool: "plugin-deploy", buildCommand?: "npm run build", pluginDir: "/vault/.obsidian/plugins/my-plugin", artifacts: ["main.js", "manifest.json"] }
 */
function runBuild(cmd: string, deps: ToolDeps, opts: JourneyExecutorOptions): { success: boolean; error?: string } {
	try {
		const r = deps.exec(cmd, { cwd: opts.cwd, timeout: 120000, env: opts.env });
		if (r.exitCode !== 0) return { success: false, error: `Build failed (exit ${r.exitCode}): ${r.stderr}` };
		return { success: true };
	} catch (e) {
		return { success: false, error: `Build error: ${e}` };
	}
}

function deployArtifacts(artifacts: string[], projectRoot: string, pluginDir: string, deps: ToolDeps): number {
	deps.mkdir(pluginDir);
	let copied = 0;
	for (const artifact of artifacts) {
		const src = `${projectRoot}/${artifact}`;
		if (deps.exists(src)) {
			try {
				deps.writeFile(`${pluginDir}/${artifact}`, deps.readFile(src));
				copied++;
			} catch { /* skip unreadable */ }
		}
	}
	return copied;
}

const toolPluginDeploy: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const variables = opts.variables ?? {};
	const buildCmd = resolveString(action, "buildCommand", variables) || "npm run build";
	const pluginDir = resolveString(action, "pluginDir", variables);
	const artifacts = action.artifacts as string[] ?? ["main.js", "manifest.json", "styles.css"];

	if (!pluginDir) return { tool: "plugin-deploy", success: false, error: "No pluginDir specified", durationMs: deps.clock.ms() - start };

	const buildResult = runBuild(buildCmd, deps, opts);
	if (!buildResult.success) return { tool: "plugin-deploy", success: false, error: buildResult.error!, durationMs: deps.clock.ms() - start };

	const copied = deployArtifacts(artifacts, opts.cwd ?? ".", pluginDir, deps);
	return {
		tool: "plugin-deploy",
		success: true,
		output: `Built and deployed ${copied}/${artifacts.length} artifacts to ${pluginDir}`,
		durationMs: deps.clock.ms() - start,
	};
};

/**
 * Tool: plugin-state — read or write plugin data.json.
 * Action: { tool: "plugin-state", op: "read", dataJsonPath: "/path/data.json", storeAs: "state" }
 * Action: { tool: "plugin-state", op: "set", dataJsonPath: "/path/data.json", field: "key", value: "val" }
 */
const toolPluginState: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const op = action.op as string;
	const variables = opts.variables ?? {};
	const dataPath = resolveString(action, "dataJsonPath", variables);
	if (!dataPath) return { tool: "plugin-state", success: false, error: "No dataJsonPath specified", durationMs: deps.clock.ms() - start };

	try {
		switch (op) {
			case "read": {
				const content = deps.readFile(dataPath);
				const storeAs = action.storeAs as string;
				if (storeAs && opts.variables) opts.variables[storeAs] = content;
				return { tool: "plugin-state", success: true, output: content.slice(0, 300), durationMs: deps.clock.ms() - start };
			}
			case "set": {
				const field = resolveString(action, "field", variables);
				const value = resolveString(action, "value", variables);
				let data: Record<string, unknown> = {};
				try { data = JSON.parse(deps.readFile(dataPath)); } catch { /* empty */ }
				data[field] = value;
				deps.writeFile(dataPath, JSON.stringify(data, null, "\t"));
				return { tool: "plugin-state", success: true, output: `${field}=${value}`, durationMs: deps.clock.ms() - start };
			}
			default:
				return { tool: "plugin-state", success: false, error: `Unknown plugin-state op: ${op}`, durationMs: deps.clock.ms() - start };
		}
	} catch (e) {
		return { tool: "plugin-state", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};

export function createObsidianPluginProvider(): EnvironmentProvider {
	return {
		target: "obsidian-plugin",
		label: "Obsidian Plugin",
		capabilities: [
			"command", "filesystem", "frontmatter",
			"vault-note", "vault-structure",
			"obsidian-cli", "plugin-deploy", "plugin-state",
		],
		tools: {
			"obsidian-cli": toolObsidianCli,
			"plugin-deploy": toolPluginDeploy,
			"plugin-state": toolPluginState,
		},
		setup(deps, opts) {
			const vaultRoot = opts.cwd ?? ".";
			const obsidianDir = `${vaultRoot}/.obsidian`;
			if (!deps.exists(obsidianDir)) {
				deps.mkdir(obsidianDir);
				deps.log(`[plugin] Created .obsidian directory at ${obsidianDir}`);
			}
		},
	};
}
