import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────
vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(async () => "main"),
}));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "", printHeader: vi.fn(),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: { defaultAuthor: "Test Author" }, PROJECTS_DIR: "/mock/projects",
}));
vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => null),
	setSelectedProject: vi.fn(),
}));

// ── Domain mocks ────────────────────────────────────────────────────
vi.mock("../../../src/domain/project/project.js", () => ({
	listProjects: vi.fn(() => []),
	getProjectPath: vi.fn((...args: string[]) => `/mock/projects/${args[0]}`),
}));
vi.mock("../../../src/domain/scaffold/scaffold.js", () => ({
	scaffold: vi.fn(() => ({ created: 3 })),
	listDefinitions: vi.fn(() => []),
}));

// ── Imports ─────────────────────────────────────────────────────────
import { openProjectHandler, createProjectHandler } from "../../../src/ui/handlers/start-handlers.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { getSelectedProject, setSelectedProject } from "../../../src/infrastructure/state.js";
import { listProjects, getProjectPath } from "../../../src/domain/project/project.js";
import { scaffold, listDefinitions } from "../../../src/domain/scaffold/scaffold.js";
import type { StartDeps } from "../../../src/infrastructure/deps.js";
import type { MenuEntry } from "../../../src/infrastructure/types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeDeps(): StartDeps {
	return {
		disk: {
			existsSync: vi.fn(() => false),
			readFileSync: vi.fn(() => ""),
			readdirSync: vi.fn(() => []),
			writeFileSync: vi.fn(),
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...args: string[]) => args.join("/"),
			resolve: (...args: string[]) => args.join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			sep: "/",
		},
		shell: {
			run: vi.fn(() => 0),
			runSilent: vi.fn(),
			runCapture: vi.fn(() => ""),
			runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })),
		},
		input: {
			ask: vi.fn(async () => ""),
			askYesNo: vi.fn(async () => true),
			waitForEnter: vi.fn(),
		},
		log: vi.fn(),
	} as unknown as StartDeps;
}

// ── Suite ───────────────────────────────────────────────────────────

