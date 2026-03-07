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

vi.mock("../../../src/infrastructure/readline.js", () => ({
	createRL: vi.fn(),
	ask: vi.fn(),
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(),
	printMenu: vi.fn(),
}));

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import { log } from "../../../src/infrastructure/logger.js";
import { commands } from "../../../src/domain/capture/capture.js";

const mockLog = log as ReturnType<typeof vi.fn>;

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(filesystemMod, { disk: mockFs });
}

beforeEach(() => {
	mockLog.mockClear();
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
});
