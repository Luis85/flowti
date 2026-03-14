import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/deliverables/deliverable-store.js", () => ({
	listDeliverables: vi.fn(() => []),
	createDeliverableFile: vi.fn(),
	updateDeliverableStatus: vi.fn(),
}));
vi.mock("../../../src/ui/displays/deliverables-display.js", () => ({
	renderDeliverableAdded: vi.fn(),
	renderDeliverableUpdated: vi.fn(),
}));

import { listDeliverables, createDeliverableFile, updateDeliverableStatus } from "../../../src/domain/deliverables/deliverable-store.js";
import { renderDeliverableAdded, renderDeliverableUpdated } from "../../../src/ui/displays/deliverables-display.js";
import { addDeliverableInteractive, updateStatusInteractive } from "../../../src/ui/menus/deliverables-menu.js";

const mockListDeliverables = vi.mocked(listDeliverables);
const mockCreateDeliverableFile = vi.mocked(createDeliverableFile);
const mockUpdateDeliverableStatus = vi.mocked(updateDeliverableStatus);
const mockRenderDeliverableAdded = vi.mocked(renderDeliverableAdded);
const mockRenderDeliverableUpdated = vi.mocked(renderDeliverableUpdated);

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

describe("addDeliverableInteractive", () => {
	it("returns early when name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");

		await addDeliverableInteractive("/project", undefined, deps);

		expect(mockCreateDeliverableFile).not.toHaveBeenCalled();
	});

	it("creates a deliverable on valid input", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("API Documentation")  // name
			.mockResolvedValueOnce("Full API docs")      // description
			.mockResolvedValueOnce("2026-06-01")         // dueDate
			.mockResolvedValueOnce("Alice")              // assignee
			.mockResolvedValueOnce("high");              // priority

		mockCreateDeliverableFile.mockReturnValue("/project/docs/deliverables/api-documentation.md");

		await addDeliverableInteractive("/project", undefined, deps);

		expect(mockCreateDeliverableFile).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "API Documentation",
			status: "planned",
			dueDate: "2026-06-01",
			assignee: "Alice",
			priority: "high",
			completionPct: 0,
		}), undefined);
		expect(mockRenderDeliverableAdded).toHaveBeenCalled();
	});

	it("does not render when createDeliverableFile returns falsy", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Item")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("medium");

		mockCreateDeliverableFile.mockReturnValue(undefined as any);

		await addDeliverableInteractive("/project", undefined, deps);

		expect(mockCreateDeliverableFile).toHaveBeenCalled();
		expect(mockRenderDeliverableAdded).not.toHaveBeenCalled();
	});
});

describe("updateStatusInteractive", () => {
	it("logs message when no deliverables exist", async () => {
		const deps = makeDeps();
		mockListDeliverables.mockReturnValue([]);

		await updateStatusInteractive("/project", undefined, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No deliverables"));
	});

	it("returns early on invalid selection", async () => {
		const deps = makeDeps();
		mockListDeliverables.mockReturnValue([
			{ name: "D1", status: "planned", completionPct: 0 } as any,
		]);
		deps.input.ask.mockResolvedValueOnce("abc");

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateDeliverableStatus).not.toHaveBeenCalled();
	});

	it("returns early on invalid status", async () => {
		const deps = makeDeps();
		mockListDeliverables.mockReturnValue([
			{ name: "D1", status: "planned", completionPct: 0 } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("invalid");

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateDeliverableStatus).not.toHaveBeenCalled();
	});

	it("updates status and completion on valid input", async () => {
		const deps = makeDeps();
		mockListDeliverables.mockReturnValue([
			{ name: "D1", status: "planned", completionPct: 0 } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")              // select item
			.mockResolvedValueOnce("in-progress")    // new status
			.mockResolvedValueOnce("25");             // completion %

		mockUpdateDeliverableStatus.mockReturnValue(true);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateDeliverableStatus).toHaveBeenCalledWith(deps, "/project", "D1", "in-progress", 25, undefined);
		expect(mockRenderDeliverableUpdated).toHaveBeenCalledWith("D1", "in-progress", deps.log);
	});

	it("does not render when updateDeliverableStatus returns false", async () => {
		const deps = makeDeps();
		mockListDeliverables.mockReturnValue([
			{ name: "D1", status: "planned", completionPct: 0 } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("done")
			.mockResolvedValueOnce("100");

		mockUpdateDeliverableStatus.mockReturnValue(false);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateDeliverableStatus).toHaveBeenCalled();
		expect(mockRenderDeliverableUpdated).not.toHaveBeenCalled();
	});

	it("passes undefined when completion % is NaN", async () => {
		const deps = makeDeps();
		mockListDeliverables.mockReturnValue([
			{ name: "D1", status: "planned", completionPct: 0 } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("review")
			.mockResolvedValueOnce("abc");

		mockUpdateDeliverableStatus.mockReturnValue(true);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateDeliverableStatus).toHaveBeenCalledWith(deps, "/project", "D1", "review", undefined, undefined);
	});
});
