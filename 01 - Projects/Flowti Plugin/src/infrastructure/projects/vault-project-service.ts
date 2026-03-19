/**
 * Vault-based project service — scans 01 - Projects/ via Obsidian Vault API.
 * Works fully offline. Storybook operations run as local async shell commands.
 */

import type { App, TFolder, TFile } from "obsidian";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { IProjectService, ProjectSummary, ProjectDetail, ProjectConfig, StorybookFramework, StorybookStatus, OutputCallback, MarkdownSourceConfig } from "../../domain/projects/types.js";

const PROJECTS_FOLDER = "01 - Projects";
const PROJECT_BRIEF_TYPE = "ProjectBrief";
const STORYBOOK_DIRS = [".storybook", "components/.storybook"];
const EMPTY_STORYBOOK: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false };

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
			const sbParent = join(sbPath, "..");
			const hasStaticBuild = existsSync(join(sbParent, "storybook-static", "index.html"));
			return { installed: true, framework, running: false, url: null, pid: null, hasStaticBuild };
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
/** Quote an arg for shell usage if it contains spaces and isn't already quoted. */
function shellQuote(arg: string): string {
	if (arg.includes(" ") && !arg.startsWith('"') && !arg.startsWith("'")) {
		return `"${arg}"`;
	}
	return arg;
}

/** Filter noisy output lines from child processes (Vite dep scan, stack traces, telemetry). */
function isNoisyLine(line: string): boolean {
	const trimmed = line.trim();
	// Vite dependency scan path dumps
	if (/^\|?\s+[A-Z]:[/\\]/.test(trimmed)) return true;
	// Stack trace lines
	if (/^\|?\s+at\s/.test(trimmed)) return true;
	// Telemetry notice
	if (/telemetry|completely anonymous/i.test(trimmed)) return true;
	// Empty pipe lines
	if (trimmed === "|" || trimmed === "│") return true;
	return false;
}

