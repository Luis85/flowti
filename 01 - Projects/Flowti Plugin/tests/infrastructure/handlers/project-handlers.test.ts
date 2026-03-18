// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-project-detail.js";
import { mountProjectDetail } from "../../../src/infrastructure/handlers/project-handlers.js";
import type { IProjectService } from "../../../src/domain/projects/types.js";

function mockService(): IProjectService {
	return {
		listProjects: vi.fn(async () => []),
		getProject: vi.fn(async () => ({
			name: "Alpha",
			type: "typescript",
			hasNote: true,
			notePath: "/projects/Alpha/Alpha.md",
			projectPath: "/projects/Alpha",
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null },
		})),
		installStorybook: vi.fn(async () => ({ ok: true })),
		startStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6006", pid: 123 })),
		stopStorybook: vi.fn(async () => ({ ok: true })),
		buildStorybook: vi.fn(async () => ({ ok: true, outputDir: "/path" })),
		scaffoldStorybook: vi.fn(async () => ({ ok: true, filesCreated: 5 })),
		importMarkdownSitemap: vi.fn(async (_p: string, _s: string) => ({ ok: true })),
	};
}

describe("mountProjectDetail", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => { container.remove(); });

	it("mounts flowti-project-detail element", () => {
		const dispose = mountProjectDetail(container, { projectService: mockService(), projectName: "Alpha" });
		expect(container.querySelector("flowti-project-detail")).not.toBeNull();
		dispose();
	});

	it("loads project data from service", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		await new Promise((r) => setTimeout(r, 10));
		expect(service.getProject).toHaveBeenCalledWith("Alpha");
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		expect(el.projectName).toBe("Alpha");
		expect(el.projectType).toBe("typescript");
	});

	it("forwards storybook-install to service", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "react" }, bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.installStorybook).toHaveBeenCalledWith("Alpha", "react");
	});

	it("forwards storybook-start and opens webviewer", async () => {
		const service = mockService();
		const openInWebviewer = vi.fn();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha", openInWebviewer });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.startStorybook).toHaveBeenCalledWith("Alpha");
		expect(openInWebviewer).toHaveBeenCalledWith("http://localhost:6006");
	});

	it("forwards storybook-stop to service", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("storybook-stop", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.stopStorybook).toHaveBeenCalledWith("Alpha");
	});

	it("forwards back-to-list to navigateBack", () => {
		const navigateBack = vi.fn();
		mountProjectDetail(container, { projectService: mockService(), projectName: "Alpha", navigateBack });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("back-to-list", { bubbles: true, composed: true }));
		expect(navigateBack).toHaveBeenCalled();
	});

	it("dispose removes element", () => {
		const dispose = mountProjectDetail(container, { projectService: mockService(), projectName: "Alpha" });
		dispose();
		expect(container.querySelector("flowti-project-detail")).toBeNull();
	});
});
