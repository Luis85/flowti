import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/raid/raid-store.js", () => ({
	raidStore: { list: vi.fn(() => []), updateField: vi.fn(), create: vi.fn(), resolveDir: vi.fn(() => "") },
	listRAIDItems: vi.fn(() => []),
	createRAIDItem: vi.fn(),
	updateRAIDStatus: vi.fn(),
}));
vi.mock("../../../src/ui/displays/raid-display.js", () => ({
	renderRAIDAdded: vi.fn(),
	renderRAIDUpdated: vi.fn(),
}));

import { raidStore, createRAIDItem } from "../../../src/domain/raid/raid-store.js";
import { renderRAIDAdded, renderRAIDUpdated } from "../../../src/ui/displays/raid-display.js";
import { addRAIDInteractive, updateStatusInteractive } from "../../../src/ui/menus/raid-menu.js";

const mockListRAIDItems = vi.mocked(raidStore.list);
const mockCreateRAIDItem = vi.mocked(createRAIDItem);
const mockUpdateRAIDStatus = vi.mocked(raidStore.updateField);
const mockRenderRAIDAdded = vi.mocked(renderRAIDAdded);
const mockRenderRAIDUpdated = vi.mocked(renderRAIDUpdated);

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

describe("addRAIDInteractive", () => {
	it("returns early when name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");

		await addRAIDInteractive("risk", "/project", undefined, deps);

		expect(mockCreateRAIDItem).not.toHaveBeenCalled();
	});

	it("creates a RAID item on valid input", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Server outage")   // name
			.mockResolvedValueOnce("Server may fail")  // description
			.mockResolvedValueOnce("high")             // severity
			.mockResolvedValueOnce("Alice")            // owner
			.mockResolvedValueOnce("2026-06-01")       // dueDate
			.mockResolvedValueOnce("technical");       // category

		mockCreateRAIDItem.mockReturnValue("/project/docs/raid/server-outage.md");

		await addRAIDInteractive("risk", "/project", undefined, deps);

		expect(mockCreateRAIDItem).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "Server outage",
			itemType: "risk",
			status: "open",
			severity: "high",
			owner: "Alice",
			category: "technical",
		}), undefined);
		expect(mockRenderRAIDAdded).toHaveBeenCalled();
	});

	it("does not render when createRAIDItem returns falsy", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Item")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("medium")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("technical");

		mockCreateRAIDItem.mockReturnValue(undefined as any);

		await addRAIDInteractive("issue", "/project", undefined, deps);

		expect(mockCreateRAIDItem).toHaveBeenCalled();
		expect(mockRenderRAIDAdded).not.toHaveBeenCalled();
	});
});

describe("updateStatusInteractive", () => {
	it("logs message when no items exist", async () => {
		const deps = makeDeps();
		mockListRAIDItems.mockReturnValue([]);

		await updateStatusInteractive("/project", undefined, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No RAID items"));
	});

	it("returns early on invalid selection", async () => {
		const deps = makeDeps();
		mockListRAIDItems.mockReturnValue([
			{ name: "R1", itemType: "risk", status: "open" } as any,
		]);
		deps.input.ask.mockResolvedValueOnce("abc");

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateRAIDStatus).not.toHaveBeenCalled();
	});

	it("returns early on invalid status", async () => {
		const deps = makeDeps();
		mockListRAIDItems.mockReturnValue([
			{ name: "R1", itemType: "risk", status: "open" } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")         // select item
			.mockResolvedValueOnce("invalid");   // bad status

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateRAIDStatus).not.toHaveBeenCalled();
	});

	it("updates status on valid input", async () => {
		const deps = makeDeps();
		mockListRAIDItems.mockReturnValue([
			{ name: "R1", itemType: "risk", status: "open" } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")          // select item
			.mockResolvedValueOnce("mitigated");  // new status

		mockUpdateRAIDStatus.mockReturnValue(true);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateRAIDStatus).toHaveBeenCalledWith(deps, "/project", "R1", "status", "mitigated", undefined);
		expect(mockRenderRAIDUpdated).toHaveBeenCalledWith("R1", "mitigated", deps.log);
	});

	it("does not render when updateRAIDStatus returns false", async () => {
		const deps = makeDeps();
		mockListRAIDItems.mockReturnValue([
			{ name: "R1", itemType: "risk", status: "open" } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("closed");

		mockUpdateRAIDStatus.mockReturnValue(false);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateRAIDStatus).toHaveBeenCalled();
		expect(mockRenderRAIDUpdated).not.toHaveBeenCalled();
	});
});
