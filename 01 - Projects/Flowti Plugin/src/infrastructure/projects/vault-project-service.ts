/**
 * Vault-based project service — scans 01 - Projects/ via Obsidian Vault API.
 * Works fully offline. Storybook operations run as local async shell commands.
 */

import type { App, TFolder, TFile } from "obsidian";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { IProjectService, ProjectSummary, ProjectDetail, ProjectConfig, StorybookFramework, StorybookStatus, OutputCallback } from "../../domain/projects/types.js";

const PROJECTS_FOLDER = "01 - Projects";
const PROJECT_BRIEF_TYPE = "ProjectBrief";
const STORYBOOK_DIRS = [".storybook", "components/.storybook"];
const EMPTY_STORYBOOK: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null };

function parseNoteType(content: string): string | null {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return null;
	const typeMatch = match[1].match(/^type:\s*(.+)$/m);
	return typeMatch ? typeMatch[1].trim() : null;
}

/** Detect storybook using Node.js fs (not vault API — Obsidian ignores dot-folders). */
function detectStorybookOnDisk(absProjectPath: string): StorybookStatus {
	for (const dir of STORYBOOK_DIRS) {
		const sbPath = join(absProjectPath, dir);
		if (existsSync(sbPath)) {
			// Try reading framework from config
			let framework: string | null = null;
			try {
				const mainPath = join(sbPath, "main.ts");
				if (existsSync(mainPath)) {
					const content = readFileSync(mainPath, "utf-8");
					const fwMatch = content.match(/@storybook\/([\w-]+)/);
					if (fwMatch) framework = fwMatch[1];
				}
			} catch { /* can't read */ }
			return { installed: true, framework, running: false, url: null, pid: null };
		}
	}
	return EMPTY_STORYBOOK;
}

function getVaultBasePath(app: App): string {
	return (app.vault.adapter as unknown as { basePath: string }).basePath;
}

/** Strip ANSI escape codes from terminal output. */
function stripAnsi(text: string): string {
	return text.replace(/\x1B\[[0-9;]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B\][^\x1B]*\x1B\\/g, "");
}

/** Run a shell command asynchronously — streams output via callback. */
function runAsync(
	command: string,
	args: string[],
	cwd: string,
	onOutput?: (line: string) => void,
): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			shell: true,
			windowsHide: true,
			stdio: "pipe",
			env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
		});

		let stderr = "";

		child.stdout?.on("data", (chunk: Buffer) => {
			const lines = stripAnsi(chunk.toString()).split("\n").filter(Boolean);
			for (const line of lines) onOutput?.(line);
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			stderr += text;
			const lines = stripAnsi(text).split("\n").filter(Boolean);
			for (const line of lines) onOutput?.(line);
		});

		child.on("error", (err) => {
			onOutput?.(`Error: ${err.message}`);
			resolve({ ok: false, error: err.message });
		});

		child.on("close", (code) => {
			if (code === 0) {
				onOutput?.("Done.");
				resolve({ ok: true });
			} else {
				resolve({ ok: false, error: stderr.trim() || `Exit code ${code}` });
			}
		});
	});
}

export class VaultProjectService implements IProjectService {
	private app: App;
	private runningProcesses = new Map<string, { pid: number; url: string }>();

	constructor(app: App) {
		this.app = app;
	}

