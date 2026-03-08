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

import { createEventFile, listEvents, type EventDefinition } from "../../../src/domain/events/event-catalog.js";

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
		const result = createEventFile("/test/project", makeEventDef());
		expect(result).not.toBeNull();
		expect(normalize(result!)).toContain("docs/events/");
		expect(result).toMatch(/\.md$/);
	});

	it("generates valid frontmatter with event metadata", () => {
		createEventFile("/test/project", makeEventDef());
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
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("# user.created");
		expect(content).toContain("Emitted when a new user is created.");
	});

	it("renders producers and consumers sections", () => {
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Producers");
		expect(content).toContain("- AuthService");
		expect(content).toContain("## Consumers");
		expect(content).toContain("- NotificationService");
		expect(content).toContain("- AnalyticsService");
	});

	it("renders payload table", () => {
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Payload");
		expect(content).toContain("| Field | Type | Required | Description |");
		expect(content).toContain("| userId | string | yes | The user ID |");
		expect(content).toContain("| email | string | yes | User email |");
		expect(content).toContain("| timestamp | string | no | ISO timestamp |");
	});

	it("includes bridging sections for components, journeys, and related files", () => {
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("## Related Components");
		expect(content).toContain("## Journeys");
		expect(content).toContain("## Related Files");
	});

	it("adds wikilinks to sibling test files when they exist", () => {
		// Seed a test file for user.created
		mockFs["/test/project/tests/user.created.test.ts"] = "test content";
		mockDirs.add("/test/project/tests");
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[tests/user.created.test.ts|Test]]");
	});

	it("adds wikilinks to sibling source files when they exist", () => {
		mockFs["/test/project/src/user.created.ts"] = "source content";
		mockDirs.add("/test/project/src");
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[src/user.created.ts|Source]]");
	});

	it("adds wikilinks to config files when they exist", () => {
		mockFs["/test/project/configs/user.created.json"] = "{}";
		mockDirs.add("/test/project/configs");
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[configs/user.created.json|Config]]");
	});

	it("adds wikilinks to component definition files when they exist", () => {
		mockFs["/test/project/src/components/user.created/user.created.json"] = "{}";
		mockDirs.add("/test/project/src/components/user.created");
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("[[src/components/user.created/user.created.json|Definition]]");
	});

	it("shows placeholder when no sibling files exist", () => {
		createEventFile("/test/project", makeEventDef());
		const content = readMockFile("docs/events/");

		expect(content).toContain("<!-- Related test, source, config, and definition files will be linked here. -->");
	});

	it("returns null if event already exists", () => {
		createEventFile("/test/project", makeEventDef());
		const result = createEventFile("/test/project", makeEventDef());
		expect(result).toBeNull();
	});

	it("handles events with no producers, consumers, or payload", () => {
		const def = makeEventDef({ producers: [], consumers: [], payload: [], description: "" });
		const result = createEventFile("/test/project", def);
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
		createEventFile("/test/project", makeEventDef());
		expect(mockDirs.size).toBeGreaterThan(0);
	});
});

describe("listEvents", () => {
	it("returns empty array when no events exist", () => {
		const events = listEvents("/test/project");
		expect(events).toEqual([]);
	});

	it("lists events from markdown files", () => {
		createEventFile("/test/project", makeEventDef({ name: "user.created", domain: "user" }));
		createEventFile("/test/project", makeEventDef({ name: "order.placed", domain: "order" }));

		const events = listEvents("/test/project");

		expect(events).toHaveLength(2);
		expect(events.map((e) => e.name)).toContain("user.created");
		expect(events.map((e) => e.name)).toContain("order.placed");
	});

	it("returns events sorted by name", () => {
		createEventFile("/test/project", makeEventDef({ name: "z-event", domain: "z" }));
		createEventFile("/test/project", makeEventDef({ name: "a-event", domain: "a" }));

		const events = listEvents("/test/project");
		expect(events[0].name).toBe("a-event");
		expect(events[1].name).toBe("z-event");
	});

	it("extracts domain and version from frontmatter", () => {
		createEventFile("/test/project", makeEventDef({ name: "test.event", domain: "core", version: "2.0.0" }));

		const events = listEvents("/test/project");
		expect(events[0].domain).toBe("core");
		expect(events[0].version).toBe("2.0.0");
	});
});
