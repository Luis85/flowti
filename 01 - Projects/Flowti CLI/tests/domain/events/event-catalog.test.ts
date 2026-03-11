import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
	printHeader: vi.fn(),
	printMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {
		ms: () => Date.now(),
		now: () => new Date(),
		iso: () => "2026-03-08T12:00:00.000Z",
		safeIso: () => "2026-03-08T12-00-00",
	},
}));

const mockFs: Record<string, string> = {};
const mockDirs = new Set<string>();

function normalize(p: string): string {
	return p.replace(/\\/g, "/");
}

function findFile(pattern: string): string | undefined {
	return Object.keys(mockFs).find((k) => normalize(k).includes(pattern));
}

function readMockFile(pattern: string): string {
	const key = findFile(pattern);
	if (!key) throw new Error(`No mock file matching "${pattern}"`);
	return mockFs[key];
}

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (p: string) => {
			const norm = p.replace(/\\/g, "/");
			for (const key of Object.keys(mockFs)) {
				if (key.replace(/\\/g, "/") === norm) return true;
			}
			for (const d of mockDirs) {
				if (d.replace(/\\/g, "/") === norm) return true;
			}
			if (norm.includes("config.json") || norm.includes("flowti-cli.config.json")) return true;
			return false;
		},
		readFileSync: (p: string) => {
			const norm = p.replace(/\\/g, "/");
			for (const [key, val] of Object.entries(mockFs)) {
				if (key.replace(/\\/g, "/") === norm) return val;
			}
			if (norm.includes("config.json")) return JSON.stringify({ name: "test" });
			return "";
		},
		writeFileSync: vi.fn((p: string, content: string) => {
			mockFs[normalize(p)] = content;
		}),
		mkdirSync: vi.fn((p: string) => {
			mockDirs.add(normalize(p));
		}),
		readdirSync: (p: string) => {
			const prefix = normalize(p);
			return Object.keys(mockFs)
				.map(normalize)
				.filter((k) => k.startsWith(prefix + "/") && !k.slice(prefix.length + 1).includes("/"))
				.map((k) => k.split("/").pop()!);
		},
		copyFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		relative: (from: string, to: string) => {
			const f = from.replace(/\\/g, "/").replace(/\/$/, "");
			const t = to.replace(/\\/g, "/");
			return t.startsWith(f + "/") ? t.slice(f.length + 1) : t;
		},
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		sep: "/",
	},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: {
		ask: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), cwd: () => "/mock" },
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn(() => "text"),
	printOutput: vi.fn((_f: string, _d: unknown, render: () => void) => render()),
}));

vi.mock("../../../src/domain/events/event-flow.js", () => ({
	saveEventFlowDoc: vi.fn(() => "/test/project/docs/events/flow.md"),
}));

vi.mock("../../../src/domain/events/event-contracts.js", () => ({
	loadEventContracts: vi.fn(() => []),
	validateContracts: vi.fn(() => ({ valid: true, issues: [] })),
	generateContractsJson: vi.fn(() => "{}"),
	validatePayload: vi.fn(() => ({ valid: true, errors: [] })),
	findContract: vi.fn(),
}));

vi.mock("../../../src/domain/events/event-codegen.js", () => ({
	generateEventTypes: vi.fn(() => ""),
}));

import { createEventFile, listEvents, type EventDefinition } from "../../../src/domain/events/event-catalog.js";
import { commands } from "../../../src/controller/events.controller.js";
import { parsePayloadFlag, collectPayloadFields, collectVersioningInfo } from "../../../src/domain/events/event-payload.js";
import { versionEvent } from "../../../src/domain/events/event-versioning.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";

const mockInput = input as { ask: ReturnType<typeof vi.fn> };
const eventDeps = { disk, paths, clock } as const;

function makeEventDef(overrides: Partial<EventDefinition> = {}): EventDefinition {
	return {
		name: "user.created",
		domain: "user",
		version: "1.0.0",
		description: "Emitted when a new user is created.",
		producers: ["AuthService"],
		consumers: ["NotificationService", "AnalyticsService"],
		payload: [
			{ name: "userId", type: "string", required: true, description: "The user ID" },
			{ name: "email", type: "string", required: true, description: "User email" },
			{ name: "timestamp", type: "string", required: false, description: "ISO timestamp" },
		],
		...overrides,
	};
}

