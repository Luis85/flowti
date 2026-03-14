import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/domain/resources/resource-store.js", () => ({
	createResourceFile: vi.fn(),
}));
vi.mock("../../../src/ui/displays/resources-display.js", () => ({
	renderResourceAdded: vi.fn(),
}));

import { createResourceFile } from "../../../src/domain/resources/resource-store.js";
import { renderResourceAdded } from "../../../src/ui/displays/resources-display.js";
import { addResourceInteractive } from "../../../src/ui/menus/resources-menu.js";

const mockCreateResourceFile = vi.mocked(createResourceFile);
const mockRenderResourceAdded = vi.mocked(renderResourceAdded);

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

describe("addResourceInteractive", () => {
	it("returns early when name is empty", async () => {
		const deps = makeDeps();
		deps.input.ask.mockResolvedValueOnce("");

		await addResourceInteractive("/project", "role", undefined, deps);

		expect(mockCreateResourceFile).not.toHaveBeenCalled();
	});

	it("creates a role resource", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Senior Dev")   // name
			.mockResolvedValueOnce("Lead role")    // description
			.mockResolvedValueOnce("120")          // hourlyRate
			.mockResolvedValueOnce("1.5");         // FTE amount

		mockCreateResourceFile.mockReturnValue("/project/docs/resources/senior-dev.md");

		await addResourceInteractive("/project", "role", undefined, deps);

		expect(mockCreateResourceFile).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "Senior Dev",
			resourceType: "role",
			price: 120,
			hourlyRate: 120,
			amount: 1.5,
			consumed: 0,
			status: "active",
		}), undefined);
		expect(mockRenderResourceAdded).toHaveBeenCalled();
	});

	it("creates a human resource", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Alice")      // name
			.mockResolvedValueOnce("Developer")  // description
			.mockResolvedValueOnce("Engineer")   // role
			.mockResolvedValueOnce("80")         // price per hour
			.mockResolvedValueOnce("1");         // FTE amount

		mockCreateResourceFile.mockReturnValue("/project/docs/resources/alice.md");

		await addResourceInteractive("/project", "human", undefined, deps);

		expect(mockCreateResourceFile).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "Alice",
			resourceType: "human",
			role: "Engineer",
			price: 80,
			amount: 1,
		}), undefined);
	});

	it("creates a material resource", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Server")     // name
			.mockResolvedValueOnce("AWS EC2")    // description
			.mockResolvedValueOnce("500")        // unit price
			.mockResolvedValueOnce("3");         // quantity

		mockCreateResourceFile.mockReturnValue("/project/docs/resources/server.md");

		await addResourceInteractive("/project", "material", undefined, deps);

		expect(mockCreateResourceFile).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "Server",
			resourceType: "material",
			price: 500,
			amount: 3,
		}), undefined);
	});

	it("creates a budget resource", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Q1 Budget")    // name
			.mockResolvedValueOnce("First quarter") // description
			.mockResolvedValueOnce("50000")        // total amount
			.mockResolvedValueOnce("USD")          // currency
			.mockResolvedValueOnce("ops")          // category
			.mockResolvedValueOnce("2026-01-01")   // periodStart
			.mockResolvedValueOnce("2026-03-31");  // periodEnd

		mockCreateResourceFile.mockReturnValue("/project/docs/resources/q1-budget.md");

		await addResourceInteractive("/project", "budget", undefined, deps);

		expect(mockCreateResourceFile).toHaveBeenCalledWith(deps, "/project", expect.objectContaining({
			name: "Q1 Budget",
			resourceType: "budget",
			price: 1,
			amount: 50000,
			currency: "USD",
			category: "ops",
			periodStart: "2026-01-01",
			periodEnd: "2026-03-31",
		}), undefined);
	});

	it("does not render when createResourceFile returns falsy", async () => {
		const deps = makeDeps();
		deps.input.ask
			.mockResolvedValueOnce("Item")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("0")
			.mockResolvedValueOnce("1");

		mockCreateResourceFile.mockReturnValue(undefined as any);

		await addResourceInteractive("/project", "material", undefined, deps);

		expect(mockCreateResourceFile).toHaveBeenCalled();
		expect(mockRenderResourceAdded).not.toHaveBeenCalled();
	});
});
