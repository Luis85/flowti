import { describe, it, expect } from "vitest";
import { getHintsForZone } from "../../../src/tui/hooks/use-status-hints.js";

describe("getHintsForZone", () => {
	it("returns activity-bar hints when zone is activity-bar", () => {
		const hints = getHintsForZone("activity-bar");
		const labels = hints.map((h) => h.label);
		expect(labels).toContain("Navigate");
		expect(labels).toContain("Open");
		expect(labels).toContain("Content");
		expect(labels).toContain("Quit");
	});

	it("returns content hints when zone is content", () => {
		const hints = getHintsForZone("content");
		const labels = hints.map((h) => h.label);
		expect(labels).toContain("Sidebar");
		expect(labels).toContain("Back");
		expect(labels).toContain("Quit");
	});
});
