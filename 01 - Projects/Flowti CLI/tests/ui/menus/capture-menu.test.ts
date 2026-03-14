import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printMenu: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	getCaptureDir: vi.fn((type: string) => `/vault/inbox/${type}`),
}));
vi.mock("../../../src/domain/capture/capture.js", () => ({
	createCaptureFile: vi.fn(),
	NOTE_TYPES: ["Task", "Bug", "Note", "Documentation", "Idea"],
}));

import { printHeader } from "../../../src/infrastructure/ui.js";
import { getCaptureDir } from "../../../src/infrastructure/config.js";
import { createCaptureFile } from "../../../src/domain/capture/capture.js";
import { captureIdea, captureNote, captureBug } from "../../../src/ui/menus/capture-menu.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";

const mockCreateCapture = vi.mocked(createCaptureFile);
const mockGetCaptureDir = vi.mocked(getCaptureDir);
const mockPrintHeader = vi.mocked(printHeader);

const logs: string[] = [];
const mockDeps: MenuDeps = {
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) } as any,
	paths: { join: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "" } as any,
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" } as any,
	input: { ask: vi.fn(), waitForEnter: vi.fn(), askYesNo: vi.fn() } as any,
	log: ((...args: unknown[]) => { logs.push(String(args[0] ?? "")); }) as any,
};

const mockInput = vi.mocked(mockDeps.input);

function output(): string {
	return logs.join("\n");
}

beforeEach(() => {
	vi.clearAllMocks();
	logs.length = 0;
});

// ── captureIdea ─────────────────────────────────────────────────────

describe("captureIdea", () => {
	it("returns 'main'", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My great idea")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/idea/My great idea.md");

		const result = await captureIdea(mockDeps);

		expect(result).toBe("main");
	});

	it("calls printHeader with 'Capture Idea'", async () => {
		mockInput.ask
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("b");

		await captureIdea(mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Capture Idea");
	});

	it("creates capture file when idea is entered", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My great idea")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/idea/My great idea.md");

		await captureIdea(mockDeps);

		expect(mockGetCaptureDir).toHaveBeenCalledWith("idea");
		expect(mockCreateCapture).toHaveBeenCalledWith(
			"/vault/inbox/idea", mockDeps, "Idea", "My great idea", "My great idea",
		);
		expect(output()).toContain("Created:");
	});

	it("truncates long idea titles to 60 chars", async () => {
		const longIdea = "A".repeat(80);
		mockInput.ask
			.mockResolvedValueOnce(longIdea)
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/idea/file.md");

		await captureIdea(mockDeps);

		const title = mockCreateCapture.mock.calls[0][3];
		expect(title.length).toBeLessThanOrEqual(60);
	});

	it("logs skipped message when idea is empty", async () => {
		mockInput.ask
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("b");

		await captureIdea(mockDeps);

		expect(output()).toContain("No idea entered");
		expect(mockCreateCapture).not.toHaveBeenCalled();
	});

	it("logs exists message when createCaptureFile returns null", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Existing idea")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue(null);

		await captureIdea(mockDeps);

		expect(output()).toContain("File already exists");
	});

	it("loops when user chooses 'a' for another", async () => {
		mockInput.ask
			.mockResolvedValueOnce("First idea")
			.mockResolvedValueOnce("a")
			.mockResolvedValueOnce("Second idea")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/file.md");

		await captureIdea(mockDeps);

		expect(mockCreateCapture).toHaveBeenCalledTimes(2);
	});
});

// ── captureNote ─────────────────────────────────────────────────────

