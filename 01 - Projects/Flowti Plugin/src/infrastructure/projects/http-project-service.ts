/**
 * HTTP-based project service that talks to the Flowti CLI server.
 * Uses fetch directly — no abstraction layer.
 */

import type {
	IProjectService, ProjectSummary, ProjectDetail,
	StorybookFramework,
} from "../../domain/projects/types.js";

interface ApiResult { ok: boolean; error?: string; [key: string]: unknown }

export class HttpProjectService implements IProjectService {
	private readonly baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async listProjects(): Promise<ProjectSummary[]> {
		try {
			const res = await fetch(`${this.baseUrl}/api/projects`);
			if (!res.ok) return [];
			const data = await res.json() as { projects: ProjectSummary[] };
			return data.projects ?? [];
		} catch { return []; }
	}

	async getProject(name: string): Promise<ProjectDetail | undefined> {
		try {
			const res = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(name)}`);
			if (!res.ok) return undefined;
			return await res.json() as ProjectDetail;
		} catch { return undefined; }
	}

	async installStorybook(project: string, framework: StorybookFramework): Promise<ApiResult> {
		return this.post("/api/storybook/install", { project, framework });
	}

	async startStorybook(project: string): Promise<ApiResult & { url?: string; pid?: number }> {
		return this.post("/api/storybook/start", { project });
	}

	async stopStorybook(project: string): Promise<ApiResult> {
		return this.post("/api/storybook/stop", { project });
	}

	async buildStorybook(project: string): Promise<ApiResult & { outputDir?: string }> {
		return this.post("/api/storybook/build", { project });
	}

	async scaffoldStorybook(project: string): Promise<ApiResult & { filesCreated?: number }> {
		return this.post("/api/storybook/scaffold", { project });
	}

	async importMarkdownSitemap(project: string): Promise<ApiResult> {
		return this.post("/api/storybook/import", { project });
	}

	private async post(path: string, body: Record<string, unknown>): Promise<ApiResult> {
		try {
			const res = await fetch(`${this.baseUrl}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			return await res.json() as ApiResult;
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : "Network error" };
		}
	}
}
