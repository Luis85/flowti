import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/capa/capa-store.js", () => ({
	capaStore: { list: vi.fn(() => []), updateField: vi.fn(), create: vi.fn(), resolveDir: vi.fn(() => "") },
	listCAPAItems: vi.fn(() => []),
	createCAPAItem: vi.fn(),
	updateCAPAStatus: vi.fn(),
	nextCapaId: vi.fn(() => "CAPA-001"),
}));
vi.mock("../../../src/ui/displays/capa-display.js", () => ({
	renderCAPAAdded: vi.fn(),
	renderCAPAUpdated: vi.fn(),
}));

import { capaStore, listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../../../src/domain/capa/capa-store.js";
import { renderCAPAAdded, renderCAPAUpdated } from "../../../src/ui/displays/capa-display.js";
import { addCAPAInteractive, updateStatusInteractive } from "../../../src/ui/menus/capa-menu.js";

const mockListCAPAItems = vi.mocked(capaStore.list);
const mockCreateCAPAItem = vi.mocked(createCAPAItem);
const mockUpdateCAPAStatus = vi.mocked(capaStore.updateField);
const mockNextCapaId = vi.mocked(nextCapaId);
const mockRenderCAPAAdded = vi.mocked(renderCAPAAdded);
const mockRenderCAPAUpdated = vi.mocked(renderCAPAUpdated);

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

describe("addCAPAInteractive", () => {
	it("returns early when name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");

		await addCAPAInteractive("corrective", "/project", undefined, deps);

		expect(mockCreateCAPAItem).not.toHaveBeenCalled();
	});

	it("creates a CAPA item on valid input", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([]);
		mockNextCapaId.mockReturnValue("CAPA-001");

		deps.input.ask
			.mockResolvedValueOnce("Fix login bug")     // name
			.mockResolvedValueOnce("CAPA-001")           // id
			.mockResolvedValueOnce("Login fails")        // description
			.mockResolvedValueOnce("high")               // severity
			.mockResolvedValueOnce("incident")           // source
			.mockResolvedValueOnce("Bob")                // owner
			.mockResolvedValueOnce("2026-06-01")         // dueDate
			.mockResolvedValueOnce("Bad validation");    // rootCause

		mockCreateCAPAItem.mockReturnValue("/project/docs/capa/fix-login-bug.md");

		await addCAPAInteractive("corrective", "/project", undefined, deps);

		expect(mockCreateCAPAItem).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "Fix login bug",
			id: "CAPA-001",
			capaType: "corrective",
			status: "open",
			severity: "high",
			source: "incident",
			owner: "Bob",
			rootCause: "Bad validation",
		}), undefined);
		expect(mockRenderCAPAAdded).toHaveBeenCalled();
	});

	it("does not render when createCAPAItem returns falsy", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([]);
		mockNextCapaId.mockReturnValue("CAPA-001");

		deps.input.ask
			.mockResolvedValueOnce("Item")
			.mockResolvedValueOnce("CAPA-001")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("medium")
			.mockResolvedValueOnce("observation")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");

		mockCreateCAPAItem.mockReturnValue(undefined as any);

		await addCAPAInteractive("preventive", "/project", undefined, deps);

		expect(mockCreateCAPAItem).toHaveBeenCalled();
		expect(mockRenderCAPAAdded).not.toHaveBeenCalled();
	});
});

describe("updateStatusInteractive", () => {
	it("logs message when no items exist", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([]);

		await updateStatusInteractive("/project", undefined, deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No CAPA items"));
	});

	it("returns early on invalid selection", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([
			{ id: "CAPA-001", name: "C1", capaType: "corrective", status: "open" } as any,
		]);
		deps.input.ask.mockResolvedValueOnce("abc");

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateCAPAStatus).not.toHaveBeenCalled();
	});

	it("returns early on invalid status", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([
			{ id: "CAPA-001", name: "C1", capaType: "corrective", status: "open" } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("invalid");

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateCAPAStatus).not.toHaveBeenCalled();
	});

	it("updates status on valid input", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([
			{ id: "CAPA-001", name: "C1", capaType: "corrective", status: "open" } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("investigating");

		mockUpdateCAPAStatus.mockReturnValue(true);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateCAPAStatus).toHaveBeenCalledWith(deps, "/project", "C1", "status", "investigating", undefined);
		expect(mockRenderCAPAUpdated).toHaveBeenCalledWith("C1", "investigating", deps.log);
	});

	it("does not render when updateCAPAStatus returns false", async () => {
		const deps = makeDeps();
		mockListCAPAItems.mockReturnValue([
			{ id: "CAPA-001", name: "C1", capaType: "corrective", status: "open" } as any,
		]);
		deps.input.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("closed");

		mockUpdateCAPAStatus.mockReturnValue(false);

		await updateStatusInteractive("/project", undefined, deps);

		expect(mockUpdateCAPAStatus).toHaveBeenCalled();
		expect(mockRenderCAPAUpdated).not.toHaveBeenCalled();
	});
});
