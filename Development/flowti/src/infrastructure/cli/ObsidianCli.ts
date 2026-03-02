/**
 * ObsidianCli — typed wrapper around the Obsidian 1.12+ CLI.
 *
 * Wraps subprocess execution behind IProcessRunner so unit tests
 * can exercise parsing and error handling without spawning a process.
 *
 * CLI syntax uses key=value parameters:
 *   obsidian plugins format=json
 *   obsidian plugin:reload id=flowti-ibde
 *   obsidian eval code="expression"
 *
 * Eval output is prefixed with "=> " which is stripped automatically.
 */
import { execFileSync } from "node:child_process";
import type {
	ObsidianCliOptions,
	IProcessRunner,
	ProcessResult,
	CliJsonOutput,
	EvalResult,
	PluginEntry,
	PluginStateSnapshot,
} from "./types";
import { CliError } from "./types";

function createDefaultRunner(timeout: number): IProcessRunner {
	return {
		run(command: string, args: string[]): ProcessResult {
			try {
				const stdout = execFileSync(command, args, {
					encoding: "utf-8",
					timeout,
					windowsHide: true,
				});
				return { stdout, stderr: "", exitCode: 0 };
			} catch (err: unknown) {
				const e = err as { stdout?: string; stderr?: string; status?: number };
				return {
					stdout: e.stdout ?? "",
					stderr: e.stderr ?? "",
					exitCode: e.status ?? 1,
				};
			}
		},
	};
}

export class ObsidianCli {
	private readonly binaryPath: string;
	private readonly vaultName: string | undefined;
	private readonly runner: IProcessRunner;

	constructor(options: ObsidianCliOptions = {}) {
		this.binaryPath = options.binaryPath ?? "obsidian";
		this.vaultName = options.vaultName;
		const timeout = options.timeout ?? 10_000;
		this.runner = options.runner ?? createDefaultRunner(timeout);
	}

	/** Runs a CLI command and returns raw stdout. Throws CliError on non-zero exit. */
	run(command: string, args: string[] = []): string {
		const fullArgs = this.buildArgs(command, args);
		const result = this.runner.run(this.binaryPath, fullArgs);
		this.assertSuccess(result, command);
		return result.stdout.trim();
	}

	/** Runs a command and parses stdout as JSON. Appends format=json to args. */
	runJson(command: string, args: string[] = []): CliJsonOutput {
		const output = this.run(command, [...args, "format=json"]);
		try {
			return JSON.parse(output) as CliJsonOutput;
		} catch {
			throw new CliError(
				`CLI returned non-JSON output for '${command}'`,
				command,
				0,
				output,
			);
		}
	}

	/** Evaluates JavaScript in the Obsidian app context. */
	eval(code: string): EvalResult {
		const fullArgs = this.buildArgs("eval", [`code=${code}`]);
		const result = this.runner.run(this.binaryPath, fullArgs);
		if (result.exitCode !== 0) {
			return {
				value: "",
				success: false,
				error: result.stderr || result.stdout.trim(),
			};
		}
		const raw = result.stdout.trim();
		// Eval output is prefixed with "=> "
		const value = raw.startsWith("=> ") ? raw.slice(3) : raw;
		return { value, success: true };
	}

	/** Creates a vault note at the given path with content. */
	createFile(path: string, content: string): void {
		this.run("create", [`path=${path}`, `content=${content}`]);
	}

	/** Reads vault note content. */
	readFile(path: string): string {
		return this.run("read", [`path=${path}`]);
	}

	/** Deletes a vault note. */
	deleteFile(path: string): void {
		this.run("delete", [`path=${path}`]);
	}

	/** Sets a frontmatter property on a vault note. */
	setProperty(file: string, key: string, value: string): void {
		this.run("property:set", [`path=${file}`, `name=${key}`, `value=${value}`]);
	}

	/** Searches for text and returns matching file paths. */
	search(query: string): string[] {
		const output = this.runJson("search", [`query=${query}`]);
		if (Array.isArray(output)) {
			return output.map((entry) => {
				if (typeof entry === "string") return entry;
				if (typeof entry === "object" && entry !== null && "path" in entry) {
					return String((entry as Record<string, unknown>).path);
				}
				return String(entry);
			});
		}
		return [];
	}

	/** Returns all installed plugins with optional version info. */
	getPlugins(): PluginEntry[] {
		return this.runJson("plugins", ["versions"]) as PluginEntry[];
	}

	/** Enables a community plugin by ID. */
	enablePlugin(pluginId: string): void {
		this.run("plugin:enable", [`id=${pluginId}`]);
	}

	/** Disables a community plugin by ID. */
	disablePlugin(pluginId: string): void {
		this.run("plugin:disable", [`id=${pluginId}`]);
	}

	/** Reloads a plugin by ID. */
	reloadPlugin(pluginId: string): void {
		this.run("plugin:reload", [`id=${pluginId}`]);
	}

	/** Executes an Obsidian command by ID. */
	executeCommand(commandId: string): void {
		this.run("command", [`id=${commandId}`]);
	}

