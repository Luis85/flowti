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
		return {
			id: s.id,
			title,
			need,
			...(s.blueprint && Object.keys(s.blueprint).length > 0 ? { blueprint: s.blueprint } : {}),
			...(assignee ? { assignee } : {}),
			...(roleNotePath ? { roleNotePath } : {}),
			...(s.roleSkills?.length ? { roleSkills: [...s.roleSkills] } : {}),
			...(s.roleSummary?.trim() ? { roleSummary: s.roleSummary.trim() } : {}),
			...(s.roleBody != null && s.roleBody !== "" ? { roleBody: s.roleBody } : {}),
			...(typeof s.roleFte === "number" && Number.isFinite(s.roleFte) ? { roleFte: s.roleFte } : {}),
			...(s.roleStart?.trim() ? { roleStart: s.roleStart.trim() } : {}),
			...(s.roleEnd?.trim() ? { roleEnd: s.roleEnd.trim() } : {}),
			...(typeof s.hourlyRate === "number" && Number.isFinite(s.hourlyRate) && s.hourlyRate >= 0 ? { hourlyRate: s.hourlyRate } : {}),
		} satisfies TeamRoleSlot;
	});
}
