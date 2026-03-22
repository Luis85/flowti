// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectStorybookHandler } from "../../../src/infrastructure/handlers/project-storybook-handler.js";
import type { ProjectDetailElement, StorybookStatus, IProjectService } from "../../../src/domain/projects/types.js";

function mockService(): IProjectService {
	return {
		listProjects: vi.fn(async () => []),
		getProject: vi.fn(async () => ({
			name: "TestProj",
			type: "typescript",
			hasNote: true,
			notePath: "/p",
			projectPath: "/p",
			hasSitemap: false,
			hasCanvas: false,
			canvasChanged: false,
			storybook: { installed: true, framework: "react", running: false, url: null, pid: null, hasStaticBuild: false },
		})),
		installStorybook: vi.fn(async () => ({ ok: true })),
		startStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6006", pid: 123 })),
		stopStorybook: vi.fn(async () => ({ ok: true })),
		buildStorybook: vi.fn(async () => ({ ok: true, outputDir: "/path" })),
		scaffoldStorybook: vi.fn(async () => ({ ok: true, filesCreated: 5 })),
		importMarkdownSitemap: vi.fn(async () => ({ ok: true })),
		saveMarkdownSourceConfig: vi.fn(async () => ({ ok: true })),
		cleanStorybook: vi.fn(async () => ({ ok: true })),
		importCanvasSitemap: vi.fn(async () => ({ ok: true })),
		previewStorybook: vi.fn(async () => ({ ok: true, url: "http://localhost:6007" })),
		openStorybookUrl: vi.fn(async () => ({ ok: true })),
		stopPreview: vi.fn(async () => ({ ok: true })),
		generateSitemapCanvas: vi.fn(async () => ({ ok: true })),
		importFromGit: vi.fn(async () => ({ ok: true })),
		detectProject: vi.fn(async () => ({ ok: true, type: "typescript" })),
		bootstrapProject: vi.fn(async () => ({ ok: true })),
		createEmptyProject: vi.fn(async () => ({ ok: true })),
		getHealth: vi.fn(async () => ({ ok: true, score: { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 90, git: 80 } } })),
		getTodos: vi.fn(async () => ({ items: [], exists: false })),
		addTodo: vi.fn(async () => ({ ok: true })),
		toggleTodo: vi.fn(async () => ({ ok: true })),
		deleteTodo: vi.fn(async () => ({ ok: true })),
		listEntities: vi.fn(async () => []),
		createEntity: vi.fn(async () => ({ ok: true })),
		getReportGenerators: vi.fn(async () => []),
		runReport: vi.fn(async () => ({ ok: true })),
		runAllReports: vi.fn(async () => ({ ok: true })),
		listComponents: vi.fn(async () => []),
		listVaultAgents: vi.fn(async () => []),
		saveTeamRoster: vi.fn(async () => ({ ok: true })),
		createAgentFromRole: vi.fn(async () => ({ ok: true })),
	};
}

function mockElement(): ProjectDetailElement {
	const el = document.createElement("div") as unknown as ProjectDetailElement;
	el.storybookBusy = false;
	el.storybookBusyLabel = "";
	el.storybookOutput = [];
	el.storybookError = "";
	el.showScaffoldModal = false;
	el.components = [];
	el.config = undefined;
	el.storybook = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false } as StorybookStatus;
	return el;
}