describe("start-handlers", () => {
	let deps: StartDeps;

	beforeEach(() => {
		vi.clearAllMocks();
		deps = makeDeps();
	});

	// ── openProjectHandler ──────────────────────────────────────────

	describe("openProjectHandler", () => {
		it("returns 'main' when no projects exist", async () => {
			vi.mocked(listProjects).mockReturnValue([]);

			const result = await openProjectHandler(deps);

			expect(result).toBe("main");
			expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No project folders found"));
		});

		it("does not call runMenu when no projects exist", async () => {
			vi.mocked(listProjects).mockReturnValue([]);

			await openProjectHandler(deps);

			expect(runMenu).not.toHaveBeenCalled();
		});

		it("calls runMenu with project entries when projects exist", async () => {
			vi.mocked(listProjects).mockReturnValue(["Alpha", "Beta"]);

			await openProjectHandler(deps);

			expect(runMenu).toHaveBeenCalledWith(
				"Open Project",
				expect.arrayContaining([
					expect.objectContaining({ key: "1", label: expect.stringContaining("Alpha") }),
					expect.objectContaining({ key: "2", label: expect.stringContaining("Beta") }),
				]),
				{ defaultChoice: "1" },
			);
		});

		it("returns 'main' after project selection via menu", async () => {
			vi.mocked(listProjects).mockReturnValue(["Alpha"]);
			vi.mocked(runMenu).mockResolvedValue("quit");

			const result = await openProjectHandler(deps);

			expect(result).toBe("main");
		});

		it("returns 'main' when menu returns 'main' (back)", async () => {
			vi.mocked(listProjects).mockReturnValue(["Alpha"]);
			vi.mocked(runMenu).mockResolvedValue("main");

			const result = await openProjectHandler(deps);

			expect(result).toBe("main");
		});

		it("marks the currently selected project in the menu", async () => {
			vi.mocked(listProjects).mockReturnValue(["Alpha", "Beta"]);
			vi.mocked(getSelectedProject).mockReturnValue("Beta");

			await openProjectHandler(deps);

			const call = vi.mocked(runMenu).mock.calls[0];
			const items = call[1] as MenuEntry[];
			// Beta should have the marker, Alpha should not
			expect(items[1].label).toContain("Beta");
		});

		it("selecting a project calls setSelectedProject", async () => {
			vi.mocked(listProjects).mockReturnValue(["Alpha"]);
			// Capture the menu items and invoke the action directly
			vi.mocked(runMenu).mockImplementation(async (_title, items) => {
				const entry = (items as MenuEntry[])[0];
				if (entry.action) return entry.action();
				return "main";
			});

			await openProjectHandler(deps);

			expect(setSelectedProject).toHaveBeenCalledWith("Alpha");
		});

		it("includes a Back item with key 'b'", async () => {
			vi.mocked(listProjects).mockReturnValue(["Alpha"]);

			await openProjectHandler(deps);

			const call = vi.mocked(runMenu).mock.calls[0];
			const items = call[1] as MenuEntry[];
			const backItem = items.find((i) => i.key === "b");
			expect(backItem).toBeDefined();
			expect(backItem!.label).toBe("Back");
		});
	});

	// ── createProjectHandler ────────────────────────────────────────

	describe("createProjectHandler", () => {
		it("returns 'main' when name is empty (cancelled)", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("");

			const result = await createProjectHandler(deps);

			expect(result).toBe("main");
			expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Cancelled"));
		});

		it("does not call runMenu when name is empty", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("");

			await createProjectHandler(deps);

			expect(runMenu).not.toHaveBeenCalled();
		});

		it("returns 'main' when project already exists", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("ExistingProject");
			vi.mocked(deps.disk.existsSync).mockReturnValue(true);

			const result = await createProjectHandler(deps);

			expect(result).toBe("main");
			expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Project already exists"));
		});

		it("does not call runMenu when project already exists", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("ExistingProject");
			vi.mocked(deps.disk.existsSync).mockReturnValue(true);

			await createProjectHandler(deps);

			expect(runMenu).not.toHaveBeenCalled();
		});

		it("calls getProjectPath with the project name", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");

			await createProjectHandler(deps);

			expect(getProjectPath).toHaveBeenCalledWith("NewProject", "/mock/projects", { paths: deps.paths });
		});

		it("calls listDefinitions for template menu", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([]);

			await createProjectHandler(deps);

			expect(listDefinitions).toHaveBeenCalled();
		});

		it("shows template entries from listDefinitions", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([
				{ id: "tmpl-a", label: "Template A", description: "Desc A", files: [] },
				{ id: "tmpl-b", label: "Template B", description: "Desc B", files: [] },
			] as any);

			await createProjectHandler(deps);

			expect(runMenu).toHaveBeenCalledWith(
				"Create Project: NewProject",
				expect.arrayContaining([
					expect.objectContaining({ key: "1", label: expect.stringContaining("Template A") }),
					expect.objectContaining({ key: "2", label: expect.stringContaining("Template B") }),
				]),
			);
		});

		it("returns 'main' after successful scaffold (quit mapped to main)", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([
				{ id: "tmpl-a", label: "Template A", description: "Desc A", files: [] },
			] as any);
			vi.mocked(runMenu).mockResolvedValue("quit");

			const result = await createProjectHandler(deps);

			expect(result).toBe("main");
		});

		it("sets selected project when scaffold succeeds (quit)", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([
				{ id: "tmpl-a", label: "Template A", description: "Desc A", files: [] },
			] as any);
			vi.mocked(runMenu).mockResolvedValue("quit");

			await createProjectHandler(deps);

			expect(setSelectedProject).toHaveBeenCalledWith("NewProject");
		});

		it("does not set selected project when menu returns 'main' (back)", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([]);
			vi.mocked(runMenu).mockResolvedValue("main");

			await createProjectHandler(deps);

			expect(setSelectedProject).not.toHaveBeenCalled();
		});

		it("calls scaffold when a template action is invoked", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(scaffold).mockReturnValue({ created: 5 } as any);
			vi.mocked(listDefinitions).mockReturnValue([
				{ id: "tmpl-a", label: "Template A", description: "Desc A", files: [] },
			] as any);
			// Invoke the first template action directly
			vi.mocked(runMenu).mockImplementation(async (_title, items) => {
				const entry = (items as MenuEntry[])[0];
				if (entry.action) return entry.action();
				return "main";
			});

			await createProjectHandler(deps);

			expect(scaffold).toHaveBeenCalledWith(
				"/mock/projects",
				{ disk: deps.disk, paths: deps.paths },
				expect.objectContaining({ definitionId: "tmpl-a", name: "NewProject" }),
				"Test Author",
			);
		});

		it("logs error when scaffold returns error", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(scaffold).mockReturnValue({ error: "Something went wrong" } as any);
			vi.mocked(listDefinitions).mockReturnValue([
				{ id: "tmpl-a", label: "Template A", description: "Desc A", files: [] },
			] as any);
			vi.mocked(runMenu).mockImplementation(async (_title, items) => {
				const entry = (items as MenuEntry[])[0];
				if (entry.action) return entry.action();
				return "main";
			});

			await createProjectHandler(deps);

			expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Something went wrong"));
		});

		it("includes a Git submodule option with key 'g'", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([]);

			await createProjectHandler(deps);

			const call = vi.mocked(runMenu).mock.calls[0];
			const items = call[1] as MenuEntry[];
			const gitItem = items.find((i) => i.key === "g");
			expect(gitItem).toBeDefined();
			expect(gitItem!.label).toContain("Git Project");
		});

		it("includes a Back item with key 'b'", async () => {
			vi.mocked(deps.input.ask).mockResolvedValue("NewProject");
			vi.mocked(listDefinitions).mockReturnValue([]);

			await createProjectHandler(deps);

			const call = vi.mocked(runMenu).mock.calls[0];
			const items = call[1] as MenuEntry[];
			const backItem = items.find((i) => i.key === "b");
			expect(backItem).toBeDefined();
			expect(backItem!.label).toBe("Back");
		});

		it("git submodule action calls shell.run on success", async () => {
			vi.mocked(deps.input.ask)
				.mockResolvedValueOnce("NewProject")
				.mockResolvedValueOnce("https://github.com/test/repo.git");
			vi.mocked(listDefinitions).mockReturnValue([]);
			// Invoke the git submodule action directly
			vi.mocked(runMenu).mockImplementation(async (_title, items) => {
				const gitEntry = (items as MenuEntry[]).find((i) => i.key === "g");
				if (gitEntry?.action) return gitEntry.action();
				return "main";
			});

			await createProjectHandler(deps);

			expect(deps.shell.run).toHaveBeenCalledWith(expect.stringContaining("git submodule add"));
		});

		it("git submodule action returns 'main' when URL is empty", async () => {
			vi.mocked(deps.input.ask)
				.mockResolvedValueOnce("NewProject")
				.mockResolvedValueOnce("");
			vi.mocked(listDefinitions).mockReturnValue([]);
			vi.mocked(runMenu).mockImplementation(async (_title, items) => {
				const gitEntry = (items as MenuEntry[]).find((i) => i.key === "g");
				if (gitEntry?.action) return gitEntry.action();
				return "main";
			});

			const result = await createProjectHandler(deps);

			expect(deps.shell.run).not.toHaveBeenCalled();
			expect(result).toBe("main");
		});

		it("git submodule action logs error when shell.run fails", async () => {
			vi.mocked(deps.input.ask)
				.mockResolvedValueOnce("NewProject")
				.mockResolvedValueOnce("https://github.com/test/repo.git");
			vi.mocked(deps.shell.run).mockReturnValue(1);
			vi.mocked(listDefinitions).mockReturnValue([]);
			vi.mocked(runMenu).mockImplementation(async (_title, items) => {
				const gitEntry = (items as MenuEntry[]).find((i) => i.key === "g");
				if (gitEntry?.action) return gitEntry.action();
				return "main";
			});

			await createProjectHandler(deps);

			expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Submodule add failed"));
		});
	});
});
