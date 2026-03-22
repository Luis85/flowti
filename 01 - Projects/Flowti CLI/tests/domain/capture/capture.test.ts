import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { initializeDeps } from "../../../src/infrastructure/command-engine.js";
import { createTestDeps } from "../../mocks/mock-deps.js";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	getCaptureDir: vi.fn((type: string) => type ? `/mock/vault/inbox/${type}` : "/mock/vault/inbox"),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2025-06-15T10:30:00.000Z", now: () => new Date("2025-06-15T10:30:00.000Z"), ms: () => 0, safeIso: () => "" },
}));

const capturedJson: unknown[] = [];
vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn((flags: Record<string, string | boolean>) => flags.format === "json" ? "json" : "text"),
	printOutput: vi.fn((fmt: string, data: unknown, render: () => void) => {
		if (fmt === "json") { capturedJson.push(data); } else { render(); }
	}),
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		relative: (_from: string, to: string) => to,
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		isAbsolute: (p: string) => p.startsWith("/"),
		cwd: () => "/mock",
		sep: "/",
	},
}));

vi.mock("../../../src/infrastructure/document.js", async () => {
	const { Document } = await vi.importActual<typeof import("../../../src/infrastructure/document.js")>("../../../src/infrastructure/document.js");
	return { Document };
});

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { cwd: () => "/mock", exit: vi.fn() },
}));

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import { log } from "../../../src/infrastructure/logger.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { commands } from "../../../src/controller/capture.controller.js";
import { searchCaptures } from "../../../src/domain/capture/capture.js";
import type { IFileSystem } from "../../../src/infrastructure/types.js";

const mockLog = log as ReturnType<typeof vi.fn>;

const mockGetCaptureDir = (type: string) => type ? `/mock/vault/inbox/${type}` : "/mock/vault/inbox";

function capDeps(fs: IFileSystem) {
	return { disk: fs, paths, clock } as const;
}

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(filesystemMod, { disk: mockFs });
	const deps = createTestDeps();
	(deps as unknown as Record<string, unknown>).disk = mockFs;
	(deps as unknown as Record<string, unknown>).log = log;
	initializeDeps(deps);
}

beforeEach(() => {
	vi.clearAllMocks();
	capturedJson.length = 0;
});

describe("commands['capture:idea']", () => {
	it("creates a file with the idea text", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: "My great idea" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("My great idea"));
		expect(created).toBeDefined();
	});

	it("truncates long idea titles to 60 chars", () => {
		const fs = createMockFs();
		setDisk(fs);
		const longText = "A".repeat(100);
		commands["capture:idea"]({ text: longText }, []);
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
		commands["capture:idea"]({}, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --text flag");
	});

	it("errors when --text is a boolean", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: true }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --text flag");
	});

	it("does not overwrite existing file", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/My idea.md": "existing",
		});
		setDisk(fs);
		commands["capture:idea"]({ text: "My idea" }, []);
		expect(fs.files.get("/mock/vault/inbox/idea/My idea.md")).toBe("existing");
	});
});

describe("commands['capture:note']", () => {
	it("creates a note file with the given type and title", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task", title: "Fix login" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Fix login"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).toContain("type: Task");
	});

	it("normalizes type casing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "BUG", title: "Crash" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Crash"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).toContain("type: Bug");
	});

	it("errors when --type is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ title: "No type" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("errors when --title is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("errors on invalid note type", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "invalid", title: "Test" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Invalid type");
	});

	it("accepts all valid note types", () => {
		const types = ["task", "bug", "note", "documentation", "idea"];
		for (const type of types) {
			const fs = createMockFs();
			setDisk(fs);
			commands["capture:note"]({ type, title: `Test-${type}` }, []);
			const files = [...fs.files.keys()];
			expect(files.some(f => f.includes(`Test-${type}`))).toBe(true);
		}
	});

	it("errors when --type is a boolean", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: true, title: "Test" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("errors when --title is a boolean", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task", title: true }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --type");
	});

	it("shows valid types in error message for invalid type", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "invalid", title: "Test" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Task");
		expect(output).toContain("Bug");
	});
});

describe("commands['capture:idea'] — filename sanitization", () => {
	it("strips special characters from filename", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: 'My idea: with "special" chars?' }, []);
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
		commands["capture:idea"]({ text: "idea   with   spaces" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		expect(created).toBeDefined();
		expect(created).not.toContain("   ");
	});

	it("limits filename to 80 characters", () => {
		const fs = createMockFs();
		setDisk(fs);
		const longText = "A".repeat(100);
		commands["capture:idea"]({ text: longText }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes(".md"));
		const basename = created!.split("/").pop()!.replace(".md", "");
		expect(basename.length).toBeLessThanOrEqual(80);
	});
});

// ── Tags ────────────────────────────────────────────────────────────

describe("capture:idea --tags", () => {
	it("adds tags to frontmatter", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: "Tagged idea", tags: "urgent,feature" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Tagged idea"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).toContain("urgent");
		expect(content).toContain("feature");
	});

	it("handles empty tags gracefully", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: "No tags" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("No tags"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).not.toContain("tags:");
	});

	it("trims whitespace from tags", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:idea"]({ text: "Spaced tags", tags: " urgent , bug " }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Spaced tags"));
		const content = fs.files.get(created!)!;
		expect(content).toContain("urgent");
		expect(content).toContain("bug");
	});
});

describe("capture:note --tags", () => {
	it("adds tags to note frontmatter", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:note"]({ type: "task", title: "Tagged task", tags: "p1,backend" }, []);
		const files = [...fs.files.keys()];
		const created = files.find(f => f.includes("Tagged task"));
		expect(created).toBeDefined();
		const content = fs.files.get(created!)!;
		expect(content).toContain("p1");
		expect(content).toContain("backend");
	});
});

