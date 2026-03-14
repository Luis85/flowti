import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/events/event-catalog.js", () => ({
	listEvents: vi.fn(() => []),
	createEventFile: vi.fn(),
	parseCommaSeparated: vi.fn((s: string) => s ? s.split(",").map((x: string) => x.trim()) : []),
}));
vi.mock("../../../src/domain/events/event-payload.js", () => ({
	collectPayloadFields: vi.fn(async () => []),
	collectVersioningInfo: vi.fn(async () => ({})),
}));

import { listEvents, createEventFile } from "../../../src/domain/events/event-catalog.js";
import { collectPayloadFields, collectVersioningInfo } from "../../../src/domain/events/event-payload.js";
import { addEventInteractive, listEventsInteractive } from "../../../src/ui/menus/event-catalog-menu.js";

const mockListEvents = vi.mocked(listEvents);
const mockCreateEventFile = vi.mocked(createEventFile);
const mockCollectPayloadFields = vi.mocked(collectPayloadFields);
const mockCollectVersioningInfo = vi.mocked(collectVersioningInfo);

function makeDeps() {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), readdirSync: vi.fn(), mkdirSync: vi.fn() },
		paths: {
			join: vi.fn((...args: string[]) => args.join("/")),
			resolve: vi.fn((p: string) => p),
			relative: vi.fn((_from: string, to: string) => to),
			dirname: vi.fn(),
		},
		clock: { now: vi.fn(() => new Date("2026-01-01")), iso: vi.fn(() => "2026-01-01T00:00:00Z") },
		input: { ask: vi.fn(), choose: vi.fn(), confirm: vi.fn(), waitForEnter: vi.fn() },
		log: vi.fn(),
	} as any;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("addEventInteractive", () => {
	it("returns early when name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");

		await addEventInteractive("/project", deps);

		expect(mockCreateEventFile).not.toHaveBeenCalled();
	});

	it("creates an event on valid input", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("UserCreated")        // name
			.mockResolvedValueOnce("auth")               // domain
			.mockResolvedValueOnce("1.0.0")              // version
			.mockResolvedValueOnce("User was created")   // description
			.mockResolvedValueOnce("AuthService")        // producers
			.mockResolvedValueOnce("NotificationSvc");   // consumers

		mockCollectPayloadFields.mockResolvedValue([{ name: "userId", type: "string", required: true, description: "" }]);
		mockCollectVersioningInfo.mockResolvedValue({});
		mockCreateEventFile.mockReturnValue("/project/docs/events/user-created.md");

		await addEventInteractive("/project", deps);

		expect(mockCreateEventFile).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "UserCreated",
			domain: "auth",
			version: "1.0.0",
			description: "User was created",
		}));
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Created"));
	});

	it("does not log when createEventFile returns falsy", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Evt")
			.mockResolvedValueOnce("core")
			.mockResolvedValueOnce("1.0.0")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");

		mockCollectPayloadFields.mockResolvedValue([]);
		mockCollectVersioningInfo.mockResolvedValue({});
		mockCreateEventFile.mockReturnValue(undefined as any);

		await addEventInteractive("/project", deps);

		expect(mockCreateEventFile).toHaveBeenCalled();
		// Only the printHeader call happens; no "Created" log
		const createdCalls = (deps.log as ReturnType<typeof vi.fn>).mock.calls.filter(
			(c: any[]) => typeof c[0] === "string" && c[0].includes("Created"),
		);
		expect(createdCalls).toHaveLength(0);
	});
});

describe("listEventsInteractive", () => {
	it("shows empty message when no events", () => {
		const deps = makeDeps();
		mockListEvents.mockReturnValue([]);

		listEventsInteractive("/project", deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No events defined"));
	});

	it("lists events with domain and version", () => {
		const deps = makeDeps();
		mockListEvents.mockReturnValue([
			{ name: "UserCreated", domain: "auth", version: "1.0.0" } as any,
			{ name: "OrderPlaced", domain: "orders", version: "2.1.0" } as any,
		]);

		listEventsInteractive("/project", deps);

		const output = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] ?? "").join("\n");
		expect(output).toContain("Events (2)");
		expect(output).toContain("UserCreated");
		expect(output).toContain("OrderPlaced");
	});

	it("handles events without domain", () => {
		const deps = makeDeps();
		mockListEvents.mockReturnValue([
			{ name: "AppStarted", domain: "", version: "1.0.0" } as any,
		]);

		listEventsInteractive("/project", deps);

		const output = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0] ?? "").join("\n");
		expect(output).toContain("AppStarted");
	});
});
