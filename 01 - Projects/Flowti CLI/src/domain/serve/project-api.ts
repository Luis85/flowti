/**
 * project-api.ts — Project Hub API domain functions.
 *
 * Pure functions that produce JSON-serialisable responses for the
 * /api/projects/* and /api/storybook/* HTTP endpoints. Each function
 * receives explicit deps — no infrastructure singletons imported.
 */

import type { IFileSystem, IPaths, ComponentFramework } from "../../infrastructure/types.js";
import { listProjects } from "../project/project.js";
import { readProjectConfig } from "../project/project-config.js";
import { isStorybookInstalled } from "../make/component/storybook-service.js";
import { isStorybookRunning } from "../make/component/storybook-browser.js";

// ── Types ────────────────────────────────────────────────────────────

export interface StorybookStatus {
	readonly installed: boolean;
	readonly framework: string | null;
	readonly running: boolean;
	readonly url: string | null;
}

export interface ProjectSummary {
	readonly name: string;
	readonly type: string;
	readonly hasNote: boolean;
	readonly storybook: StorybookStatus;
}

export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
}

export interface ProjectApiDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
}

// ── Helpers ──────────────────────────────────────────────────────────

function detectStorybookStatus(
	projectPath: string,
	config: { components?: { storybook?: boolean; storybookDir?: string; framework?: string } } | null,
	deps: ProjectApiDeps,
): StorybookStatus {
	if (!config?.components) {
		return { installed: false, framework: null, running: false, url: null };
	}
	const componentsConfig = config.components as { storybook?: boolean; storybookDir?: string; framework?: ComponentFramework };
	const installed = isStorybookInstalled(projectPath, componentsConfig, deps);
	const framework = componentsConfig.framework ?? null;
	const running = isStorybookRunning();
	return { installed, framework, running, url: null };
}

function hasProjectNote(projectPath: string, projectName: string, deps: ProjectApiDeps): boolean {
	const notePath = deps.paths.join(projectPath, `${projectName}.md`);
	return deps.disk.existsSync(notePath);
}

// ── Public API ───────────────────────────────────────────────────────

/** List all projects with summary info. */
export function getProjectList(projectsDir: string, deps: ProjectApiDeps): { projects: ProjectSummary[] } {
	const names = listProjects(projectsDir, deps);
	const projects: ProjectSummary[] = names.map((name) => {
		const projectPath = deps.paths.join(projectsDir, name);
		const { config } = readProjectConfig(projectPath, deps);
		const type = config?.type ?? config?.name ?? "unknown";
		const storybook = detectStorybookStatus(projectPath, config, deps);
		return {
			name,
			type,
			hasNote: hasProjectNote(projectPath, name, deps),
			storybook,
		};
	});
	return { projects };
}

/** Get detail for a single project by name. */
export function getProjectDetail(
	projectName: string,
	projectsDir: string,
	deps: ProjectApiDeps,
): ProjectDetail | null {
	const projectPath = deps.paths.join(projectsDir, projectName);
	if (!deps.disk.existsSync(projectPath)) return null;

	const { config } = readProjectConfig(projectPath, deps);
	const type = config?.type ?? config?.name ?? "unknown";
	const noteExists = hasProjectNote(projectPath, projectName, deps);
	const notePath = noteExists ? deps.paths.join(projectPath, `${projectName}.md`) : null;
	const storybook = detectStorybookStatus(projectPath, config, deps);

	return {
		name: projectName,
		type,
		hasNote: noteExists,
		notePath,
		projectPath,
		storybook,
	};
}