beforeEach(() => {
	for (const key of Object.keys(mockFs)) delete mockFs[key];
	mockDirs.clear();
});

describe("createEventFile", () => {
	it("creates a markdown file in docs/events/", () => {
		const result = createEventFile(eventDeps, "/test/project", makeEventDef());
		expect(result).not.toBeNull();
		expect(normalize(result!)).toContain("docs/events/");
		expect(result).toMatch(/\.md$/);
	});

	it("generates valid frontmatter with event metadata", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("type: Event");
		expect(content).toContain("name: user.created");
		expect(content).toContain("domain: user");
		expect(content).toContain("version: 1.0.0");
		expect(content).toContain("status: draft");
		expect(content).toContain("producers: AuthService");
		expect(content).toContain("NotificationService, AnalyticsService");
	});

	it("includes heading and description", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("# user.created");
		expect(content).toContain("Emitted when a new user is created.");
	});

	it("renders producers and consumers sections", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Producers");
		expect(content).toContain("- AuthService");
		expect(content).toContain("## Consumers");
		expect(content).toContain("- NotificationService");
		expect(content).toContain("- AnalyticsService");
	});

	it("renders payload table", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Payload");
		expect(content).toContain("| Field | Type | Required | Description |");
		expect(content).toContain("| userId | string | yes | The user ID |");
		expect(content).toContain("| email | string | yes | User email |");
		expect(content).toContain("| timestamp | string | no | ISO timestamp |");
	});

	it("includes bridging sections for components, journeys, and related files", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Related Components");
		expect(content).toContain("## Journeys");
		expect(content).toContain("## Related Files");
	});

	it("adds wikilinks to sibling test files when they exist", () => {
		// Seed a test file for user.created
		mockFs["/test/project/tests/user.created.test.ts"] = "test content";
		mockDirs.add("/test/project/tests");
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[tests/user.created.test.ts|Test]]");
	});

	it("adds wikilinks to sibling source files when they exist", () => {
		mockFs["/test/project/src/user.created.ts"] = "source content";
		mockDirs.add("/test/project/src");
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[src/user.created.ts|Source]]");
	});

	it("adds wikilinks to config files when they exist", () => {
		mockFs["/test/project/configs/user.created.json"] = "{}";
		mockDirs.add("/test/project/configs");
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[configs/user.created.json|Config]]");
	});

	it("adds wikilinks to component definition files when they exist", () => {
		mockFs["/test/project/src/components/user.created/user.created.json"] = "{}";
		mockDirs.add("/test/project/src/components/user.created");
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[src/components/user.created/user.created.json|Definition]]");
	});

	it("shows placeholder when no sibling files exist", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("<!-- Related test, source, config, and definition files will be linked here. -->");
	});

	it("returns null if event already exists", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const result = createEventFile(eventDeps, "/test/project", makeEventDef());
		expect(result).toBeNull();
	});

	it("handles events with no producers, consumers, or payload", () => {
		const def = makeEventDef({ producers: [], consumers: [], payload: [], description: "" });
		const result = createEventFile(eventDeps, "/test/project", def);
		expect(result).not.toBeNull();

		const content = readMockFile("docs/events/");

		expect(content).toContain("## Producers");
		expect(content).toContain("<!-- List systems/services that emit this event. -->");
		expect(content).toContain("## Consumers");
		expect(content).toContain("<!-- List systems/services that subscribe to this event. -->");
		expect(content).toContain("## Payload");
		expect(content).toContain("<!-- Define the event payload fields. -->");
	});

	it("creates the docs/events directory if it does not exist", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		expect(mockDirs.size).toBeGreaterThan(0);
	});
});

describe("listEvents", () => {
	it("returns empty array when no events exist", () => {
		const events = listEvents(eventDeps, "/test/project");
		expect(events).toEqual([]);
	});

	it("lists events from markdown files", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "user.created", domain: "user" }));
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "order.placed", domain: "order" }));

		const events = listEvents(eventDeps, "/test/project");

		expect(events).toHaveLength(2);
		expect(events.map((e) => e.name)).toContain("user.created");
		expect(events.map((e) => e.name)).toContain("order.placed");
	});

	it("returns events sorted by name", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "z-event", domain: "z" }));
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "a-event", domain: "a" }));

		const events = listEvents(eventDeps, "/test/project");
		expect(events[0].name).toBe("a-event");
		expect(events[1].name).toBe("z-event");
	});

	it("extracts domain and version from frontmatter", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "test.event", domain: "core", version: "2.0.0" }));

		const events = listEvents(eventDeps, "/test/project");
		expect(events[0].domain).toBe("core");
		expect(events[0].version).toBe("2.0.0");
	});
});

