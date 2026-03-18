/**
 * HTTP-based IProjectService that talks to the Flowti CLI server.
 *
 * Endpoints:
 * - GET  /api/projects          → list all projects
 * - GET  /api/projects/:name    → project detail
 * - POST /api/storybook/install → install storybook
 * - POST /api/storybook/start   → start storybook dev server
 * - POST /api/storybook/stop    → stop storybook dev server
 * - POST /api/storybook/build   → build storybook
 * - POST /api/storybook/scaffold → scaffold storybook from sitemap
 */

import type {
	IProjectService, ProjectSummary, ProjectDetail,
	StorybookFramework,
} from "../../domain/projects/types.js";
import type { IHttpClient } from "../http/types.js";

export class HttpProjectService implements IProjectService {
	private readonly http: IHttpClient;
	private readonly baseUrl: string;

	constructor(http: IHttpClient, baseUrl: string) {
		this.http = http;
		this.baseUrl = baseUrl;
	}

	async listProjects(): Promise<ProjectSummary[]> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/projects`,
			method: "GET",
		});
		const body = res.json as { projects: ProjectSummary[] };
		return body.projects ?? [];
	}

	async getProject(name: string): Promise<ProjectDetail | undefined> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/projects/${encodeURIComponent(name)}`,
			method: "GET",
		});
		if (res.status === 404) return undefined;
		return res.json as ProjectDetail;
	}

	async installStorybook(
		project: string,
		framework: StorybookFramework,
	): Promise<{ ok: boolean; error?: string }> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/storybook/install`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ project, framework }),
		});
		return res.json as { ok: boolean; error?: string };
	}

	async startStorybook(
		project: string,
	): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/storybook/start`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ project }),
		});
		return res.json as { ok: boolean; url?: string; pid?: number; error?: string };
	}

	async stopStorybook(
		project: string,
	): Promise<{ ok: boolean; error?: string }> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/storybook/stop`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ project }),
		});
		return res.json as { ok: boolean; error?: string };
	}

	async buildStorybook(
		project: string,
	): Promise<{ ok: boolean; outputDir?: string; error?: string }> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/storybook/build`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ project }),
		});
		return res.json as { ok: boolean; outputDir?: string; error?: string };
	}

	async scaffoldStorybook(
		project: string,
	): Promise<{ ok: boolean; filesCreated?: number; error?: string }> {
		const res = await this.http.request({
			url: `${this.baseUrl}/api/storybook/scaffold`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ project }),
		});
		return res.json as { ok: boolean; filesCreated?: number; error?: string };
	}
}
