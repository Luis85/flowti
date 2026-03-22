import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readdirSync: vi.fn(() => []),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
	},
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-09T12:00:00.000Z" },
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", RED: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

// ── Import after mocks ──────────────────────────────────────────────

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { versionEvent, renderVersionHistory } from "../../../src/domain/events/event-versioning.js";

const mockDisk = vi.mocked(disk);
const verDeps = { disk, paths, clock } as const;

beforeEach(() => {
	vi.clearAllMocks();
});

// ── versionEvent ─────────────────────────────────────────────────────

describe("versionEvent", () => {
	it("returns failure when events directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		const result = versionEvent(verDeps, "/proj", "user.created", "2.0.0", "Added email");
		expect(result.success).toBe(false);
		expect(result.error).toContain("No events directory");
	});

	it("returns failure when event name is not found", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["other-event.md"] as never);
		mockDisk.readFileSync.mockReturnValue("---\nname: other.event\nversion: 1.0.0\n---\n" as never);
		const result = versionEvent(verDeps, "/proj", "user.created", "2.0.0", "Added email");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Event not found");
	});

	it("updates the version in frontmatter", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-created.md"] as never);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: user.created\nversion: 1.0.0\n---\n\n# user.created\n" as never as never,
		);

		const result = versionEvent(verDeps, "/proj", "user.created", "2.0.0", "Added email field");

		expect(result.success).toBe(true);
		expect(result.previousVersion).toBe("1.0.0");
		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("version: 2.0.0");
		expect(written).toContain("previous_version: 1.0.0");
		expect(written).toContain("migration_notes: Added email field");
	});

	it("appends version history section when none exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-created.md"] as never);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: user.created\nversion: 1.0.0\n---\n\n# user.created\n" as never as never,
		);

		versionEvent(verDeps, "/proj", "user.created", "2.0.0", "Changed payload");

		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("## Version History");
		expect(written).toContain("**v2.0.0**");
		expect(written).toContain("Migrated from v1.0.0: Changed payload");
	});

	it("prepends to existing version history", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-created.md"] as never);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: user.created\nversion: 1.0.0\n---\n\n# user.created\n\n## Version History\n\n- **v1.0.0** — 2026-01-01\n" as never as never,
		);

		versionEvent(verDeps, "/proj", "user.created", "2.0.0", "Changed payload");

		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("**v2.0.0**");
		// New entry should come before old entry
		const v2Pos = written.indexOf("v2.0.0");
		const v1Pos = written.indexOf("v1.0.0", written.indexOf("## Version History"));
		expect(v2Pos).toBeLessThan(v1Pos);
	});

	it("removes old previous_version and migration_notes before adding new", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-created.md"] as never);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: user.created\nversion: 1.5.0\nprevious_version: 1.0.0\nmigration_notes: Old notes\n---\n\n# user.created\n" as never as never,
		);

		versionEvent(verDeps, "/proj", "user.created", "2.0.0", "New notes");

		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).not.toContain("Old notes");
		expect(written).toContain("previous_version: 1.5.0");
		expect(written).toContain("migration_notes: New notes");
	});
});

// ── renderVersionHistory ─────────────────────────────────────────────

describe("renderVersionHistory", () => {
	it("renders version history into document", () => {
		const calls: Array<{ method: string; args: unknown[] }> = [];
		const doc = {
			heading: (level: number, text: string) => { calls.push({ method: "heading", args: [level, text] }); return doc; },
			addBlank: () => { calls.push({ method: "addBlank", args: [] }); return doc; },
			text: (t: string) => { calls.push({ method: "text", args: [t] }); return doc; },
		};

		renderVersionHistory(verDeps, doc as never, {
			name: "test.event", domain: "test", version: "1.0.0",
			description: "", producers: [], consumers: [], payload: [],
		});

		expect(calls[0]).toEqual({ method: "heading", args: [2, "Version History"] });
		const textCalls = calls.filter((c) => c.method === "text");
		expect((textCalls[0].args[0] as string)).toContain("v1.0.0");
	});

	it("includes migration info when previousVersion and migrationNotes present", () => {
		const texts: string[] = [];
		const doc = {
			heading: () => doc,
			addBlank: () => doc,
			text: (t: string) => { texts.push(t); return doc; },
		};

		renderVersionHistory(verDeps, doc as never, {
			name: "test.event", domain: "test", version: "2.0.0",
			description: "", producers: [], consumers: [], payload: [],
			previousVersion: "1.0.0", migrationNotes: "Added field",
		});

		expect(texts.some((t) => t.includes("v1.0.0") && t.includes("Added field"))).toBe(true);
	});
});
