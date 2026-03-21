import { describe, it, expect } from "vitest";
import { getRoleForPetType, createPetUtility, PET_ROLES } from "../../../src/game/systems/pet-utility.js";

describe("pet-utility", () => {
	it("getRoleForPetType maps cat-hub to scout", () => {
		expect(getRoleForPetType("cat-hub")).toBe("scout");
	});

	it("getRoleForPetType returns undefined for unknown types", () => {
		expect(getRoleForPetType("dragon-hub")).toBeUndefined();
	});

	it("createPetUtility creates correct utility object for dog", () => {
		const utility = createPetUtility("dog-office");
		expect(utility).toBeDefined();
		expect(utility!.role).toBe("fetch");
		expect(utility!.utilityScore).toBe(0);
	});

	it("createPetUtility returns undefined for unknown pet type", () => {
		expect(createPetUtility("unknown-pet")).toBeUndefined();
	});

	it("PET_ROLES has all 5 roles", () => {
		const roles = Object.values(PET_ROLES);
		expect(roles).toContain("scout");
		expect(roles).toContain("fetch");
		expect(roles).toContain("audit");
		expect(roles).toContain("echo");
		expect(roles).toContain("triage");
	});
});