// ── Payload field tests ───────────────────────────────────────────

describe("parsePayloadFlag", () => {
	it("parses a single field definition", () => {
		const fields = parsePayloadFlag("userId:string:required:The user ID");
		expect(fields).toHaveLength(1);
		expect(fields[0]).toEqual({
			name: "userId",
			type: "string",
			required: true,
			description: "The user ID",
		});
	});

	it("parses multiple comma-separated fields", () => {
		const fields = parsePayloadFlag("userId:string:required:The user ID,email:string:required:User email");
		expect(fields).toHaveLength(2);
		expect(fields[0].name).toBe("userId");
		expect(fields[1].name).toBe("email");
		expect(fields[1].required).toBe(true);
	});

	it("defaults to string type for invalid types", () => {
		const fields = parsePayloadFlag("data:unknown:optional:Some data");
		expect(fields[0].type).toBe("string");
	});

	it("marks fields as not required when not 'required'", () => {
		const fields = parsePayloadFlag("data:string:optional:Some data");
		expect(fields[0].required).toBe(false);
	});

	it("handles all valid field types", () => {
		for (const type of ["string", "number", "boolean", "object", "array"]) {
			const fields = parsePayloadFlag(`field:${type}:required:desc`);
			expect(fields[0].type).toBe(type);
		}
	});

	it("filters out empty field names", () => {
		const fields = parsePayloadFlag(":string:required:desc");
		expect(fields).toHaveLength(0);
	});
});

describe("collectPayloadFields (interactive)", () => {
	it("returns empty array when user declines", async () => {
		mockInput.ask.mockResolvedValueOnce("n");
		const fields = await collectPayloadFields(input);
		expect(fields).toEqual([]);
	});

	it("collects a single payload field", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Y")       // Add payload fields?
			.mockResolvedValueOnce("userId")   // Field name
			.mockResolvedValueOnce("string")   // Type
			.mockResolvedValueOnce("Y")        // Required?
			.mockResolvedValueOnce("The user ID") // Description
			.mockResolvedValueOnce("n");       // Add another?

		const fields = await collectPayloadFields(input);
		expect(fields).toHaveLength(1);
		expect(fields[0]).toEqual({
			name: "userId",
			type: "string",
			required: true,
			description: "The user ID",
		});
	});

	it("collects multiple payload fields", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Y")       // Add payload fields?
			.mockResolvedValueOnce("userId")   // Field 1 name
			.mockResolvedValueOnce("string")   // Field 1 type
			.mockResolvedValueOnce("Y")        // Field 1 required
			.mockResolvedValueOnce("ID")       // Field 1 desc
			.mockResolvedValueOnce("Y")        // Add another?
			.mockResolvedValueOnce("age")      // Field 2 name
			.mockResolvedValueOnce("number")   // Field 2 type
			.mockResolvedValueOnce("n")        // Field 2 not required
			.mockResolvedValueOnce("Age")      // Field 2 desc
			.mockResolvedValueOnce("n");       // No more

		const fields = await collectPayloadFields(input);
		expect(fields).toHaveLength(2);
		expect(fields[1].type).toBe("number");
		expect(fields[1].required).toBe(false);
	});

	it("stops when field name is empty", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Y")  // Add payload fields?
			.mockResolvedValueOnce("");   // Empty field name = stop

		const fields = await collectPayloadFields(input);
		expect(fields).toEqual([]);
	});
});

describe("collectVersioningInfo (interactive)", () => {
	it("returns empty when user declines", async () => {
		mockInput.ask.mockResolvedValueOnce("N");
		const info = await collectVersioningInfo(input);
		expect(info).toEqual({});
	});

	it("collects previous version and migration notes", async () => {
		mockInput.ask
			.mockResolvedValueOnce("y")                  // Is new version?
			.mockResolvedValueOnce("1.0.0")              // Previous version
			.mockResolvedValueOnce("Added email field");  // Migration notes

		const info = await collectVersioningInfo(input);
		expect(info).toEqual({
			previousVersion: "1.0.0",
			migrationNotes: "Added email field",
		});
	});
});

