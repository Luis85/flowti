/**
 * Vault-based project service — scans 01 - Projects/ directly via Obsidian Vault API.
 * Works offline without the CLI server. Storybook operations delegate to HttpProjectService when available.
 */

import type { App, TFolder, TFile } from "obsidian";
import type { IProjectService, ProjectSummary, ProjectDetail, StorybookFramework, StorybookStatus } from "../../domain/projects/types.js";
import type { HttpProjectService } from "./http-project-service.js";

const PROJECTS_FOLDER = "01 - Projects";
const PROJECT_BRIEF_TYPE = "ProjectBrief";

const EMPTY_STORYBOOK: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null };

function parseNoteType(content: string): string | null {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return null;
	const frontmatter = match[1];
	const typeMatch = frontmatter.match(/^type:\s*(.+)$/m);
	return typeMatch ? typeMatch[1].trim() : null;
}

export class VaultProjectService implements IProjectService {
	private app: App;
	private httpService: HttpProjectService | null;

	constructor(app: App, httpService: HttpProjectService | null = null) {
		this.app = app;
		this.httpService = httpService;
	}

	/** Update the HTTP service reference (e.g., when server comes online). */
	setHttpService(service: HttpProjectService | null): void {
		this.httpService = service;
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

			// Try to get storybook status from HTTP if available
			let storybook = EMPTY_STORYBOOK;
			if (this.httpService) {
				try {
					const detail = await this.httpService.getProject(name);
					if (detail) storybook = detail.storybook;
				} catch { /* server offline */ }
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

		let storybook = EMPTY_STORYBOOK;
		if (this.httpService) {
			try {
				const detail = await this.httpService.getProject(name);
				if (detail) storybook = detail.storybook;
			} catch { /* server offline */ }
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
		if (!this.httpService) return { ok: false, error: "CLI server not connected" };
		return this.httpService.installStorybook(project, framework);
	}

	async startStorybook(project: string): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }> {
		if (!this.httpService) return { ok: false, error: "CLI server not connected" };
		return this.httpService.startStorybook(project);
	}

	async stopStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		if (!this.httpService) return { ok: false, error: "CLI server not connected" };
		return this.httpService.stopStorybook(project);
	}

	async buildStorybook(project: string): Promise<{ ok: boolean; outputDir?: string; error?: string }> {
		if (!this.httpService) return { ok: false, error: "CLI server not connected" };
		return this.httpService.buildStorybook(project);
	}

	async scaffoldStorybook(project: string): Promise<{ ok: boolean; filesCreated?: number; error?: string }> {
		if (!this.httpService) return { ok: false, error: "CLI server not connected" };
		return this.httpService.scaffoldStorybook(project);
	}
}
