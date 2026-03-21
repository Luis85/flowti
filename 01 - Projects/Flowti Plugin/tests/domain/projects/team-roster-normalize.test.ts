import { describe, it, expect } from "vitest";
import { normalizeTeamRoleSlots } from "../../../src/domain/projects/team-roster-normalize.js";
import type { TeamRoleSlot } from "../../../src/domain/projects/types.js";

describe("normalizeTeamRoleSlots", () => {
	it("trims title, need, assignee and drops whitespace-only assignee", () => {
		const slots: TeamRoleSlot[] = [{ id: "a", title: "  Dev ", need: "  build ", assignee: "  " }];
		expect(normalizeTeamRoleSlots(slots)).toEqual([{ id: "a", title: "Dev", need: "build" }]);
	});

	it("uses default title when empty after trim", () => {
		expect(normalizeTeamRoleSlots([{ id: "x", title: "   ", need: "" }])[0].title).toBe("Untitled role");
	});

	it("preserves role note path and enriched fields when present", () => {
		const path = "01 - Projects/P/team/roles/r1.md";
		const slots = normalizeTeamRoleSlots([
			{
				id: "r1",
				title: "Lead",
				need: "x",
				roleNotePath: path,
				roleSkills: ["A|5"],
				roleSummary: "Short",
				roleBody: "Long",
			},
		]);
		expect(slots[0].roleNotePath).toBe(path);
		expect(slots[0].roleSkills).toEqual(["A|5"]);
		expect(slots[0].roleSummary).toBe("Short");
		expect(slots[0].roleBody).toBe("Long");
	});

	it("preserves FTE and date fields when present", () => {
		const slots = normalizeTeamRoleSlots([
			{ id: "r", title: "X", need: "", roleFte: 1.25, roleStart: "2025-01-15", roleEnd: "2025-06-30" },
		]);
		expect(slots[0].roleFte).toBe(1.25);
		expect(slots[0].roleStart).toBe("2025-01-15");
		expect(slots[0].roleEnd).toBe("2025-06-30");
	});
});