// ── Version history tests ─────────────────────────────────────────

describe("version history in createEventFile", () => {
	it("renders Version History section with current version", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Version History");
		expect(content).toContain("**v1.0.0**");
		expect(content).toContain("2026-03-08");
	});

	it("includes migration notes when previousVersion is set", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({
			name: "user.updated",
			version: "2.0.0",
			previousVersion: "1.0.0",
			migrationNotes: "Added email field",
		}));
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Version History");
		expect(content).toContain("**v2.0.0**");
		expect(content).toContain("Migrated from v1.0.0: Added email field");
	});

	it("includes previous_version and migration_notes in frontmatter", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({
			name: "user.v2",
			version: "2.0.0",
			previousVersion: "1.0.0",
			migrationNotes: "Breaking change",
		}));
		const content = readMockFile("docs/events/");

		expect(content).toContain("previous_version: 1.0.0");
		expect(content).toContain("migration_notes: Breaking change");
	});

	it("does not include previous_version in frontmatter when not set", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).not.toContain("previous_version:");
		expect(content).not.toContain("migration_notes:");
	});
});

// ── events:version command tests ──────────────────────────────────

describe("versionEvent", () => {
	it("updates version in frontmatter of existing event", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "user.created" }));
		const result = versionEvent(eventDeps, "/test/project", "user.created", "2.0.0", "Added email field");

		expect(result.success).toBe(true);
		const content = readMockFile("docs/events/");
		expect(content).toContain("version: 2.0.0");
		expect(content).toContain("previous_version: 1.0.0");
		expect(content).toContain("migration_notes: Added email field");
	});

	it("appends to Version History section", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "order.placed" }));
		versionEvent(eventDeps, "/test/project", "order.placed", "2.0.0", "Added tracking field");

		const content = readMockFile("docs/events/");
		expect(content).toContain("## Version History");
		expect(content).toContain("**v2.0.0**");
		expect(content).toContain("Migrated from v1.0.0: Added tracking field");
	});

	it("returns failure when event does not exist", () => {
		const result = versionEvent(eventDeps, "/test/project", "nonexistent.event", "2.0.0", "notes");
		expect(result.success).toBe(false);
	});
});

// ── Non-interactive --payload flag tests ──────────────────────────

describe("events:add --payload flag", () => {
	it("creates event with payload fields from --payload flag", () => {
		const handler = commands["events:add"];
		const project = { path: "/test/project", pkg: null, config: { name: "test" }, scripts: {} };

		handler(
			{
				name: "order.placed",
				domain: "order",
				payload: "orderId:string:required:The order ID,total:number:required:Order total",
			},
			[], undefined, project,
		);

		const content = readMockFile("docs/events/");
		expect(content).toContain("| orderId | string | yes | The order ID |");
		expect(content).toContain("| total | number | yes | Order total |");
	});

	it("creates event without payload when --payload flag is missing", () => {
		const handler = commands["events:add"];
		const project = { path: "/test/project", pkg: null, config: { name: "test" }, scripts: {} };

		handler({ name: "simple.event", domain: "core" }, [], undefined, project);

		const content = readMockFile("docs/events/");
		expect(content).toContain("## Payload");
		expect(content).toContain("<!-- Define the event payload fields. -->");
	});
});

// ── events:version command handler tests ──────────────────────────

describe("events:version command", () => {
	it("is registered in commands", () => {
		expect(commands["events:version"]).toBeDefined();
	});

	it("updates event version via command handler", () => {
		createEventFile(eventDeps, "/test/project", makeEventDef({ name: "cmd.event" }));
		const project = { path: "/test/project", pkg: null, config: { name: "test" }, scripts: {} };

		commands["events:version"](
			{ name: "cmd.event", version: "3.0.0", migration: "Major rewrite" },
			[], undefined, project,
		);

		const content = readMockFile("docs/events/");
		expect(content).toContain("version: 3.0.0");
		expect(content).toContain("previous_version: 1.0.0");
		expect(content).toContain("migration_notes: Major rewrite");
	});
});
