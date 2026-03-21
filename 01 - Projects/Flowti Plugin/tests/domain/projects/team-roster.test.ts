import { describe, it, expect } from "vitest";
import {
	reconcileProjectRoster,
	teamRoleSlotDateRangeInvalid,
	teamRoleSlotsHaveInvalidDateRange,
} from "../../../src/domain/projects/team-roster.js";
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

describe("team role date range", () => {
	const slot = (start?: string, end?: string): TeamRoleSlot => ({ id: "r", title: "T", need: "", roleStart: start, roleEnd: end });

	it("treats missing start or end as valid", () => {
		expect(teamRoleSlotDateRangeInvalid(slot())).toBe(false);
		expect(teamRoleSlotDateRangeInvalid(slot("2025-01-01", undefined))).toBe(false);
		expect(teamRoleSlotDateRangeInvalid(slot(undefined, "2025-12-31"))).toBe(false);
	});

	it("flags end before start for ISO dates", () => {
		expect(teamRoleSlotDateRangeInvalid(slot("2025-06-01", "2025-01-01"))).toBe(true);
		expect(teamRoleSlotDateRangeInvalid(slot("2025-01-01", "2025-06-01"))).toBe(false);
	});

	it("aggregates across slots", () => {
		expect(teamRoleSlotsHaveInvalidDateRange([slot("2025-06-01", "2025-01-01")])).toBe(true);
		expect(teamRoleSlotsHaveInvalidDateRange([slot("2025-01-01", "2025-06-01")])).toBe(false);
	});
});
