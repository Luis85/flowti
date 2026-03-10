import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsCliAvailable = vi.fn();
const mockIsVaultInitialized = vi.fn();

vi.mock("../../../src/domain/knowledgebase/vault-service.js", () => ({
	isCliAvailable: () => mockIsCliAvailable(),
	isVaultInitialized: () => mockIsVaultInitialized(),
	listFolder: vi.fn(),
	readMarkdownFile: vi.fn(),
	searchVault: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	printHeader: vi.fn(),
	BOLD: "", RESET: "", DIM: "", CYAN: "", YELLOW: "", GREEN: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { isKnowledgebaseAvailable, knowledgebaseMenu } from "../../../src/domain/knowledgebase/knowledgebase.js";
import { listFolder, readMarkdownFile, searchVault } from "../../../src/domain/knowledgebase/vault-service.js";
import { input } from "../../../src/infrastructure/input.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockedListFolder = vi.mocked(listFolder);
const mockedReadMarkdownFile = vi.mocked(readMarkdownFile);
const mockedSearchVault = vi.mocked(searchVault);
const mockedAsk = vi.mocked(input.ask);
const mockedLog = vi.mocked(log);

describe("isKnowledgebaseAvailable", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns true when CLI is available and vault is initialized", () => {
		mockIsCliAvailable.mockReturnValue(true);
		mockIsVaultInitialized.mockReturnValue(true);
		expect(isKnowledgebaseAvailable()).toBe(true);
	});

	it("returns false when CLI is not available", () => {
		mockIsCliAvailable.mockReturnValue(false);
		mockIsVaultInitialized.mockReturnValue(true);
		expect(isKnowledgebaseAvailable()).toBe(false);
	});

	it("returns false when vault is not initialized", () => {
		mockIsCliAvailable.mockReturnValue(true);
		mockIsVaultInitialized.mockReturnValue(false);
		expect(isKnowledgebaseAvailable()).toBe(false);
	});

	it("returns false when both are unavailable", () => {
		mockIsCliAvailable.mockReturnValue(false);
		mockIsVaultInitialized.mockReturnValue(false);
		expect(isKnowledgebaseAvailable()).toBe(false);
	});
});

