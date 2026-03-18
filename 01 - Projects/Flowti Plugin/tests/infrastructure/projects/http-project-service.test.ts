import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpProjectService } from "../../../src/infrastructure/projects/http-project-service";
import type { IHttpClient, HttpRequestOptions, HttpResponse } from "../../../src/infrastructure/http/types";

function mockHttp(): IHttpClient & { request: ReturnType<typeof vi.fn> } {
	return { request: vi.fn() };
}

function jsonResponse(json: unknown, status = 200): HttpResponse {
	return { json, status, headers: {} };
}

describe("HttpProjectService", () => {
	let http: ReturnType<typeof mockHttp>;
	let service: HttpProjectService;

	beforeEach(() => {
		http = mockHttp();
		service = new HttpProjectService(http, "http://localhost:3000");
	});

	describe("listProjects", () => {
		it("fetches GET /api/projects and returns project array", async () => {
			const projects = [
				{ name: "Flowti CLI", type: "typescript-cli", hasNote: true, storybook: { installed: false, framework: null, running: false, url: null, pid: null } },
			];
			http.request.mockResolvedValueOnce(jsonResponse({ projects }));

			const result = await service.listProjects();

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/projects",
				method: "GET",
			});
			expect(result).toEqual(projects);
		});

		it("returns empty array when projects field is missing", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({}));

			const result = await service.listProjects();

			expect(result).toEqual([]);
		});
	});

	describe("getProject", () => {
		it("fetches GET /api/projects/:name and returns detail", async () => {
			const detail = {
				name: "Flowti CLI", type: "typescript-cli", hasNote: true,
				notePath: "01 - Projects/Flowti CLI/Flowti CLI.md",
				projectPath: "01 - Projects/Flowti CLI",
				storybook: { installed: true, framework: "react", running: false, url: null, pid: null },
			};
			http.request.mockResolvedValueOnce(jsonResponse(detail));

			const result = await service.getProject("Flowti CLI");

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/projects/Flowti%20CLI",
				method: "GET",
			});
			expect(result).toEqual(detail);
		});

		it("returns undefined on 404", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));

			const result = await service.getProject("nonexistent");

			expect(result).toBeUndefined();
		});
	});

	describe("installStorybook", () => {
		it("posts to /api/storybook/install with project and framework", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: true }));

			const result = await service.installStorybook("Flowti CLI", "react");

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/storybook/install",
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ project: "Flowti CLI", framework: "react" }),
			});
			expect(result).toEqual({ ok: true });
		});

		it("returns error response on failure", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Install failed" }));

			const result = await service.installStorybook("Flowti CLI", "vue");

			expect(result).toEqual({ ok: false, error: "Install failed" });
		});
	});

	describe("startStorybook", () => {
		it("posts to /api/storybook/start and returns url and pid", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: true, url: "http://localhost:6006", pid: 1234 }));

			const result = await service.startStorybook("Flowti CLI");

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/storybook/start",
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ project: "Flowti CLI" }),
			});
			expect(result).toEqual({ ok: true, url: "http://localhost:6006", pid: 1234 });
		});
	});

	describe("stopStorybook", () => {
		it("posts to /api/storybook/stop", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: true }));

			const result = await service.stopStorybook("Flowti CLI");

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/storybook/stop",
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ project: "Flowti CLI" }),
			});
			expect(result).toEqual({ ok: true });
		});
	});

	describe("buildStorybook", () => {
		it("posts to /api/storybook/build and returns outputDir", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: true, outputDir: "storybook-static" }));

			const result = await service.buildStorybook("Flowti CLI");

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/storybook/build",
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ project: "Flowti CLI" }),
			});
			expect(result).toEqual({ ok: true, outputDir: "storybook-static" });
		});
	});

	describe("scaffoldStorybook", () => {
		it("posts to /api/storybook/scaffold and returns filesCreated", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: true, filesCreated: 12 }));

			const result = await service.scaffoldStorybook("Flowti CLI");

			expect(http.request).toHaveBeenCalledWith({
				url: "http://localhost:3000/api/storybook/scaffold",
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ project: "Flowti CLI" }),
			});
			expect(result).toEqual({ ok: true, filesCreated: 12 });
		});

		it("returns error response on failure", async () => {
			http.request.mockResolvedValueOnce(jsonResponse({ ok: false, error: "No sitemap found" }));

			const result = await service.scaffoldStorybook("Flowti CLI");

			expect(result).toEqual({ ok: false, error: "No sitemap found" });
		});
	});
});
