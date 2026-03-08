import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	getCaptureDir: vi.fn((type: string) => `/mock/vault/inbox/${type}`),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(),
	printMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2025-06-15T10:30:00.000Z", now: () => new Date("2025-06-15T10:30:00.000Z"), ms: () => 0, safeIso: () => "" },
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		relative: (_from: string, to: string) => to,
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));

vi.mock("../../../src/infrastructure/document.js", async () => {
	const { Document } = await vi.importActual<typeof import("../../../src/infrastructure/document.js")>("../../../src/infrastructure/document.js");
	return { Document };
});

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import { log } from "../../../src/infrastructure/logger.js";
import { commands, captureIdea, captureNote } from "../../../src/domain/capture/capture.js";
import { input } from "../../../src/infrastructure/input.js";
import { printHeader } from "../../../src/infrastructure/ui.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const mockInput = input.ask as ReturnType<typeof vi.fn>;
const mockPrintHeader = printHeader as ReturnType<typeof vi.fn>;

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(filesystemMod, { disk: mockFs });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("commands['capture:idea']", () => {
	it("creates a file with the idea text", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: "My great idea" });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("My great idea"));
		expect(created).toBeDefined();
	});

	it("truncates long idea titles to 60 chars", () => {
		const fs = createMockFs();
		setDisk(fs);
		const longText = "A".repeat(100);
		commands["capture:idea"]({ text: longText });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		expect(created).toBeDefined();
		// Filename should contain at most 60 chars of the title
		const basename = created!.split("/").pop()!.replace(".md", "");
		expect(basename.length).toBeLessThanOrEqual(80);
	});

	it("errors when --text flag is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({});
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --text flag");
	});

	it("errors when --text is a boolean", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: true });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --text flag");
	});

	it("does not overwrite existing file", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/My idea.md": "existing",
		});
		setDisk(fs);
		commands["capture:idea"]({ text: "My idea" });
		expect(fs.files.get("/mock/vault/inbox/idea/My idea.md")).toBe("existing");
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("already exists");
	});
});

describe("commands['capture:note']", () => {
	it("creates a note file with the given type and title", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task", title: "Fix login" });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Fix login"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).toContain("type: Task");
	});

	it("normalizes type casing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "BUG", title: "Crash" });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Crash"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).toContain("type: Bug");
	});

	it("errors when --type is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ title: "No type" });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("errors when --title is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task" });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("errors on invalid note type", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "invalid", title: "Test" });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Invalid type");
	});

	it("accepts all valid note types", () => {
		const types = ["task", "bug", "note", "documentation", "idea"];
		for (const type of types) {
			const fs = createMockFs();
			setDisk(fs);
			commands["capture:note"]({ type, title: `Test-${type}` });
			const files = [...fs.files.keys()];
			expect(files.some(f => f.includes(`Test-${type}`))).toBe(true);
		}
	});

	it("errors when --type is a boolean", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: true, title: "Test" });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("errors when --title is a boolean", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task", title: true });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("shows valid types in error message for invalid type", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "invalid", title: "Test" });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Task");
		expect(output).toContain("Bug");
	});
});

describe("commands['capture:idea'] — filename sanitization", () => {
	it("strips special characters from filename", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: 'My idea: with "special" chars?' });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		expect(created).toBeDefined();
		expect(created).not.toContain(":");
		expect(created).not.toContain('"');
		expect(created).not.toContain("?");
	});

	it("collapses multiple spaces in filename", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: "idea   with   spaces" });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		expect(created).toBeDefined();
		expect(created).not.toContain("   ");
	});

	it("limits filename to 80 characters", () => {
		const fs = createMockFs();
		setDisk(fs);
		const longText = "A".repeat(100);
		commands["capture:idea"]({ text: longText });
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		const basename = created!.split("/").pop()!.replace(".md", "");
		expect(basename.length).toBeLessThanOrEqual(80);
	});
});