describe("knowledgebaseMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 'quit' when user types 'q'", async () => {
		mockedListFolder.mockReturnValue([]);
		mockedAsk.mockResolvedValueOnce("q");

		const result = await knowledgebaseMenu();
		expect(result).toBe("quit");
	});

	it("returns 'main' when user types 'b'", async () => {
		mockedListFolder.mockReturnValue([]);
		mockedAsk.mockResolvedValueOnce("b");

		const result = await knowledgebaseMenu();
		expect(result).toBe("main");
	});

	it("navigates into a folder when user selects a directory entry", async () => {
		// First listing: root has one folder
		mockedListFolder.mockReturnValueOnce([
			{ name: "subfolder", isDir: true },
		]);
		mockedAsk.mockResolvedValueOnce("1"); // select folder

		// Second listing: inside subfolder (empty), user quits
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		const result = await knowledgebaseMenu();
		expect(result).toBe("quit");
		expect(mockedListFolder).toHaveBeenCalledWith("");
		expect(mockedListFolder).toHaveBeenCalledWith("subfolder");
	});

	it("navigates up when user types 'u'", async () => {
		// Root listing with one folder
		mockedListFolder.mockReturnValueOnce([
			{ name: "subfolder", isDir: true },
		]);
		mockedAsk.mockResolvedValueOnce("1"); // enter subfolder

		// Inside subfolder
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("u"); // go up

		// Back at root
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q"); // quit

		const result = await knowledgebaseMenu();
		expect(result).toBe("quit");
		expect(mockedListFolder).toHaveBeenNthCalledWith(1, "");
		expect(mockedListFolder).toHaveBeenNthCalledWith(2, "subfolder");
		expect(mockedListFolder).toHaveBeenNthCalledWith(3, "");
	});

	it("shows empty folder message", async () => {
		mockedListFolder.mockReturnValue([]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("(empty folder)"))).toBe(true);
	});

	it("displays file content when user selects a file", async () => {
		mockedListFolder.mockReturnValueOnce([
			{ name: "readme.md", isDir: false },
		]);
		mockedAsk.mockResolvedValueOnce("1"); // select file

		mockedReadMarkdownFile.mockReturnValue("# Hello\nWorld");
		mockedAsk.mockResolvedValueOnce(""); // press enter to continue

		// Back to listing, then quit
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		const result = await knowledgebaseMenu();
		expect(result).toBe("quit");
		expect(mockedReadMarkdownFile).toHaveBeenCalledWith("readme.md");
	});

	it("displays file content stripping frontmatter", async () => {
		mockedListFolder.mockReturnValueOnce([
			{ name: "note.md", isDir: false },
		]);
		mockedAsk.mockResolvedValueOnce("1");

		mockedReadMarkdownFile.mockReturnValue("---\ntitle: Test\n---\n# Body\nContent here");
		mockedAsk.mockResolvedValueOnce(""); // press enter

		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]);
		// Body content should appear, frontmatter title should not
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("Content here"))).toBe(true);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("title: Test"))).toBe(false);
	});

	it("shows 'file not found' when readMarkdownFile returns falsy", async () => {
		mockedListFolder.mockReturnValueOnce([
			{ name: "missing.md", isDir: false },
		]);
		mockedAsk.mockResolvedValueOnce("1");

		mockedReadMarkdownFile.mockReturnValue("");

		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("File not found"))).toBe(true);
	});

	it("searches vault when user types 's'", async () => {
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("s"); // search mode

		mockedAsk.mockResolvedValueOnce("test query"); // search query
		mockedSearchVault.mockReturnValue(["result1.md", "result2.md"]);

		mockedAsk.mockResolvedValueOnce(""); // enter to go back

		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q"); // quit

		const result = await knowledgebaseMenu();
		expect(result).toBe("quit");
		expect(mockedSearchVault).toHaveBeenCalledWith("test query");
	});

	it("shows no results message when search finds nothing", async () => {
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("s");

		mockedAsk.mockResolvedValueOnce("nonexistent");
		mockedSearchVault.mockReturnValue([]);

		mockedAsk.mockResolvedValueOnce(""); // press enter to continue

		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("No results found"))).toBe(true);
	});

	it("opens a search result when user selects a number", async () => {
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("s");

		mockedAsk.mockResolvedValueOnce("query");
		mockedSearchVault.mockReturnValue(["found.md"]);

		mockedAsk.mockResolvedValueOnce("1"); // select first result
		mockedReadMarkdownFile.mockReturnValue("# Found\nContent");
		mockedAsk.mockResolvedValueOnce(""); // press enter after viewing

		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();
		expect(mockedReadMarkdownFile).toHaveBeenCalledWith("found.md");
	});

	it("handles invalid choice gracefully", async () => {
		mockedListFolder.mockReturnValueOnce([
			{ name: "folder", isDir: true },
		]);
		mockedAsk.mockResolvedValueOnce("999"); // invalid number

		mockedListFolder.mockReturnValueOnce([
			{ name: "folder", isDir: true },
		]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("Invalid choice"))).toBe(true);
	});

	it("resolves nested paths correctly when navigating multiple levels", async () => {
		// Root -> level1
		mockedListFolder.mockReturnValueOnce([{ name: "level1", isDir: true }]);
		mockedAsk.mockResolvedValueOnce("1");

		// level1 -> level2
		mockedListFolder.mockReturnValueOnce([{ name: "level2", isDir: true }]);
		mockedAsk.mockResolvedValueOnce("1");

		// level1/level2, then up
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("u");

		// Back at level1, quit
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		expect(mockedListFolder).toHaveBeenNthCalledWith(1, "");
		expect(mockedListFolder).toHaveBeenNthCalledWith(2, "level1");
		expect(mockedListFolder).toHaveBeenNthCalledWith(3, "level1/level2");
		expect(mockedListFolder).toHaveBeenNthCalledWith(4, "level1");
	});

	it("lists folders before files with correct numbering", async () => {
		mockedListFolder.mockReturnValueOnce([
			{ name: "docs", isDir: true },
			{ name: "notes.md", isDir: false },
			{ name: "archive", isDir: true },
		]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]).filter(Boolean);
		// Folders should appear with indices 1, 2 and files with index 3
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("1)") && msg.includes("docs/"))).toBe(true);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("2)") && msg.includes("archive/"))).toBe(true);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("3)") && msg.includes("notes"))).toBe(true);
	});

	it("filters out non-markdown files from listing", async () => {
		mockedListFolder.mockReturnValueOnce([
			{ name: "readme.md", isDir: false },
			{ name: "image.png", isDir: false },
			{ name: "data.json", isDir: false },
		]);
		mockedAsk.mockResolvedValueOnce("q");

		await knowledgebaseMenu();

		const logCalls = mockedLog.mock.calls.map((c) => c[0]).filter(Boolean);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("readme"))).toBe(true);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("image.png"))).toBe(false);
		expect(logCalls.some((msg) => typeof msg === "string" && msg.includes("data.json"))).toBe(false);
	});

	it("'b' at root returns to main menu", async () => {
		mockedListFolder.mockReturnValueOnce([]);
		mockedAsk.mockResolvedValueOnce("b");

		const result = await knowledgebaseMenu();

		expect(result).toBe("main");
		expect(mockedListFolder).toHaveBeenCalledTimes(1);
	});
});
