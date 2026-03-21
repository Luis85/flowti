export type PetUtilityRole = "scout" | "fetch" | "audit" | "echo" | "triage";

export interface PetUtility {
	readonly role: PetUtilityRole;
	utilityScore: number;
	lastAction?: string;
}

export const PET_ROLES: Record<string, PetUtilityRole> = {
	cat: "scout",
	dog: "fetch",
	owl: "audit",
	parrot: "echo",
	fox: "triage",
};

export function getRoleForPetType(petType: string): PetUtilityRole | undefined {
	// Extract base type from pet entity ID (e.g., "cat-hub" → "cat")
	const base = petType.split("-")[0];
	return PET_ROLES[base];
}

export function createPetUtility(petType: string): PetUtility | undefined {
	const role = getRoleForPetType(petType);
	if (!role) return undefined;
	return { role, utilityScore: 0 };
}

export const ROLE_DESCRIPTIONS: Record<PetUtilityRole, string> = {
	scout: "Patrols vault, spots untagged notes",
	fetch: "Retrieves related notes for working agents",
	audit: "Watches for stale content",
	echo: "Re-surfaces past events as reminders",
	triage: "Prioritizes inbox by urgency",
};
