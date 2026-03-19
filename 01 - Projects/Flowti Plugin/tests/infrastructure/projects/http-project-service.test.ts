import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpProjectService } from "../../../src/infrastructure/projects/http-project-service";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(json: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(json),
	};
}

describe("HttpProjectService", () => {
	let service: HttpProjectService;

	beforeEach(() => {
		mockFetch.mockReset();
		service = new HttpProjectService("http://localhost:3000");
	});

	describe("listProjects", () => {
		it("fetches GET /api/projects and returns project array", async () => {
			const projects = [
				{ name: "Flowti CLI", type: "typescript-cli", hasNote: true, storybook: { installed: false, framework: null, running: false, url: null, pid: null } },
			];
			mockFetch.mockResolvedValueOnce(jsonResponse({ projects }));

			const result = await service.listProjects();

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/projects");
			expect(result).toEqual(projects);
		});

		it("returns empty array when projects field is missing", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({}));

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
				hasSitemap: true,
				storybook: { installed: true, framework: "react", running: false, url: null, pid: null },
			};
			mockFetch.mockResolvedValueOnce(jsonResponse(detail));

			const result = await service.getProject("Flowti CLI");

			expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/projects/Flowti%20CLI");
			expect(result).toEqual(detail);
		});

		it("returns undefined on 404", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));

			const result = await service.getProject("nonexistent");

			expect(result).toBeUndefined();
		});
	});

	describe("installStorybook", () => {
		it("posts to /api/storybook/install with project and framework", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

			const result = await service.installStorybook("Flowti CLI", "react");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/storybook/install",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ project: "Flowti CLI", framework: "react" }),
				},
			);
			expect(result).toEqual({ ok: true });
		});

		it("returns error response on failure", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Install failed"));

			const result = await service.installStorybook("Flowti CLI", "vue3");

			expect(result).toEqual({ ok: false, error: "Install failed" });
		});
	});

	describe("startStorybook", () => {
		it("posts to /api/storybook/start and returns url and pid", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, url: "http://localhost:6006", pid: 1234 }));

			const result = await service.startStorybook("Flowti CLI");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/storybook/start",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ project: "Flowti CLI" }),
				},
			);
			expect(result).toEqual({ ok: true, url: "http://localhost:6006", pid: 1234 });
		});
	});

	describe("stopStorybook", () => {
		it("posts to /api/storybook/stop", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

			const result = await service.stopStorybook("Flowti CLI");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/storybook/stop",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ project: "Flowti CLI" }),
				},
			);
			expect(result).toEqual({ ok: true });
		});
	});

	describe("buildStorybook", () => {
		it("posts to /api/storybook/build and returns outputDir", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, outputDir: "storybook-static" }));

			const result = await service.buildStorybook("Flowti CLI");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/storybook/build",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ project: "Flowti CLI" }),
				},
			);
			expect(result).toEqual({ ok: true, outputDir: "storybook-static" });
		});
	});

	describe("saveMarkdownSourceConfig", () => {
		it("posts to /api/storybook/config with project and config", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

			const result = await service.saveMarkdownSourceConfig("Flowti CLI", {
				path: "components",
				strategy: "category",
				requiredFields: ["name", "category", "description"],
			});

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/storybook/config",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						project: "Flowti CLI",
						config: { path: "components", strategy: "category", requiredFields: ["name", "category", "description"] },
					}),
				},
			);
			expect(result).toEqual({ ok: true });
		});
	});

	describe("scaffoldStorybook", () => {
		it("posts to /api/storybook/scaffold and returns filesCreated", async () => {
			mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, filesCreated: 12 }));

			const result = await service.scaffoldStorybook("Flowti CLI");

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:3000/api/storybook/scaffold",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ project: "Flowti CLI" }),
				},
			);
			expect(result).toEqual({ ok: true, filesCreated: 12 });
		});

		it("returns error response on failure", async () => {
			mockFetch.mockRejectedValueOnce(new Error("No sitemap found"));

			const result = await service.scaffoldStorybook("Flowti CLI");

			expect(result).toEqual({ ok: false, error: "No sitemap found" });
		});
	});
});
