/**
 * Session state migration — backward-compatibility field defaults
 * and legacy link-to-binding migration.
 *
 * Extracted from SessionService to reduce its LOC.
 */

import type { Session, SessionState } from "./types";
import { createContextBinding } from "./sessionUtils";
import { generateUUID } from "../../utils/helpers";

/** Migrate all sessions to current schema. Returns true if any link migration occurred. */
export function migrateSessionState(state: SessionState): boolean {
	let migrated = false;
	for (const s of state.sessions) {
		migrateSessionFields(s);
		if (migrateSessionLinks(s)) migrated = true;
	}
	return migrated;
}

/** Ensure all required session fields exist with defaults (backward compatibility). */
function migrateSessionFields(s: Session): void {
	const arrayDefaults: Array<keyof Session> = [
		"timeline", "goals", "links", "activity", "activityFilter",
		"contextBindings", "decisions", "outputArtifacts", "executionTasks", "reflections",
	];
	for (const key of arrayDefaults) {
		if (!(s as unknown as Record<string, unknown>)[key]) (s as unknown as Record<string, unknown>)[key] = [];
	}
	const nullDefaults: Array<keyof Session> = [
		"notesFile", "canvasFile", "workspaceState", "intent", "energy", "closureResponse", "featureName",
	];
	for (const key of nullDefaults) {
		if ((s as unknown as Record<string, unknown>)[key] === undefined) (s as unknown as Record<string, unknown>)[key] = null;
	}
	if (!s.type) (s as { type?: string }).type = "documentation";
	if (s.status === "active") s.status = "running";
}

/** Migrate legacy links to context bindings. Returns true if migration occurred. */
function migrateSessionLinks(s: Session): boolean {
	if (s.links.length === 0) return false;
	for (const link of s.links) {
		if (!s.contextBindings.some((b) => b.path === link.path)) {
			s.contextBindings.push(createContextBinding(`ctx_${generateUUID()}`, "file", link.path));
		}
	}
	s.links = [];
	return true;
}