describe("captureNote", () => {
	it("returns 'main'", async () => {
		// Type=3 (Note), title, back
		mockInput.ask
			.mockResolvedValueOnce("3")
			.mockResolvedValueOnce("My note title")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/note/file.md");

		const result = await captureNote(mockDeps);

		expect(result).toBe("main");
	});

	it("creates capture file with selected type", async () => {
		// Type=1 (Task)
		mockInput.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("Fix login")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/task/file.md");

		await captureNote(mockDeps);

		expect(mockGetCaptureDir).toHaveBeenCalledWith("task");
		expect(mockCreateCapture).toHaveBeenCalledWith(
			"/vault/inbox/task", mockDeps, "Task", "Fix login", "",
		);
		expect(output()).toContain("Created:");
	});

	it("logs skipped when invalid type is entered", async () => {
		mockInput.ask.mockResolvedValueOnce("99");

		await captureNote(mockDeps);

		expect(output()).toContain("Invalid type");
		expect(mockCreateCapture).not.toHaveBeenCalled();
	});

	it("logs skipped when non-numeric type is entered", async () => {
		mockInput.ask.mockResolvedValueOnce("abc");

		await captureNote(mockDeps);

		expect(output()).toContain("Invalid type");
	});

	it("logs skipped when title is empty", async () => {
		mockInput.ask
			.mockResolvedValueOnce("3")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("b");

		await captureNote(mockDeps);

		expect(output()).toContain("No title entered");
		expect(mockCreateCapture).not.toHaveBeenCalled();
	});

	it("logs exists message when createCaptureFile returns null", async () => {
		mockInput.ask
			.mockResolvedValueOnce("3")
			.mockResolvedValueOnce("Existing note")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue(null);

		await captureNote(mockDeps);

		expect(output()).toContain("File already exists");
	});

	it("loops when user chooses 'a' for another", async () => {
		mockInput.ask
			.mockResolvedValueOnce("3")
			.mockResolvedValueOnce("First note")
			.mockResolvedValueOnce("a")
			.mockResolvedValueOnce("2")
			.mockResolvedValueOnce("Second note")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/file.md");

		await captureNote(mockDeps);

		expect(mockCreateCapture).toHaveBeenCalledTimes(2);
	});
});

// ── captureBug ──────────────────────────────────────────────────────

describe("captureBug", () => {
	it("returns 'main'", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Login crash")
			.mockResolvedValueOnce("Crashes on submit")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/bug/file.md");

		const result = await captureBug(mockDeps);

		expect(result).toBe("main");
	});

	it("calls printHeader with 'Capture Bug'", async () => {
		mockInput.ask
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("b");

		await captureBug(mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Capture Bug");
	});

	it("creates capture file with title and description", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Login crash")
			.mockResolvedValueOnce("Crashes on submit")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/bug/file.md");

		await captureBug(mockDeps);

		expect(mockGetCaptureDir).toHaveBeenCalledWith("bug");
		expect(mockCreateCapture).toHaveBeenCalledWith(
			"/vault/inbox/bug", mockDeps, "Bug", "Login crash", "Crashes on submit",
		);
		expect(output()).toContain("Created:");
	});

	it("creates capture file with empty description when none provided", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Login crash")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/inbox/bug/file.md");

		await captureBug(mockDeps);

		expect(mockCreateCapture).toHaveBeenCalledWith(
			"/vault/inbox/bug", mockDeps, "Bug", "Login crash", "",
		);
	});

	it("logs skipped when title is empty", async () => {
		mockInput.ask
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("b");

		await captureBug(mockDeps);

		expect(output()).toContain("No title entered");
		expect(mockCreateCapture).not.toHaveBeenCalled();
	});

	it("logs exists message when createCaptureFile returns null", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Existing bug")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue(null);

		await captureBug(mockDeps);

		expect(output()).toContain("File already exists");
	});

	it("loops when user chooses 'a' for another", async () => {
		mockInput.ask
			.mockResolvedValueOnce("First bug")
			.mockResolvedValueOnce("desc1")
			.mockResolvedValueOnce("a")
			.mockResolvedValueOnce("Second bug")
			.mockResolvedValueOnce("desc2")
			.mockResolvedValueOnce("b");
		mockCreateCapture.mockReturnValue("/vault/file.md");

		await captureBug(mockDeps);

		expect(mockCreateCapture).toHaveBeenCalledTimes(2);
	});
});
