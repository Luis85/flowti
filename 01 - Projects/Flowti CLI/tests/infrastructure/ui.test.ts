import { describe, it, expect, vi, beforeEach } from "vitest";
import { printBanner, printHeader, printMenu, RESET, BOLD, DIM } from "../../src/infrastructure/ui.js";

vi.mock("../../src/infrastructure/logger.js", () => {
	const lines: string[] = [];
	return {
		log: (...args: unknown[]) => { lines.push(args.join(" ")); },
		info: (...args: unknown[]) => { lines.push(args.join(" ")); },
		blank: () => { lines.push(""); },
		_lines: lines,
	};
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lines: string[];
beforeEach(async () => {
	const logger = await import("../../src/infrastructure/logger.js") as any;
	lines = logger._lines;
	lines.length = 0;
});

describe("printBanner", () => {
	it("prints the banner with version", () => {
		printBanner();
		const output = lines.join("\n");
		expect(output).toContain("Flowti CLI");
		expect(output).toContain("═");
	});
});

describe("printHeader", () => {
	it("prints a titled header with horizontal rules", () => {
		printHeader("My Section");
		const output = lines.join("\n");
		expect(output).toContain("My Section");
		expect(output).toContain("─");
	});
});

describe("printMenu", () => {
	it("prints enabled menu items with key and label", () => {
		printMenu([
			{ key: "1", label: "Build", action: () => {} },
			{ key: "2", label: "Test", action: () => {} },
		]);
		const output = lines.join("\n");
		expect(output).toContain("1) Build");
		expect(output).toContain("2) Test");
	});

	it("prints disabled items with DIM styling", () => {
		printMenu([
			{ key: "1", label: "Locked", action: () => {}, disabled: true },
		]);
		const output = lines.join("\n");
		expect(output).toContain(`${DIM}1) Locked${RESET}`);
	});

	it("handles separators as blank lines", () => {
		const before = lines.length;
		printMenu([
			{ key: "1", label: "A", action: () => {} },
			{ separator: true },
			{ key: "2", label: "B", action: () => {} },
		]);
		// separator produces an empty line between items
		expect(lines.some((l) => l === "")).toBe(true);
	});
});
