/**
 * Vault-based project service — scans 01 - Projects/ via Obsidian Vault API.
 * Works fully offline. Storybook operations run as local shell commands.
 */

import type { App, TFolder, TFile } from "obsidian";
import { spawn, execSync } from "node:child_process";
import type { IProjectService, ProjectSummary, ProjectDetail, StorybookFramework, StorybookStatus } from "../../domain/projects/types.js";

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

function detectStorybookLocally(app: App, projectPath: string): StorybookStatus {
	for (const dir of STORYBOOK_DIRS) {
		const sbPath = `${projectPath}/${dir}`;
		if (app.vault.getAbstractFileByPath(sbPath)) {
			return { installed: true, framework: "detected", running: false, url: null, pid: null };
		}
	}
	return EMPTY_STORYBOOK;
}

function getVaultBasePath(app: App): string {
	return (app.vault.adapter as unknown as { basePath: string }).basePath;
}

function resolveAbsProjectPath(app: App, projectName: string): string {
	const base = getVaultBasePath(app);
	return `${base}/${PROJECTS_FOLDER}/${projectName}`.replace(/\//g, "\\");
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

			let storybook = detectStorybookLocally(this.app, `${PROJECTS_FOLDER}/${name}`);
			const running = this.runningProcesses.get(name);
			if (running) {
				storybook = { ...storybook, running: true, url: running.url, pid: running.pid };
			}

			projects.push({ name, type, hasNote, storybook });
		}

		return projects.sort((a, b) => a.name.localeCompare(b.name));
	}

	async getProject(name: string): Promise<ProjectDetail | undefined> {
		const projectPath = `${PROJECTS_FOLDER}/${name}`;
		const projectFolder = this.app.vault.getAbstractFileByPath(projectPath);
		if (!projectFolder) return undefined;

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

		let storybook = detectStorybookLocally(this.app, projectPath);
		const running = this.runningProcesses.get(name);
		if (running) {
			storybook = { ...storybook, running: true, url: running.url, pid: running.pid };
		}

		// Try reading framework from config
		const configPath = `${projectPath}/configs/flowti.config.json`;
		const configFile = this.app.vault.getAbstractFileByPath(configPath) as TFile | null;
		if (configFile && "extension" in configFile) {
			try {
				const content = await this.app.vault.cachedRead(configFile);
				const config = JSON.parse(content) as Record<string, unknown>;
				const components = (config.components ?? {}) as Record<string, unknown>;
				if (components.framework) {
					storybook = { ...storybook, framework: String(components.framework) };
				}
				if (config.type) type = String(config.type);
			} catch { /* invalid config */ }
		}

		return {
			name,
			type,
			hasNote,
			notePath: hasNote ? notePath : null,
			projectPath,
			storybook,
		};
	}

	async installStorybook(project: string, framework: StorybookFramework): Promise<{ ok: boolean; error?: string }> {
		const cwd = resolveAbsProjectPath(this.app, project);
		try {
			execSync(`npx storybook@latest init --type ${framework} --yes`, {
				cwd,
				timeout: 120000,
				windowsHide: true,
				stdio: "ignore",
			});
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Install failed" };
		}
	}

	async startStorybook(project: string): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }> {
		const cwd = resolveAbsProjectPath(this.app, project);
		const port = 6006;
		const url = `http://localhost:${port}`;

		try {
			const child = spawn("npx", ["storybook", "dev", "-p", String(port), "--no-open"], {
				cwd,
				detached: true,
				stdio: "ignore",
				shell: true,
				windowsHide: true,
			});
			child.unref();
			const pid = child.pid ?? 0;

			if (pid > 0) {
				this.runningProcesses.set(project, { pid, url });
			}

			// Poll until ready (max 30s)
			const deadline = Date.now() + 30000;
			while (Date.now() < deadline) {
				try {
					const res = await fetch(url);
					if (res.ok) return { ok: true, url, pid };
				} catch { /* not ready */ }
				await new Promise((r) => setTimeout(r, 1000));
			}

			return { ok: true, url, pid };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Start failed" };
		}
	}

	async stopStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const running = this.runningProcesses.get(project);
		if (!running) return { ok: true };

		try {
			if (process.platform === "win32") {
				execSync(`taskkill /F /PID ${running.pid}`, { windowsHide: true, timeout: 5000 });
			} else {
				process.kill(running.pid, "SIGTERM");
			}
		} catch { /* already dead */ }

		this.runningProcesses.delete(project);
		return { ok: true };
	}

	async buildStorybook(project: string): Promise<{ ok: boolean; outputDir?: string; error?: string }> {
		const cwd = resolveAbsProjectPath(this.app, project);
		try {
			execSync("npx storybook build", {
				cwd,
				timeout: 120000,
				windowsHide: true,
				stdio: "ignore",
			});
			return { ok: true, outputDir: `${cwd}\\storybook-static` };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Build failed" };
		}
	}

	async scaffoldStorybook(project: string): Promise<{ ok: boolean; filesCreated?: number; error?: string }> {
		const cwd = resolveAbsProjectPath(this.app, project);
		const vaultBase = getVaultBasePath(this.app);
		const cliBin = `${vaultBase}\\.flowti\\bin`.replace(/\//g, "\\");

		try {
			execSync(`node "${cliBin}" storybook:scaffold --project="${project}"`, {
				cwd: vaultBase,
				timeout: 30000,
				windowsHide: true,
				stdio: "ignore",
			});
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Scaffold failed" };
		}
	}
}