	async listProjects(): Promise<ProjectSummary[]> {
		const projectsFolder = this.app.vault.getAbstractFileByPath(PROJECTS_FOLDER);
		if (!projectsFolder || !("children" in projectsFolder)) return [];

		const folder = projectsFolder as TFolder;
		const projects: ProjectSummary[] = [];
		const basePath = getVaultBasePath(this.app);

		for (const child of folder.children) {
			if (!("children" in child)) continue;
			const projectFolder = child as TFolder;
			const name = projectFolder.name;

			const notePath = `${PROJECTS_FOLDER}/${name}/${name}.md`;
			const noteFile = this.app.vault.getAbstractFileByPath(notePath) as TFile | null;

			let hasNote = false;
			let type = "unknown";

			if (noteFile && "extension" in noteFile) {
				const content = await this.app.vault.cachedRead(noteFile);
				const noteType = parseNoteType(content);
				hasNote = noteType === PROJECT_BRIEF_TYPE;
				type = noteType ?? "unknown";
			}

			const absPath = join(basePath, PROJECTS_FOLDER, name);
			let storybook = detectStorybookOnDisk(absPath);
			const running = this.runningProcesses.get(name);
			if (running) {
				storybook = { ...storybook, running: true, url: running.url, pid: running.pid };
			}

			// Read type from config if not from note
			if (type === "unknown") {
				try {
					const configPath = join(absPath, "configs", "flowti.config.json");
					if (existsSync(configPath)) {
						const config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
						if (config.type) type = String(config.type);
					}
				} catch { /* invalid config */ }
			}

			projects.push({ name, type, hasNote, storybook });
		}

		return projects.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getProject(name: string): Promise<ProjectDetail | undefined> {
		const projectPath = `${PROJECTS_FOLDER}/${name}`;
		const projectFolder = this.app.vault.getAbstractFileByPath(projectPath);
		if (!projectFolder) return undefined;

		const basePath = getVaultBasePath(this.app);
		const absPath = join(basePath, PROJECTS_FOLDER, name);

		const notePath = `${PROJECTS_FOLDER}/${name}/${name}.md`;
		const noteFile = this.app.vault.getAbstractFileByPath(notePath) as TFile | null;

		let hasNote = false;
		let type = "unknown";

		if (noteFile && "extension" in noteFile) {
			const content = await this.app.vault.cachedRead(noteFile);
			const noteType = parseNoteType(content);
			hasNote = noteType === PROJECT_BRIEF_TYPE;
			type = noteType ?? "unknown";
		}

		let storybook = detectStorybookOnDisk(absPath);
		const running = this.runningProcesses.get(name);
		if (running) {
			storybook = { ...storybook, running: true, url: running.url, pid: running.pid };
		}

		// Read config for additional info
		let projectConfig: ProjectConfig | undefined;
		try {
			const configPath = join(absPath, "configs", "flowti.config.json");
			if (existsSync(configPath)) {
				const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
				if (raw.type) type = String(raw.type);

				const components = (raw.components ?? {}) as Record<string, unknown>;
				if (components.framework) {
					storybook = { ...storybook, framework: String(components.framework) };
				}

				const buildCmds = ((raw.build as Record<string, unknown>)?.commands ?? {}) as Record<string, unknown>;
				const testCmds = ((raw.test as Record<string, unknown>)?.commands ?? {}) as Record<string, unknown>;
				const healthRaw = (raw.health as Record<string, unknown>)?.thresholds as Record<string, unknown> | undefined;
				const coverage = healthRaw?.coverage as Record<string, unknown> | undefined;
				const lint = healthRaw?.lint as Record<string, unknown> | undefined;
				const tests = healthRaw?.tests as Record<string, unknown> | undefined;
				const mgmt = raw.management as Record<string, unknown> | undefined;
				const roster = (mgmt?.agents as Record<string, unknown>)?.roster as string[] | undefined;
				const endpoints = (raw.publish as Record<string, unknown>)?.endpoints as Array<Record<string, unknown>> | undefined;

				projectConfig = {
					buildModes: Object.keys(buildCmds),
					testPresets: Object.keys(testCmds),
					framework: components.framework ? String(components.framework) : undefined,
					healthTargets: coverage || lint || tests ? {
						coverageMin: coverage?.min as number | undefined,
						coverageTarget: coverage?.target as number | undefined,
						maxLintErrors: lint?.maxErrors as number | undefined,
						maxLintWarnings: lint?.maxWarnings as number | undefined,
						minTests: tests?.minPassed as number | undefined,
					} : undefined,
					agents: roster,
					publishTargets: endpoints?.map((e) => String(e.name)),
				};
			}
		} catch { /* invalid config */ }

		return {
			name,
			type,
			hasNote,
			notePath: hasNote ? notePath : null,
			projectPath,
			storybook,
			config: projectConfig,
		};
	}

	async installStorybook(project: string, framework: StorybookFramework, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const cwd = join(getVaultBasePath(this.app), PROJECTS_FOLDER, project);
		// Install storybook with vite builder + essentials (includes docs + test)
		const result = await runAsync("npx", ["storybook@latest", "init", "--type", framework, "--builder", "vite", "--yes"], cwd, onOutput);
		if (!result.ok) return result;

		// Add a11y addon via npm
		onOutput?.("Installing @storybook/addon-a11y...");
		const a11yResult = await runAsync("npm", ["install", "--save-dev", "@storybook/addon-a11y"], cwd, onOutput);
		if (!a11yResult.ok) {
			onOutput?.("Warning: a11y addon install failed, continuing without it.");
		}
		return { ok: true };
	}

	private findStorybookConfigDir(absProjectPath: string): string | null {
		for (const dir of STORYBOOK_DIRS) {
			const sbPath = join(absProjectPath, dir);
			if (existsSync(sbPath)) return join(absProjectPath, dir.replace("/.storybook", "").replace(".storybook", "."));
		}
		return null;
	}

	private findStorybookDir(absProjectPath: string): string {
		for (const dir of STORYBOOK_DIRS) {
			const sbPath = join(absProjectPath, dir);
			if (existsSync(sbPath)) return sbPath;
		}
		return join(absProjectPath, ".storybook");
	}

	async startStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }> {
		const cwd = join(getVaultBasePath(this.app), PROJECTS_FOLDER, project);
		const port = 6006;
		const url = `http://localhost:${port}`;
		const configDir = this.findStorybookDir(cwd);

		try {
			// Run from the directory containing node_modules (parent of .storybook)
			const sbParent = join(configDir, "..");
			const child = spawn("npx", ["storybook", "dev", "-p", String(port), "--no-open", "--ci", "--config-dir", `"${configDir}"`], {
				cwd: sbParent,
				stdio: "pipe",
				shell: true,
				windowsHide: true,
				env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
			});

			const pid = child.pid ?? 0;
			if (pid > 0) {
				this.runningProcesses.set(project, { pid, url });
			}

			// Stream output but don't wait for exit (it's a long-running dev server)
			child.stdout?.on("data", (chunk: Buffer) => {
				for (const line of stripAnsi(chunk.toString()).split("\n").filter(Boolean)) {
					onOutput?.(line);
				}
			});
			child.stderr?.on("data", (chunk: Buffer) => {
				for (const line of stripAnsi(chunk.toString()).split("\n").filter(Boolean)) {
					onOutput?.(line);
				}
			});
			child.on("error", (err) => {
				onOutput?.(`Error: ${err.message}`);
				this.runningProcesses.delete(project);
			});
			child.on("close", (code) => {
				if (code !== 0) onOutput?.(`Process exited with code ${code}`);
				this.runningProcesses.delete(project);
			});

			// Detach so it survives if the handler scope is GC'd, but keep pipes alive
			child.unref();

			return { ok: true, url, pid };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Start failed" };
		}
	}

