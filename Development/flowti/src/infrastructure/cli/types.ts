/**
 * Types and interfaces for the Obsidian CLI wrapper (1.12+).
 *
 * The CLI uses key=value parameter syntax (not --flag style):
 *   obsidian plugins format=json
 *   obsidian plugin:reload id=flowti-ibde
 *   obsidian eval code="expression"
 *
 * IProcessRunner is the injection seam that allows unit tests to mock
 * subprocess execution without vi.mock("node:child_process").
 */

/** Raw result from a subprocess invocation. */
export interface ProcessResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** Injection seam for process execution — mocked in tests. */
export interface IProcessRunner {
	run(command: string, args: string[]): ProcessResult;
}

/** Configuration for an ObsidianCli instance. */
export interface ObsidianCliOptions {
	/** Vault name. When provided, prepends vault=<name> to all commands. */
	vaultName?: string;
	/** Path to the obsidian binary. Defaults to "obsidian". */
	binaryPath?: string;
	/** Timeout in ms for synchronous CLI calls. Defaults to 10000. */
	timeout?: number;
	/** Injected process runner. Defaults to real execFileSync. */
	runner?: IProcessRunner;
}

/** Parsed CLI output when format=json is used. */
export type CliJsonOutput = Record<string, unknown> | unknown[];

/** Result of an eval() call. */
export interface EvalResult {
	value: string;
	success: boolean;
	error?: string;
}

/** A plugin entry from obsidian plugins versions format=json. */
export interface PluginEntry {
	id: string;
	version?: string;
}

/** Snapshot of Flowti plugin state obtained via eval. */
export interface PluginStateSnapshot {
	loaded: boolean;
	services?: string[];
	hasErrors: boolean;
}

/** Error thrown when the CLI call fails. */
export class CliError extends Error {
	constructor(
		message: string,
		public readonly command: string,
		public readonly exitCode: number,
		public readonly stderr: string,
	) {
		super(message);
		this.name = "CliError";
		Object.setPrototypeOf(this, CliError.prototype);
	}
}
