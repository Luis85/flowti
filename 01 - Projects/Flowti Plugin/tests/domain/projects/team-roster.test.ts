import { describe, it, expect } from "vitest";
import { reconcileProjectRoster } from "../../../src/domain/projects/team-roster.js";
import type { TeamRoleSlot } from "../../../src/domain/projects/types.js";

describe("reconcileProjectRoster", () => {
	it("keeps manual roster entries that were never slot assignees", () => {
		const prevRoster = ["Atlas", "ManualOnly"];
		const prevSlots: TeamRoleSlot[] = [{ id: "a", title: "Dev", need: "", assignee: "Atlas" }];
		const nextSlots: TeamRoleSlot[] = [{ id: "a", title: "Dev", need: "", assignee: "Rex" }];
		expect(reconcileProjectRoster(prevRoster, prevSlots, nextSlots).sort()).toEqual(["ManualOnly", "Rex"].sort());
	});

	it("drops an agent that was only on the roster via a slot when unassigned", () => {
		const prevRoster = ["Solo"];
		const prevSlots: TeamRoleSlot[] = [{ id: "x", title: "Q", need: "", assignee: "Solo" }];
		const nextSlots: TeamRoleSlot[] = [{ id: "x", title: "Q", need: "" }];
		expect(reconcileProjectRoster(prevRoster, prevSlots, nextSlots)).toEqual([]);
	});

	it("dedupes assignees across slots", () => {
		const prevRoster: string[] = [];
		const prevSlots: TeamRoleSlot[] = [];
		const nextSlots: TeamRoleSlot[] = [
			{ id: "1", title: "A", need: "", assignee: "Same" },
			{ id: "2", title: "B", need: "", assignee: "Same" },
		];
		expect(reconcileProjectRoster(prevRoster, prevSlots, nextSlots)).toEqual(["Same"]);
	});
});
