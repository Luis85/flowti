/**
 * Team role slots and project roster reconciliation — pure logic, no I/O.
 */

import type { TeamRoleSlot } from "./types.js";

/** Stable roster after role-slot edits: keep manual roster entries; drop slot-only assignees when unassigned. */
export function reconcileProjectRoster(
	previousRoster: readonly string[],
	previousSlots: readonly TeamRoleSlot[],
	nextSlots: readonly TeamRoleSlot[],
): string[] {
	const prevAssignee = new Set(
		previousSlots.map((s) => s.assignee).filter((n): n is string => Boolean(n && n.trim())),
	);
	const nextAssignee = new Set(
		nextSlots.map((s) => s.assignee).filter((n): n is string => Boolean(n && n.trim())),
	);
	const manual = previousRoster.filter((n) => n && !prevAssignee.has(n));
	return [...new Set([...nextAssignee, ...manual])];
}

/** Safe filename stem for an agent note (no path segments). */
export function agentNoteBasename(displayName: string): string {
	const t = displayName.trim().replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-");
	return t || "agent";
}