function runAsync(
	command: string,
	args: string[],
	cwd: string,
	onOutput?: (line: string) => void,
): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		const child = spawn(command, args.map(shellQuote), {
			cwd,
			shell: true,
			windowsHide: true,
			stdio: "pipe",
			env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
		});

		let stderr = "";

		const emit = (line: string) => {
			if (!isNoisyLine(line)) onOutput?.(line);
		};

		child.stdout?.on("data", (chunk: Buffer) => {
			const lines = stripAnsi(chunk.toString()).split("\n").filter(Boolean);
			for (const line of lines) emit(line);
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			stderr += text;
			const lines = stripAnsi(text).split("\n").filter(Boolean);
			for (const line of lines) emit(line);
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
				// Extract only fatal/error lines from stderr, not progress spam
				const meaningful = stderr.split("\n")
					.map((l) => l.trim())
					.filter((l) => /^(fatal|error|warning):/i.test(l))
					.slice(-3)
					.join("\n");
				resolve({ ok: false, error: meaningful || stderr.trim().split("\n").pop() || `Exit code ${code}` });
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
			} else {
				// Fallback: file may exist on disk but not yet indexed by Obsidian
				const absNotePath = join(basePath, notePath);
				if (existsSync(absNotePath)) {
					try {
						const content = readFileSync(absNotePath, "utf-8");
						const noteType = parseNoteType(content);
						hasNote = noteType === PROJECT_BRIEF_TYPE;
						type = noteType ?? "unknown";
					} catch { /* can't read */ }
				}
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
		} else {
			// Fallback: file may exist on disk but not yet indexed by Obsidian
			const absNotePath = join(basePath, notePath);
			if (existsSync(absNotePath)) {
				try {
					const content = readFileSync(absNotePath, "utf-8");
					const noteType = parseNoteType(content);
					hasNote = noteType === PROJECT_BRIEF_TYPE;
					type = noteType ?? "unknown";
				} catch { /* can't read */ }
			}
		}

		let brief: import("../../domain/projects/types.js").ProjectBrief | undefined;
		if (noteFile && hasNote) {
			const cache = this.app.metadataCache.getFileCache(noteFile);
			const fm = cache?.frontmatter;
			if (fm) {
				brief = {
					start: fm.start != null ? String(fm.start) : undefined,
					end: fm.end != null ? String(fm.end) : undefined,
					goal: fm.goal != null ? String(fm.goal) : undefined,
					description: fm.description != null ? String(fm.description) : undefined,
					status: fm.status != null ? String(fm.status) : undefined,
				};
			}
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
					markdownSource: components.markdownSource ? {
						path: String((components.markdownSource as Record<string, unknown>).path ?? ""),
						strategy: String((components.markdownSource as Record<string, unknown>).strategy ?? "category") as import("../../domain/projects/types.js").ImportStrategy,
						requiredFields: ((components.markdownSource as Record<string, unknown>).requiredFields as string[] | undefined) ?? [],
					} : undefined,
				};
			}
		} catch { /* invalid config */ }

		const absProjectPath = absPath;
		const hasSitemap = existsSync(join(absProjectPath, "configs", "sitemap.json"))
			|| existsSync(join(absProjectPath, "imported-sitemap.json"));

		const canvasPath = join(absProjectPath, "sitemap.canvas");
		const hasCanvas = existsSync(canvasPath);
		let canvasChanged = false;
		if (hasCanvas) {
			const metaPath = join(absProjectPath, "configs", ".sitemap-canvas-meta.json");
			if (existsSync(metaPath)) {
				try {
					const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { canvasHash?: string };
					const crypto = require("node:crypto");
					const currentHash = crypto.createHash("md5").update(readFileSync(canvasPath, "utf-8")).digest("hex");
					canvasChanged = meta.canvasHash !== currentHash;
				} catch { canvasChanged = true; }
			} else {
				canvasChanged = true;
			}
		}

		return {
			name,
			type,
			hasNote,
			notePath: hasNote ? notePath : null,
			projectPath,
			hasSitemap,
			hasCanvas,
			canvasChanged,
			brief,
			storybook,
			config: projectConfig,
		};
	}

	async installStorybook(project: string, framework: StorybookFramework, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		return runAsync("node", [cliBin, "storybook:install", `--project=${project}`, `--framework=${framework}`], vaultBase, onOutput);
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
			const child = spawn("npx", ["storybook", "dev", "-p", String(port), "--no-open", "--ci", "--config-dir", configDir].map(shellQuote), {
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
		const result = await runAsync("npx", ["storybook", "build", "--config-dir", configDir], cwd, onOutput);
		if (result.ok) {
			return { ...result, outputDir: join(cwd, "storybook-static") };
		}
		return result;
	}

	async scaffoldStorybook(project: string, onOutput?: OutputCallback, opts?: { adoptImport?: boolean }): Promise<{ ok: boolean; filesCreated?: number; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const args = [cliBin, "storybook:scaffold", `--project=${project}`];
		if (opts?.adoptImport) args.push("--adopt-import");
		return runAsync("node", args, vaultBase, onOutput);
	}

	async importMarkdownSitemap(project: string, sourcePath: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const absSource = join(vaultBase, sourcePath);
		return runAsync("node", [cliBin, "storybook:import", `--project=${project}`, `--source=${absSource}`], vaultBase, onOutput);
	}

	async saveMarkdownSourceConfig(project: string, config: MarkdownSourceConfig, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const fields = config.requiredFields.join(",");
		return runAsync("node", [
			cliBin, "storybook:import", "--save-config",
			`--project=${project}`,
			`--source=${config.path}`,
			`--strategy=${config.strategy}`,
			`--fields=${fields}`,
		], vaultBase, onOutput);
	}

	async cleanStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		return runAsync("node", [cliBin, "storybook:clean", `--project=${project}`], vaultBase);
	}

	async importCanvasSitemap(project: string, onOutput?: OutputCallback, opts?: { merge?: boolean }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const args = [cliBin, "storybook:canvas-import", `--project=${project}`];
		if (opts?.merge) args.push("--merge");
		return runAsync("node", args, vaultBase, onOutput);
	}

	async generateSitemapCanvas(project: string, onOutput?: OutputCallback, opts?: { preset?: string; force?: boolean }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const args = [cliBin, "storybook:canvas-generate", `--project=${project}`];
		if (opts?.preset) args.push(`--preset=${opts.preset}`);
		if (opts?.force) args.push("--force");
		return runAsync("node", args, vaultBase, onOutput);
	}

	async importFromGit(url: string, name: string, mode: "submodule" | "template", onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const targetDir = join(vaultBase, PROJECTS_FOLDER, name);

		if (existsSync(targetDir)) {
			return { ok: false, error: `Folder "${name}" already exists` };
		}

		if (mode === "submodule") {
			return runAsync("git", ["-c", "core.longpaths=true", "submodule", "add", url, `${PROJECTS_FOLDER}/${name}`], vaultBase, onOutput);
		}

		// Template mode: clone then detach
		const cloneResult = await runAsync("git", ["-c", "core.longpaths=true", "clone", url, targetDir], vaultBase, onOutput);
		if (!cloneResult.ok) return cloneResult;

		// Remove .git directory — use shell on Windows for file-locking safety
		const gitDir = join(targetDir, ".git");
		if (existsSync(gitDir)) {
			const removeCmd = process.platform === "win32"
				? { cmd: "cmd", args: ["/c", "rmdir", "/s", "/q", gitDir] }
				: { cmd: "rm", args: ["-rf", gitDir] };
			const removeResult = await runAsync(removeCmd.cmd, removeCmd.args, vaultBase);
			if (!removeResult.ok) {
				return { ok: false, error: "Failed to detach from remote (could not remove .git directory)" };
			}
		}

		return { ok: true };
	}

	async detectProject(name: string): Promise<{ ok: boolean; type?: string; framework?: string; packageManager?: string; testFramework?: string; hasConfig?: boolean; buildCommand?: string; testCommand?: string; lintCommand?: string; error?: string }> {
		try {
			const vaultBase = getVaultBasePath(this.app);
			const projectPath = join(vaultBase, PROJECTS_FOLDER, name);

			const hasPkg = existsSync(join(projectPath, "package.json"));
			const hasTsConfig = existsSync(join(projectPath, "tsconfig.json"));
			const type = !hasPkg ? "unknown" : hasTsConfig ? "typescript" : "javascript";

			let pkg: Record<string, unknown> = {};
			if (hasPkg) {
				try { pkg = JSON.parse(readFileSync(join(projectPath, "package.json"), "utf-8")) as Record<string, unknown>; } catch { /* empty */ }
			}
			const allDeps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
			const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
			const scripts = (pkg.scripts ?? {}) as Record<string, string>;

			const framework = existsSync(join(projectPath, "angular.json")) ? "Angular"
				: (existsSync(join(projectPath, "next.config.js")) || existsSync(join(projectPath, "next.config.ts"))) ? "Next.js"
				: ("react" in allDeps && ("vite" in allDeps || existsSync(join(projectPath, "vite.config.ts")))) ? "React"
				: "vue" in allDeps ? "Vue"
				: "svelte" in allDeps ? "Svelte"
				: undefined;

			const packageManager = existsSync(join(projectPath, "bun.lockb")) ? "bun"
				: existsSync(join(projectPath, "pnpm-lock.yaml")) ? "pnpm"
				: existsSync(join(projectPath, "yarn.lock")) ? "yarn"
				: existsSync(join(projectPath, "package-lock.json")) ? "npm"
				: undefined;

			const testFramework = "vitest" in devDeps ? "vitest" : "jest" in devDeps ? "jest" : undefined;
			const hasConfig = existsSync(join(projectPath, "configs", "flowti.config.json")) || existsSync(join(projectPath, "flowti.config.json"));
			const pm = packageManager ?? "npm";
			const buildCommand = scripts.build ? `${pm} run build` : undefined;
			const testCommand = scripts.test ? `${pm} test` : undefined;
			const lintCommand = scripts.lint ? `${pm} run lint` : undefined;

			return { ok: true, type, framework, packageManager, testFramework, hasConfig, buildCommand, testCommand, lintCommand };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Detection failed" };
		}
	}

	async bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		const args = [cliBin, "project:bootstrap", `--project=${name}`];
		if (config.build) args.push(`--build=${config.build}`);
		if (config.test) args.push(`--test=${config.test}`);
		if (config.lint) args.push(`--lint=${config.lint}`);
		if (config.storybook) args.push(`--storybook=${config.storybook}`);
		return runAsync("node", args, vaultBase);
	}

	async createEmptyProject(name: string): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = join(vaultBase, ".flowti", "bin");
		return runAsync("node", [cliBin, "project:create", `--name=${name}`], vaultBase);
	}

	private previewServers = new Map<string, { close: () => void; url: string }>();

	async previewStorybook(project: string): Promise<{ ok: boolean; url?: string; error?: string }> {
		const existing = this.previewServers.get(project);
		if (existing) return { ok: true, url: existing.url };

		const vaultBase = getVaultBasePath(this.app);
		const staticDir = join(vaultBase, PROJECTS_FOLDER, project, "components", "storybook-static");
		if (!existsSync(staticDir)) return { ok: false, error: "No static build found" };

		try {
			const http = await import("node:http");
			const fs = await import("node:fs");
			const nodePath = await import("node:path");
			const port = 6007;

			const MIME: Record<string, string> = {
				".html": "text/html", ".css": "text/css", ".js": "application/javascript",
				".mjs": "application/javascript", ".json": "application/json",
				".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
			};

			const server = http.createServer((req, res) => {
				res.setHeader("Access-Control-Allow-Origin", "*");
				const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
				const safePath = urlPath === "/" ? "/index.html" : urlPath;
				const filePath = nodePath.join(staticDir, ...safePath.split("/").filter(s => s && s !== ".."));

				if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
				const ext = nodePath.extname(filePath).toLowerCase();
				const mime = MIME[ext] ?? "application/octet-stream";
				const body = fs.readFileSync(filePath);
				res.writeHead(200, { "Content-Type": mime });
				res.end(body);
			});

			await new Promise<void>((resolve) => server.listen(port, resolve));
			const url = `http://localhost:${port}`;
			this.previewServers.set(project, { close: () => server.close(), url });
			return { ok: true, url };
		} catch (err) {
			return { ok: false, error: String(err) };
		}
	}

	async stopPreview(project: string): Promise<{ ok: boolean; error?: string }> {
		const server = this.previewServers.get(project);
		if (server) {
			server.close();
			this.previewServers.delete(project);
		}
		return { ok: true };
	}
}