	/** Returns a snapshot of Flowti plugin state via eval. */
	getPluginState(): PluginStateSnapshot {
		const code = [
			"const p = app.plugins.plugins['flowti-ibde'];",
			"JSON.stringify({",
			"  loaded: !!p,",
			"  services: p ? Object.keys(p).filter(k => k.endsWith('Service')) : [],",
			"  hasErrors: false",
			"})",
		].join(" ");

		const result = this.eval(code);
		if (!result.success) {
			return { loaded: false, hasErrors: true };
		}
		try {
			return JSON.parse(result.value) as PluginStateSnapshot;
		} catch {
			throw new CliError(
				"getPluginState: eval returned non-JSON",
				"eval",
				0,
				result.value,
			);
		}
	}

	/** Opens a file in the Obsidian editor. Opens in a new tab by default. */
	openFile(path: string, newTab = true): void {
		const args = [`path=${path}`];
		if (newTab) args.push("newtab");
		this.run("open", args);
	}

	/** Appends content to an existing vault note. */
	appendFile(path: string, content: string): void {
		this.run("append", [`path=${path}`, `content=${content}`]);
	}

	/** Creates a file, overwriting if it already exists. */
	createFileOverwrite(path: string, content: string): void {
		this.run("create", [`path=${path}`, `content=${content}`, "overwrite"]);
	}

	/** Sets the Obsidian theme by name. */
	setTheme(name: string): void {
		this.run("theme:set", [`name=${name}`]);
	}

	/** Checks whether a vault file exists (returns false instead of throwing). */
	fileExists(path: string): boolean {
		try {
			this.run("file", [`path=${path}`]);
			return true;
		} catch {
			return false;
		}
	}

	/** Returns the count of DOM elements matching the selector. */
	domCount(selector: string): number {
		const output = this.run("dev:dom", [`selector=${selector}`, "total"]);
		return parseInt(output, 10) || 0;
	}

	/** Returns the text content of the first DOM element matching the selector. */
	domText(selector: string): string {
		return this.run("dev:dom", [`selector=${selector}`, "text"]);
	}

	/** Returns the value of an attribute on the first DOM element matching the selector. */
	domAttr(selector: string, attr: string): string {
		return this.run("dev:dom", [`selector=${selector}`, `attr=${attr}`]);
	}

	/** Prepends content to an existing vault note. */
	prependFile(path: string, content: string): void {
		this.run("prepend", [`path=${path}`, `content=${content}`]);
	}

	/** Moves/renames a vault file. */
	moveFile(from: string, to: string): void {
		this.run("move", [`path=${from}`, `to=${to}`]);
	}

	/** Returns open tab information as a JSON array. */
	getTabs(): Array<{ path?: string; type?: string }> {
		const output = this.run("tabs", ["format=json"]);
		try {
			return JSON.parse(output) as Array<{ path?: string; type?: string }>;
		} catch {
			return [];
		}
	}

	/** Creates a vault folder. Uses eval since no native CLI folder:create exists. */
	createFolder(folderPath: string): void {
		const escaped = folderPath.replace(/'/g, "\\'");
		const result = this.eval(
			`(async () => { try { await app.vault.createFolder('${escaped}'); } catch {} })()`,
		);
		if (!result.success) {
			throw new CliError(
				`createFolder failed: ${result.error ?? "unknown"}`,
				"eval",
				1,
				result.error ?? "",
			);
		}
	}

	/** Dismisses all visible Notice toasts from the DOM. */
	dismissNotices(): void {
		this.eval(
			"document.querySelectorAll('.notice').forEach(n => n.remove())",
		);
	}

	/** Returns text content of all visible Notice toasts. */
	getNotices(): string[] {
		const result = this.eval(
			"JSON.stringify(Array.from(document.querySelectorAll('.notice')).map(n => n.textContent || ''))",
		);
		if (!result.success) return [];
		try {
			return JSON.parse(result.value) as string[];
		} catch {
			return [];
		}
	}

	/** Evaluates a JS expression and returns the parsed JSON result. */
	evalJson<T = unknown>(code: string): T {
		const result = this.eval(code);
		if (!result.success) {
			throw new CliError(
				`evalJson failed: ${result.error ?? "unknown"}`,
				"eval",
				1,
				result.error ?? "",
			);
		}
		try {
			return JSON.parse(result.value) as T;
		} catch {
			throw new CliError(
				"evalJson: eval returned non-JSON",
				"eval",
				0,
				result.value,
			);
		}
	}

	/** Gets recent console output from Obsidian. */
	getConsoleOutput(): string {
		return this.run("dev:console");
	}

	/** Takes a screenshot of the current Obsidian window. */
	screenshot(outputPath: string): void {
		this.run("dev:screenshot", [`path=${outputPath}`]);
	}

	/** Shows a Notice in Obsidian. */
	notice(message: string, durationMs = 8000): void {
		this.eval(`new Notice(${JSON.stringify(message)}, ${durationMs})`);
	}

	/** Gets recent JavaScript errors from Obsidian. */
	getErrors(): string {
		try {
			return this.run("dev:errors");
		} catch {
			return "";
		}
	}

	private buildArgs(command: string, extra: string[]): string[] {
		const vaultPrefix = this.vaultName ? [`vault=${this.vaultName}`] : [];
		return [...vaultPrefix, command, ...extra];
	}

	private assertSuccess(result: ProcessResult, command: string): void {
		if (result.exitCode !== 0) {
			throw new CliError(
				`CLI command failed: ${command} (exit ${result.exitCode})`,
				command,
				result.exitCode,
				result.stderr,
			);
		}
	}
}