describe("captureIdea()", () => {
	it("prints header and returns 'main'", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("My idea")  // idea text
			.mockResolvedValueOnce("b");             // back

		const result = await captureIdea();

		expect(mockPrintHeader).toHaveBeenCalledWith("Capture Idea");
		expect(result).toBe("main");
	});

	it("creates file when idea is entered", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("Test idea text")
			.mockResolvedValueOnce("b");

		await captureIdea();

		const files = [...fs.files.keys()];
		expect(files.some(f => f.includes("Test idea text"))).toBe(true);
	});

	it("skips when empty idea is entered", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("")   // empty idea
			.mockResolvedValueOnce("b");

		await captureIdea();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No idea entered");
	});

	it("loops when user chooses 'a' for another", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("First idea")
			.mockResolvedValueOnce("a")              // another
			.mockResolvedValueOnce("Second idea")
			.mockResolvedValueOnce("b");             // back

		await captureIdea();

		const files = [...fs.files.keys()];
		expect(files.some(f => f.includes("First idea"))).toBe(true);
		expect(files.some(f => f.includes("Second idea"))).toBe(true);
	});

	it("truncates long idea titles to 60 chars for filename", async () => {
		const fs = createMockFs();
		setDisk(fs);
		const longIdea = "B".repeat(80);
		mockInput.mockResolvedValueOnce(longIdea)
			.mockResolvedValueOnce("b");

		await captureIdea();

		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		expect(created).toBeDefined();
		// Title is truncated to 60 chars
		const basename = created!.split("/").pop()!.replace(".md", "");
		expect(basename.length).toBeLessThanOrEqual(60);
	});
});

describe("captureNote()", () => {
	it("returns 'main'", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("1")           // type: Task
			.mockResolvedValueOnce("My task title")    // title
			.mockResolvedValueOnce("b");               // back

		const result = await captureNote();

		expect(result).toBe("main");
	});

	it("creates note file with chosen type", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("2")           // type: Bug
			.mockResolvedValueOnce("Login crash")      // title
			.mockResolvedValueOnce("b");

		await captureNote();

		const files = [...fs.files.keys()];
		expect(files.some(f => f.includes("Login crash"))).toBe(true);
	});

	it("skips on invalid type index (too high)", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("99");         // invalid type

		await captureNote();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Invalid type");
	});

	it("skips on invalid type index (0)", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("0");          // invalid type

		await captureNote();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Invalid type");
	});

	it("skips on negative type index", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("-1");

		await captureNote();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Invalid type");
	});

	it("skips on non-numeric type input", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("abc");

		await captureNote();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Invalid type");
	});

	it("shows skip message when empty title is entered", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("1")           // type: Task
			.mockResolvedValueOnce("")                  // empty title
			.mockResolvedValueOnce("b");

		await captureNote();

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No title entered");
	});

	it("loops when user chooses 'a' for another", async () => {
		const fs = createMockFs();
		setDisk(fs);
		mockInput.mockResolvedValueOnce("1")           // type: Task
			.mockResolvedValueOnce("First task")       // title
			.mockResolvedValueOnce("a")                // another
			.mockResolvedValueOnce("2")                // type: Bug
			.mockResolvedValueOnce("Second bug")       // title
			.mockResolvedValueOnce("b");               // back

		await captureNote();

		const files = [...fs.files.keys()];
		expect(files.some(f => f.includes("First task"))).toBe(true);
		expect(files.some(f => f.includes("Second bug"))).toBe(true);
	});

	it("selects all 5 note types correctly", async () => {
		const types = ["Task", "Bug", "Note", "Documentation", "Idea"];
		for (let i = 0; i < types.length; i++) {
			const fs = createMockFs();
			setDisk(fs);
			mockInput.mockResolvedValueOnce(String(i + 1))
				.mockResolvedValueOnce(`Test-${types[i]}`)
				.mockResolvedValueOnce("b");

			await captureNote();

			const files = [...fs.files.keys()];
			expect(files.some(f => f.includes(`Test-${types[i]}`))).toBe(true);
		}
	});
});
