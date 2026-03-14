import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { renderComponentAdding } from "../../../src/ui/renderers/make-renderers.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

describe("renderComponentAdding", () => {
	it("renders definition label and component name", () => {
		renderComponentAdding(log,"Component", "Button");
		const out = output();
		expect(out).toContain("Adding Component: Button");
		expect(out).toContain("▸");
	});

	it("renders with different label and name", () => {
		renderComponentAdding(log,"Layout", "Dashboard");
		expect(output()).toContain("Adding Layout: Dashboard");
	});

	it("calls log exactly once", () => {
		renderComponentAdding(log,"Widget", "Card");
		expect(mockLog).toHaveBeenCalledTimes(1);
	});
});
