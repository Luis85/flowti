/**
 * Normalize role slots before persisting (trim strings, drop empty assignees).
 */

import type { TeamRoleSlot } from "./types.js";

export function normalizeTeamRoleSlots(slots: readonly TeamRoleSlot[]): TeamRoleSlot[] {
	return slots.map((s) => {
		const title = s.title.trim() || "Untitled role";
		const need = s.need.trim();
		const assignee = s.assignee?.trim();
		const roleNotePath = s.roleNotePath?.trim();
		const slot: TeamRoleSlot = { id: s.id, title, need };
		if (s.blueprint && Object.keys(s.blueprint).length > 0) slot.blueprint = s.blueprint;
		if (assignee) slot.assignee = assignee;
		if (roleNotePath) slot.roleNotePath = roleNotePath;
		if (s.roleSkills?.length) slot.roleSkills = [...s.roleSkills];
		if (s.roleSummary?.trim()) slot.roleSummary = s.roleSummary.trim();
		if (s.roleBody != null && s.roleBody !== "") slot.roleBody = s.roleBody;
		if (typeof s.roleFte === "number" && Number.isFinite(s.roleFte)) slot.roleFte = s.roleFte;
		if (s.roleStart?.trim()) slot.roleStart = s.roleStart.trim();
		if (s.roleEnd?.trim()) slot.roleEnd = s.roleEnd.trim();
		return slot;
	});
}