	async stopStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const running = this.runningProcesses.get(project);
		const port = 6006;

		// Kill by PID tree if we have it
		if (running?.pid) {
			await runAsync("taskkill", ["/F", "/T", "/PID", String(running.pid)], ".");
		}

		// Always kill by port as fallback — the PID might be stale or wrong (shell wrapper)
		if (process.platform === "win32") {
			await runAsync("powershell", [
				"-Command",
				`Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
			], ".");
		} else {
			await runAsync("sh", ["-c", `lsof -ti:${port} | xargs kill -9 2>/dev/null`], ".");
		}

		this.runningProcesses.delete(project);
		return { ok: true };
	}

	async buildStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; outputDir?: string; error?: string }> {
		const cwd = join(getVaultBasePath(this.app), PROJECTS_FOLDER, project);
		const configDir = this.findStorybookDir(cwd);
		const result = await runAsync("npx", ["storybook", "build", "--config-dir", `"${configDir}"`], cwd, onOutput);
		if (result.ok) {
			return { ...result, outputDir: join(cwd, "storybook-static") };
		}
		return result;
	}

	async scaffoldStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; filesCreated?: number; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		return runAsync("node", [cliBin, "storybook:scaffold", `--project=${project}`], vaultBase, onOutput);
	}

	async importMarkdownSitemap(project: string, sourcePath: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const absSource = join(vaultBase, sourcePath);
		return runAsync("node", [cliBin, "storybook:import", `--project=${project}`, `--source=${absSource}`], vaultBase, onOutput);
	}
}
