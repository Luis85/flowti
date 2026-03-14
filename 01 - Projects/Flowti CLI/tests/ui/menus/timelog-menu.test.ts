import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/timelog/timelog-store.js", () => ({
	createTimeLogEntry: vi.fn(),
}));
vi.mock("../../../src/ui/displays/timelog-display.js", () => ({
	renderTimeLogAdded: vi.fn(),
}));

import { createTimeLogEntry } from "../../../src/domain/timelog/timelog-store.js";
import { renderTimeLogAdded } from "../../../src/ui/displays/timelog-display.js";
import { logTimeInteractive } from "../../../src/ui/menus/timelog-menu.js";

const mockCreateTimeLogEntry = vi.mocked(createTimeLogEntry);
const mockRenderTimeLogAdded = vi.mocked(renderTimeLogAdded);

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

describe("logTimeInteractive", () => {
	it("returns early when person is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");

		await logTimeInteractive("/project", undefined, deps);

		expect(mockCreateTimeLogEntry).not.toHaveBeenCalled();
	});

	it("returns early when task is empty", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Alice")          // person
			.mockResolvedValueOnce("2")              // hours
			.mockResolvedValueOnce("development")    // category
			.mockResolvedValueOnce("");              // task (empty)

		await logTimeInteractive("/project", undefined, deps);

		expect(mockCreateTimeLogEntry).not.toHaveBeenCalled();
	});

	it("creates a time log entry on valid input", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Alice")          // person
			.mockResolvedValueOnce("3.5")            // hours
			.mockResolvedValueOnce("testing")        // category
			.mockResolvedValueOnce("Write unit tests") // task
			.mockResolvedValueOnce("Menu tests");    // notes

		mockCreateTimeLogEntry.mockReturnValue("/project/docs/timelog/2026-01-01-alice.md");

		await logTimeInteractive("/project", undefined, deps);

		expect(mockCreateTimeLogEntry).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			date: "2026-01-01",
			person: "Alice",
			hours: 3.5,
			category: "testing",
			task: "Write unit tests",
			description: "Menu tests",
		}), undefined);
		expect(mockRenderTimeLogAdded).toHaveBeenCalled();
	});

	it("does not render when createTimeLogEntry returns falsy", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Bob")
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("development")
			.mockResolvedValueOnce("Fix bug")
			.mockResolvedValueOnce("");

		mockCreateTimeLogEntry.mockReturnValue(undefined as any);

		await logTimeInteractive("/project", undefined, deps);

		expect(mockCreateTimeLogEntry).toHaveBeenCalled();
		expect(mockRenderTimeLogAdded).not.toHaveBeenCalled();
	});
});
