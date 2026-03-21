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
});