// ── Search ──────────────────────────────────────────────────────────

describe("capture:search", () => {
	it("errors when --query is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:search"]({ }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --query flag");
	});

	it("returns results matching query", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/My great idea.md": "---\ntype: Idea\ndate: 2025-06-15\ntags:\n  - urgent\n---\n# My great idea\n\nSome body text",
			"/mock/vault/inbox/task/Fix login.md": "---\ntype: Task\ndate: 2025-06-15\n---\n# Fix login\n",
		});
		// readdirSync needs to handle the base dir and subdirs
		fs.dirs.add("/mock/vault/inbox");
		fs.dirs.add("/mock/vault/inbox/idea");
		fs.dirs.add("/mock/vault/inbox/task");
		setDisk(fs);
		const results = searchCaptures("/mock/vault", mockGetCaptureDir, capDeps(fs), "great");
		expect(results).toHaveLength(1);
		expect(results[0].title).toBe("My great idea");
		expect(results[0].type).toBe("Idea");
		expect(results[0].tags).toContain("urgent");
	});

	it("filters by type", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/Idea one.md": "---\ntype: Idea\ndate: 2025-06-15\n---\n# Idea one\n",
			"/mock/vault/inbox/task/Task one.md": "---\ntype: Task\ndate: 2025-06-15\n---\n# Task one\n",
		});
		fs.dirs.add("/mock/vault/inbox");
		fs.dirs.add("/mock/vault/inbox/idea");
		fs.dirs.add("/mock/vault/inbox/task");
		setDisk(fs);
		const results = searchCaptures("/mock/vault", mockGetCaptureDir, capDeps(fs), "one", "Idea");
		expect(results).toHaveLength(1);
		expect(results[0].type).toBe("Idea");
	});

	it("filters by tag", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/Tagged.md": "---\ntype: Idea\ndate: 2025-06-15\ntags:\n  - urgent\n---\n# Tagged\n",
			"/mock/vault/inbox/idea/Untagged.md": "---\ntype: Idea\ndate: 2025-06-15\n---\n# Untagged\n",
		});
		fs.dirs.add("/mock/vault/inbox");
		fs.dirs.add("/mock/vault/inbox/idea");
		setDisk(fs);
		const results = searchCaptures("/mock/vault", mockGetCaptureDir, capDeps(fs), "idea", undefined, "urgent");
		expect(results).toHaveLength(1);
		expect(results[0].title).toBe("Tagged");
	});

	it("returns empty for no matches", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/Something.md": "---\ntype: Idea\ndate: 2025-06-15\n---\n# Something\n",
		});
		fs.dirs.add("/mock/vault/inbox");
		fs.dirs.add("/mock/vault/inbox/idea");
		setDisk(fs);
		const results = searchCaptures("/mock/vault", mockGetCaptureDir, capDeps(fs), "nonexistent");
		expect(results).toHaveLength(0);
	});

	it("outputs JSON with --format=json", () => {
		const fs = createMockFs({
			"/mock/vault/inbox/idea/My idea.md": "---\ntype: Idea\ndate: 2025-06-15\n---\n# My idea\n",
		});
		fs.dirs.add("/mock/vault/inbox");
		fs.dirs.add("/mock/vault/inbox/idea");
		setDisk(fs);
		commands["capture:search"]({ query: "idea", format: "json" }, []);
		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("{"));
		expect(jsonLine).toBeDefined();
		const data = JSON.parse(jsonLine as string) as { query: string; results: Array<Record<string, unknown>> };
		expect(data.results).toHaveLength(1);
		expect(data.results[0].type).toBe("Idea");
	});
});

// ── Batch Import ────────────────────────────────────────────────────

describe("capture:import", () => {
	it("errors when --file is missing", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:import"]({ }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Missing --file flag");
	});

	it("errors when file does not exist", () => {
		const fs = createMockFs();
		setDisk(fs);
		commands["capture:import"]({ file: "/nope.json" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("File not found");
	});

	it("imports items from a JSON file", () => {
		const items = [
			{ type: "Idea", title: "First idea", body: "Details", tags: ["urgent"] },
			{ type: "Task", title: "Fix it", body: "" },
		];
		const fs = createMockFs({
			"/import.json": JSON.stringify(items),
		});
		setDisk(fs);
		commands["capture:import"]({ file: "/import.json" }, []);
		const files = [...fs.files.keys()];
		expect(files.some(f => f.includes("First idea"))).toBe(true);
		expect(files.some(f => f.includes("Fix it"))).toBe(true);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Imported 2 item");
	});

	it("skips items without title", () => {
		const items = [
			{ type: "Idea", title: "Good" },
			{ type: "Note" },
		];
		const fs = createMockFs({
			"/import.json": JSON.stringify(items),
		});
		setDisk(fs);
		commands["capture:import"]({ file: "/import.json" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Imported 1 item");
		expect(output).toContain("1 skipped");
	});

	it("errors on invalid JSON", () => {
		const fs = createMockFs({
			"/bad.json": "not json",
		});
		setDisk(fs);
		commands["capture:import"]({ file: "/bad.json" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Failed to parse JSON");
	});

	it("errors when JSON is not an array", () => {
		const fs = createMockFs({
			"/obj.json": JSON.stringify({ title: "not array" }),
		});
		setDisk(fs);
		commands["capture:import"]({ file: "/obj.json" }, []);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Expected a JSON array");
	});
});
