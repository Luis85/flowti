/**
 * plugin-hooks.ts — Plugin lifecycle hook execution.
 *
 * Hooks are optional shell commands in a plugin manifest that run
 * at specific lifecycle points (install, enable, before/after command).
 * All hook execution is synchronous and tolerant of failures.
 */

import type { IShell } from "../../infrastructure/types.js";

// ── Types ────────────────────────────────────────────────────────────

export type HookName = "onInstall" | "onEnable" | "onDisable" | "onBeforeCommand" | "onAfterCommand";

export interface PluginHooks {
	onInstall?: string;
	onEnable?: string;
	onDisable?: string;
	onBeforeCommand?: string;
	onAfterCommand?: string;
}

export interface HookResult {
	hook: HookName;
	exitCode: number;
	success: boolean;
}

// ── Validation ───────────────────────────────────────────────────────

const VALID_HOOK_NAMES: readonly HookName[] = ["onInstall", "onEnable", "onDisable", "onBeforeCommand", "onAfterCommand"];

/** Validate the hooks section of a manifest. Returns error strings. */
export function validateHooks(hooks: unknown): string[] {
	if (hooks === undefined || hooks === null) return [];
	if (typeof hooks !== "object" || Array.isArray(hooks)) {
		return ['"hooks" must be an object'];
	}

	const errors: string[] = [];
	const obj = hooks as Record<string, unknown>;

	for (const [key, value] of Object.entries(obj)) {
		if (!VALID_HOOK_NAMES.includes(key as HookName)) {
			errors.push(`Unknown hook "${key}". Valid hooks: ${VALID_HOOK_NAMES.join(", ")}`);
		}
		if (typeof value !== "string" || value.trim() === "") {
			errors.push(`Hook "${key}" must be a non-empty string (shell command)`);
		}
	}

	return errors;
}

/** Extract hooks from a raw manifest object (safe for invalid manifests). */
export function extractHooks(manifest: Record<string, unknown>): PluginHooks {
	const hooks = manifest.hooks;
	if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return {};

	const result: PluginHooks = {};
	const obj = hooks as Record<string, unknown>;

	for (const name of VALID_HOOK_NAMES) {
		if (typeof obj[name] === "string" && obj[name].trim() !== "") {
			result[name] = obj[name] as string;
		}
	}

	return result;
}

// ── Execution ────────────────────────────────────────────────────────

/** Run a single lifecycle hook. Returns result or null if hook is not defined. */
export function runHook(
	hooks: PluginHooks,
	hookName: HookName,
	shellRunner: IShell,
	cwd: string,
	env?: Record<string, string>,
): HookResult | null {
	const cmd = hooks[hookName];
	if (!cmd) return null;

	const envPrefix = env
		? Object.entries(env).map(([k, v]) => `${k}=${v}`).join(" ") + " "
		: "";
	const fullCmd = envPrefix ? `${envPrefix}${cmd}` : cmd;

	const exitCode = shellRunner.run(fullCmd, {
		cwd,
		label: `[hook:${hookName}]`,
	});

	return {
		hook: hookName,
		exitCode,
		success: exitCode === 0,
	};
}

/** Run a hook silently (no output). Returns true if hook succeeded or was not defined. */
export function runHookSilent(
	hooks: PluginHooks,
	hookName: HookName,
	shellRunner: IShell,
	cwd: string,
): boolean {
	const cmd = hooks[hookName];
	if (!cmd) return true;

	const output = shellRunner.runSilent(cmd, { cwd });
	return output !== null;
}

/**
 * Build a command wrapper that runs onBeforeCommand / onAfterCommand hooks
 * around the original command execution.
 */
export function wrapWithHooks(
	hooks: PluginHooks,
	shellRunner: IShell,
	cwd: string,
	originalRun: () => number,
): () => number {
	return () => {
		// Before hook — abort command if it fails
		if (hooks.onBeforeCommand) {
			const beforeResult = runHook(hooks, "onBeforeCommand", shellRunner, cwd);
			if (beforeResult && !beforeResult.success) {
				return beforeResult.exitCode;
			}
		}

		// Run the actual command
		const exitCode = originalRun();

		// After hook — runs regardless of command exit code
		if (hooks.onAfterCommand) {
			runHook(hooks, "onAfterCommand", shellRunner, cwd, {
				FLOWTI_COMMAND_EXIT_CODE: String(exitCode),
			});
		}

		return exitCode;
	};
}