const settle = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("ProjectStorybookHandler", () => {
	let el: ProjectDetailElement;
	let service: IProjectService;
	let ac: AbortController;
	let loadProject: ReturnType<typeof vi.fn<(name: string) => Promise<void>>>;
	let revealFolder: ReturnType<typeof vi.fn<(path: string) => void>>;
	let pickFolder: ReturnType<typeof vi.fn<() => Promise<string | null>>>;

	beforeEach(() => {
		el = mockElement();
		service = mockService();
		ac = new AbortController();
		loadProject = vi.fn(async (_name: string) => {});
		revealFolder = vi.fn((_path: string) => {});
		pickFolder = vi.fn(async () => "/picked/folder" as string | null);
	});

	function createHandler(): ProjectStorybookHandler {
		return new ProjectStorybookHandler({
			el,
			signal: ac.signal,
			projectService: service,
			getCurrentProject: () => "TestProj",
			loadProject,
			revealFolder,
			pickFolder,
		});
	}

	// ── storybook-install ────────────────────────────────────────────────────

	describe("storybook-install", () => {
		it("calls installStorybook with correct project and framework", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "react" } }));
			await settle();
			expect(service.installStorybook).toHaveBeenCalledWith("TestProj", "react", expect.any(Function));
		});

		it("sets storybookBusy true while running", () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" } }));
			expect(el.storybookBusy).toBe(true);
			expect(el.storybookBusyLabel).toBe("Installing Storybook…");
		});

		it("on success sets showScaffoldModal to true", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" } }));
			await settle();
			expect(el.showScaffoldModal).toBe(true);
		});

		it("on error sets storybookError", async () => {
			(service.installStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "npm failed" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" } }));
			await settle();
			expect(el.storybookError).toBe("npm failed");
			expect(el.showScaffoldModal).toBe(false);
		});

		it("on thrown error sets storybookError from message", async () => {
			(service.installStorybook as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("crash"));
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" } }));
			await settle();
			expect(el.storybookError).toBe("crash");
		});
	});

	// ── storybook-start ──────────────────────────────────────────────────────

	describe("storybook-start", () => {
		it("calls startStorybook", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-start"));
			await settle();
			expect(service.startStorybook).toHaveBeenCalledWith("TestProj", expect.any(Function));
		});

		it("sets storybookBusy true with Starting label", () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-start"));
			expect(el.storybookBusy).toBe(true);
			expect(el.storybookBusyLabel).toBe("Starting Storybook…");
		});

		it("the log callback appends to storybookOutput", async () => {
			(service.startStorybook as ReturnType<typeof vi.fn>).mockImplementation(async (_p: string, onOutput: (line: string) => void) => {
				onOutput("line 1");
				onOutput("line 2");
				return { ok: true };
			});
			// getProject returns running = false so poll resolves immediately
			(service.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({
				name: "TestProj", type: "typescript", hasNote: true, notePath: "/p",
				projectPath: "/p", hasSitemap: false, hasCanvas: false, canvasChanged: false,
				storybook: { installed: true, framework: "react", running: false, url: null, pid: null, hasStaticBuild: false },
			});
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-start"));
			await settle();
			expect(el.storybookOutput).toEqual(expect.arrayContaining(["line 1", "line 2"]));
		});

		it("on startStorybook failure calls endWork with error", async () => {
			(service.startStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "port in use" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-start"));
			await settle();
			expect(el.storybookBusy).toBe(false);
			expect(el.storybookError).toBe("port in use");
		});

		it("on success calls endWork and reloads project", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-start"));
			await settle();
			expect(el.storybookBusy).toBe(false);
			expect(loadProject).toHaveBeenCalledWith("TestProj");
		});

		it("on thrown error sets storybookError", async () => {
			(service.startStorybook as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-start"));
			await settle();
			expect(el.storybookError).toBe("boom");
		});
	});

	// ── storybook-stop ───────────────────────────────────────────────────────

	describe("storybook-stop", () => {
		it("calls stopStorybook", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-stop"));
			await settle();
			expect(service.stopStorybook).toHaveBeenCalledWith("TestProj");
		});

		it("on error sets storybookError", async () => {
			(service.stopStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "no pid" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-stop"));
			await settle();
			expect(el.storybookError).toBe("no pid");
		});

		it("on thrown error sets storybookError", async () => {
			(service.stopStorybook as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("kill failed"));
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-stop"));
			await settle();
			expect(el.storybookError).toBe("kill failed");
		});
	});

	// ── storybook-build ──────────────────────────────────────────────────────

	describe("storybook-build", () => {
		it("calls buildStorybook with log callback", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-build"));
			await settle();
			expect(service.buildStorybook).toHaveBeenCalledWith("TestProj", expect.any(Function));
		});

		it("sets busy state and clears on completion", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-build"));
			expect(el.storybookBusy).toBe(true);
			expect(el.storybookBusyLabel).toBe("Building Storybook…");
			await settle();
			expect(el.storybookBusy).toBe(false);
		});

		it("on error sets storybookError", async () => {
			(service.buildStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "build error" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-build"));
			await settle();
			expect(el.storybookError).toBe("build error");
		});

		it("on thrown error sets storybookError", async () => {
			(service.buildStorybook as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("esbuild fail"));
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-build"));
			await settle();
			expect(el.storybookError).toBe("esbuild fail");
		});
	});

	// ── storybook-import ─────────────────────────────────────────────────────

	describe("storybook-import", () => {
		it("with saved path calls importMarkdownSitemap directly", async () => {
			el.config = { markdownSource: { path: "/docs/md" } } as ProjectDetailElement["config"];
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-import"));
			await settle();
			expect(service.importMarkdownSitemap).toHaveBeenCalledWith("TestProj", "/docs/md", expect.any(Function));
			expect(pickFolder).not.toHaveBeenCalled();
		});

		it("without saved path calls pickFolder then importMarkdownSitemap", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-import"));
			await settle();
			expect(pickFolder).toHaveBeenCalled();
			expect(service.importMarkdownSitemap).toHaveBeenCalledWith("TestProj", "/picked/folder", expect.any(Function));
		});

		it("without saved path and pickFolder returns null does nothing", async () => {
			pickFolder.mockResolvedValue(null);
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-import"));
			await settle();
			expect(service.importMarkdownSitemap).not.toHaveBeenCalled();
		});

		it("on import error sets storybookError", async () => {
			el.config = { markdownSource: { path: "/docs" } } as ProjectDetailElement["config"];
			(service.importMarkdownSitemap as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "parse fail" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-import"));
			await settle();
			expect(el.storybookError).toBe("parse fail");
		});
	});

	// ── storybook-view ───────────────────────────────────────────────────────

	describe("storybook-view", () => {
		it("calls openStorybookUrl with URL from event detail", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-view", { detail: { url: "http://localhost:9009" } }));
			await settle();
			expect(service.openStorybookUrl).toHaveBeenCalledWith("TestProj", "http://localhost:9009", expect.any(Function));
		});

		it("defaults to http://localhost:6006 when no url in detail", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-view", { detail: {} }));
			await settle();
			expect(service.openStorybookUrl).toHaveBeenCalledWith("TestProj", "http://localhost:6006", expect.any(Function));
		});
	});

	// ── storybook-open-folder ────────────────────────────────────────────────

	describe("storybook-open-folder", () => {
		it("calls revealFolder with correct path", () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-open-folder"));
			expect(revealFolder).toHaveBeenCalledWith("01 - Projects/TestProj/components");
		});

		it("uses storybookDir from config when set", () => {
			el.config = { storybookDir: "stories" } as unknown as ProjectDetailElement["config"];
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-open-folder"));
			expect(revealFolder).toHaveBeenCalledWith("01 - Projects/TestProj/stories");
		});
	});

	// ── storybook-preview ────────────────────────────────────────────────────

	describe("storybook-preview", () => {
		it("calls previewStorybook then openStorybookUrl if url returned", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-preview"));
			await settle();
			expect(service.previewStorybook).toHaveBeenCalledWith("TestProj");
			expect(service.openStorybookUrl).toHaveBeenCalledWith("TestProj", "http://localhost:6007", expect.any(Function));
		});

		it("sets storybookError if preview returns error", async () => {
			(service.previewStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "no static build" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-preview"));
			await settle();
			expect(el.storybookError).toBe("no static build");
		});
	});

	// ── storybook-dismiss-output ─────────────────────────────────────────────

	describe("storybook-dismiss-output", () => {
		it("clears storybookOutput array", () => {
			createHandler();
			el.storybookOutput = ["line1", "line2"];
			el.dispatchEvent(new CustomEvent("storybook-dismiss-output"));
			expect(el.storybookOutput).toEqual([]);
		});
	});

	// ── storybook-dismiss-error ──────────────────────────────────────────────

	describe("storybook-dismiss-error", () => {
		it("clears storybookError", () => {
			createHandler();
			el.storybookError = "some error";
			el.dispatchEvent(new CustomEvent("storybook-dismiss-error"));
			expect(el.storybookError).toBe("");
		});
	});

	// ── storybook-canvas-import ──────────────────────────────────────────────

	describe("storybook-canvas-import", () => {
		it("calls importCanvasSitemap then listComponents", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-canvas-import"));
			await settle();
			expect(service.importCanvasSitemap).toHaveBeenCalledWith("TestProj", expect.any(Function));
			expect(service.listComponents).toHaveBeenCalledWith("TestProj");
		});

		it("on error sets storybookError", async () => {
			(service.importCanvasSitemap as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("canvas broken"));
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-canvas-import"));
			await settle();
			expect(el.storybookError).toBe("canvas broken");
		});
	});

	// ── components-refresh ───────────────────────────────────────────────────

	describe("components-refresh", () => {
		it("calls listComponents", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("components-refresh"));
			await settle();
			expect(service.listComponents).toHaveBeenCalledWith("TestProj");
		});
	});

	// ── scaffold-confirm ─────────────────────────────────────────────────────

	describe("scaffold-confirm", () => {
		it("basic scaffold calls scaffoldStorybook", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm"));
			await settle();
			expect(service.scaffoldStorybook).toHaveBeenCalledWith("TestProj", expect.any(Function), { adoptImport: true });
		});

		it("sets showScaffoldModal to false", async () => {
			el.showScaffoldModal = true;
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm"));
			expect(el.showScaffoldModal).toBe(false);
		});

		it("with canvasImport calls importCanvasSitemap first, then scaffoldStorybook", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm", { detail: { canvasImport: true } }));
			await settle();
			expect(service.importCanvasSitemap).toHaveBeenCalledWith("TestProj", expect.any(Function));
			expect(service.scaffoldStorybook).toHaveBeenCalledWith("TestProj", expect.any(Function), { adoptImport: true });
		});

		it("with canvasImport aborts if import fails", async () => {
			(service.importCanvasSitemap as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "no canvas" });
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm", { detail: { canvasImport: true } }));
			await settle();
			expect(service.scaffoldStorybook).not.toHaveBeenCalled();
			expect(el.storybookError).toBe("no canvas");
		});

		it("with importFirst calls importMarkdownSitemap first, then scaffoldStorybook", async () => {
			el.config = { markdownSource: { path: "/md/path" } } as ProjectDetailElement["config"];
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm", { detail: { importFirst: true } }));
			await settle();
			expect(service.importMarkdownSitemap).toHaveBeenCalledWith("TestProj", "/md/path", expect.any(Function));
			expect(service.scaffoldStorybook).toHaveBeenCalledWith("TestProj", expect.any(Function), { adoptImport: true });
		});

		it("with importFirst but no savedPath does nothing", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm", { detail: { importFirst: true } }));
			await settle();
			expect(service.importMarkdownSitemap).not.toHaveBeenCalled();
			expect(service.scaffoldStorybook).not.toHaveBeenCalled();
		});

		it("with importFirst aborts if import fails", async () => {
			el.config = { markdownSource: { path: "/md/path" } } as ProjectDetailElement["config"];
			(service.importMarkdownSitemap as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "md error" });
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-confirm", { detail: { importFirst: true } }));
			await settle();
			expect(service.scaffoldStorybook).not.toHaveBeenCalled();
			expect(el.storybookError).toBe("md error");
		});
	});

	// ── scaffold-dismiss ─────────────────────────────────────────────────────

	describe("scaffold-dismiss", () => {
		it("sets showScaffoldModal to false", () => {
			el.showScaffoldModal = true;
			createHandler();
			el.dispatchEvent(new CustomEvent("scaffold-dismiss"));
			expect(el.showScaffoldModal).toBe(false);
		});
	});

	// ── storybook-regenerate-confirmed ───────────────────────────────────────

	describe("storybook-regenerate-confirmed", () => {
		it("chains clean → install → scaffold", async () => {
			el.storybook = { installed: true, framework: "react", running: false, url: null, pid: null, hasStaticBuild: false } as StorybookStatus;
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed"));
			await settle(50);
			expect(service.cleanStorybook).toHaveBeenCalledWith("TestProj");
			expect(service.installStorybook).toHaveBeenCalledWith("TestProj", "react", expect.any(Function));
			expect(service.scaffoldStorybook).toHaveBeenCalledWith("TestProj", expect.any(Function), { adoptImport: true });
		});

		it("defaults framework to html when none set", async () => {
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed"));
			await settle(50);
			expect(service.installStorybook).toHaveBeenCalledWith("TestProj", "html", expect.any(Function));
		});

		it("aborts if clean fails", async () => {
			(service.cleanStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "clean error" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed"));
			await settle(50);
			expect(service.installStorybook).not.toHaveBeenCalled();
			expect(el.storybookError).toBe("clean error");
		});

		it("aborts if install fails", async () => {
			(service.installStorybook as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "install error" });
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed"));
			await settle(50);
			expect(service.cleanStorybook).toHaveBeenCalled();
			expect(service.scaffoldStorybook).not.toHaveBeenCalled();
			expect(el.storybookError).toBe("install error");
		});

		it("on thrown error sets storybookError", async () => {
			(service.cleanStorybook as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("unexpected"));
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-regenerate-confirmed"));
			await settle(50);
			expect(el.storybookError).toBe("Regeneration failed unexpectedly");
		});
	});

	// ── Signal abort ─────────────────────────────────────────────────────────

	describe("signal abort", () => {
		it("after aborting, dispatched events are no-ops", async () => {
			createHandler();
			ac.abort();
			el.dispatchEvent(new CustomEvent("storybook-install", { detail: { framework: "html" } }));
			el.dispatchEvent(new CustomEvent("storybook-stop"));
			el.dispatchEvent(new CustomEvent("storybook-build"));
			el.dispatchEvent(new CustomEvent("scaffold-confirm"));
			await settle();
			expect(service.installStorybook).not.toHaveBeenCalled();
			expect(service.stopStorybook).not.toHaveBeenCalled();
			expect(service.buildStorybook).not.toHaveBeenCalled();
			expect(service.scaffoldStorybook).not.toHaveBeenCalled();
		});
	});

	// ── Work-queue signal checks ─────────────────────────────────────────────

	describe("work-queue signal checks", () => {
		it("startWork is no-op when signal aborted", async () => {
			// Start a handler then abort, then trigger an event that would call startWork
			// We test this indirectly: if startWork is no-op, storybookBusy stays false
			createHandler();
			ac.abort();
			el.dispatchEvent(new CustomEvent("storybook-build"));
			expect(el.storybookBusy).toBe(false);
		});

		it("endWork is no-op when signal aborted mid-operation", async () => {
			// Use stopStorybook which only calls endWork (no extra side-effects after)
			let resolveStop: ((v: { ok: boolean; error?: string }) => void) | undefined;
			(service.stopStorybook as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise((r) => { resolveStop = r; }));
			createHandler();
			// Manually set busy to verify endWork won't clear it
			el.storybookBusy = true;
			el.dispatchEvent(new CustomEvent("storybook-stop"));
			ac.abort();
			resolveStop!({ ok: false, error: "should not appear" });
			await settle();
			// endWork should be no-op since aborted; storybookBusy stays true
			expect(el.storybookBusy).toBe(true);
			// error should not be set since endWork was no-op
			expect(el.storybookError).toBe("");
		});

		it("appendLog is no-op when signal aborted", async () => {
			let logFn: ((line: string) => void) | undefined;
			(service.buildStorybook as ReturnType<typeof vi.fn>).mockImplementation(async (_p: string, onOutput: (line: string) => void) => {
				logFn = onOutput;
				return { ok: true };
			});
			createHandler();
			el.dispatchEvent(new CustomEvent("storybook-build"));
			await settle();
			ac.abort();
			logFn!("should not appear");
			expect(el.storybookOutput).not.toContain("should not appear");
		});

		it("clearLogBuffer is no-op when signal aborted", () => {
			createHandler();
			el.storybookOutput = ["data"];
			ac.abort();
			el.dispatchEvent(new CustomEvent("storybook-dismiss-output"));
			// Because the listener itself checks signal.aborted, storybookOutput is unchanged
			expect(el.storybookOutput).toEqual(["data"]);
		});
	});
});
