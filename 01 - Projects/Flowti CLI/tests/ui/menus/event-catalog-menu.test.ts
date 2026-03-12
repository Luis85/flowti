import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), confirm: vi.fn(), select: vi.fn(), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) },
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-10T00:00:00.000Z", now: () => new Date("2026-03-10"), ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
		resolve: (...args: string[]) => args.join("/"),
	},
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
vi.mock("../../../src/domain/events/event-flow.js", () => ({
	saveEventFlowDoc: vi.fn(() => "/project/docs/events/flow.md"),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { listEvents, createEventFile } from "../../../src/domain/events/event-catalog.js";
import { collectPayloadFields, collectVersioningInfo } from "../../../src/domain/events/event-payload.js";
import { saveEventFlowDoc } from "../../../src/domain/events/event-flow.js";
import { eventCatalogMenu } from "../../../src/ui/menus/event-catalog-menu.js";

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);
const mockListEvents = vi.mocked(listEvents);
const mockCreateEvent = vi.mocked(createEventFile);
const mockSaveFlow = vi.mocked(saveEventFlowDoc);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("eventCatalogMenu", () => {
	it("builds menu with 3 options plus back and quit", async () => {
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Event Catalog");
		// 3 items + separator + back + quit = 6
		expect(items).toHaveLength(6);
	});

	it("List Events: shows empty message when no events", async () => {
		mockListEvents.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "1") as any).action();

		expect(result).toBe("main");
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("No events defined");
	});

	it("List Events: displays events with domain and version", async () => {
		mockListEvents.mockReturnValue([
			{ name: "user.created", domain: "auth", version: "1.0.0" },
			{ name: "order.placed", domain: "shop", version: "2.0.0" },
		] as any);
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Events (2)");
		expect(output).toContain("user.created");
		expect(output).toContain("[auth]");
		expect(output).toContain("v1.0.0");
		expect(output).toContain("order.placed");
	});

	it("List Events: omits domain tag when domain is empty", async () => {
		mockListEvents.mockReturnValue([
			{ name: "test.event", domain: "", version: "1.0.0" },
		] as any);
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "1") as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("test.event");
		expect(output).not.toContain("[");
	});

	it("Add Event: happy path", async () => {
		mockRunMenu.mockResolvedValue("main");
		mockInput.ask
			.mockResolvedValueOnce("user.created")  // name
			.mockResolvedValueOnce("auth")           // domain
			.mockResolvedValueOnce("1.0.0")          // version
			.mockResolvedValueOnce("User was created") // description
			.mockResolvedValueOnce("auth-service")   // producers
			.mockResolvedValueOnce("email-service"); // consumers
		vi.mocked(collectPayloadFields).mockResolvedValue([{ name: "userId", type: "string" }] as any);
		vi.mocked(collectVersioningInfo).mockResolvedValue({});
		mockCreateEvent.mockReturnValue("/project/docs/events/user-created.md");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "2") as any).action();

		expect(result).toBe("main");
		expect(mockCreateEvent).toHaveBeenCalledWith(expect.any(Object), "/project", expect.objectContaining({
			name: "user.created",
			domain: "auth",
			version: "1.0.0",
		}));
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Created:");
	});

	it("Add Event: cancelled when name is empty", async () => {
		mockRunMenu.mockResolvedValue("main");
		mockInput.ask.mockResolvedValueOnce("");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "2") as any).action();

		expect(mockCreateEvent).not.toHaveBeenCalled();
	});

	it("Add Event: handles null return from createEventFile", async () => {
		mockRunMenu.mockResolvedValue("main");
		mockInput.ask
			.mockResolvedValueOnce("evt")
			.mockResolvedValueOnce("core")
			.mockResolvedValueOnce("1.0.0")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		vi.mocked(collectPayloadFields).mockResolvedValue([]);
		vi.mocked(collectVersioningInfo).mockResolvedValue({});
		mockCreateEvent.mockReturnValue(null as any);

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "2") as any).action();

		// Should not crash, no "Created:" output
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).not.toContain("Created:");
	});

	it("Event Flow Diagram: generates and shows path", async () => {
		mockSaveFlow.mockReturnValue("/project/docs/events/flow.md");
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items.find((i: any) => i.key === "3") as any).action();

		expect(result).toBe("main");
		expect(mockSaveFlow).toHaveBeenCalledWith(expect.any(Object), "/project");
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Generated:");
	});

	it("Back returns 'main'", async () => {
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		expect(await (items.find((i: any) => i.key === "b") as any).action()).toBe("main");
	});

	it("Quit returns 'quit'", async () => {
		mockRunMenu.mockResolvedValue("main");

		await eventCatalogMenu("/project");

		const [, items] = mockRunMenu.mock.calls[0];
		expect(await (items.find((i: any) => i.key === "q") as any).action()).toBe("quit");
	});
});
