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
			hasSitemap: false,
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null, hasStaticBuild: false },
		})),
		installStorybook: vi.fn(async () => ({ ok: true })),
		startStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6006", pid: 123 })),
		stopStorybook: vi.fn(async () => ({ ok: true })),
		buildStorybook: vi.fn(async () => ({ ok: true, outputDir: "/path" })),
		scaffoldStorybook: vi.fn(async () => ({ ok: true, filesCreated: 5 })),
		importMarkdownSitemap: vi.fn(async (_p: string, _s: string) => ({ ok: true })),
		saveMarkdownSourceConfig: vi.fn(async () => ({ ok: true })),
		cleanStorybook: vi.fn(async () => ({ ok: true })),
		previewStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6007" })),
		stopPreview: vi.fn(async () => ({ ok: true })),
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
		expect(service.installStorybook).toHaveBeenCalledWith("Alpha", "react", expect.any(Function));
	});

	it("forwards storybook-start to service", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.startStorybook).toHaveBeenCalledWith("Alpha", expect.any(Function));
	});

	it("forwards storybook-stop to service", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("storybook-stop", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.stopStorybook).toHaveBeenCalledWith("Alpha");
	});

	it("forwards back-to-list and reloads project list", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		// Wait for initial loadProject to complete before dispatching back-to-list
		await new Promise((r) => setTimeout(r, 20));
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("back-to-list", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 20));
		expect(el.projectName).toBe("");
		expect(service.listProjects).toHaveBeenCalled();
	});

	it("forwards config-save to saveMarkdownSourceConfig", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement;
		el.dispatchEvent(new CustomEvent("config-save", {
			detail: { path: "components", strategy: "flat", requiredFields: ["name", "category"] },
			bubbles: true, composed: true,
		}));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.saveMarkdownSourceConfig).toHaveBeenCalledWith(
			"Alpha",
			{ path: "components", strategy: "flat", requiredFields: ["name", "category"] },
			expect.any(Function),
		);
	});

	it("install success shows scaffold modal instead of starting", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" }, bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(el.showScaffoldModal).toBe(true);
		expect(service.startStorybook).not.toHaveBeenCalled();
	});

	it("scaffold-confirm triggers scaffold", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("scaffold-confirm", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(service.scaffoldStorybook).toHaveBeenCalled();
	});

	it("scaffold-dismiss hides modal without starting", async () => {
		const service = mockService();
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.showScaffoldModal = true;
		el.dispatchEvent(new CustomEvent("scaffold-dismiss", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 10));
		expect(el.showScaffoldModal).toBe(false);
		expect(service.startStorybook).not.toHaveBeenCalled();
	});

	it("storybook-regenerate-confirmed chains clean → install → scaffold", async () => {
		const service = mockService();
		(service.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({
			name: "Alpha", type: "typescript", hasNote: true, notePath: "/p",
			projectPath: "/p", hasSitemap: true,
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null, hasStaticBuild: false },
		});
		mountProjectDetail(container, { projectService: service, projectName: "Alpha" });
		const el = container.querySelector("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed", { bubbles: true, composed: true }));
		await new Promise((r) => setTimeout(r, 50));
		expect(service.cleanStorybook).toHaveBeenCalledWith("Alpha");
		expect(service.installStorybook).toHaveBeenCalled();
		expect(service.scaffoldStorybook).toHaveBeenCalled();
	});

	it("dispose removes element", () => {
		const dispose = mountProjectDetail(container, { projectService: mockService(), projectName: "Alpha" });
		dispose();
		expect(container.querySelector("flowti-project-detail")).toBeNull();
	});
});
