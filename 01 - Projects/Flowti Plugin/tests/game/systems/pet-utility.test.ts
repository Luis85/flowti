import { describe, it, expect } from "vitest";
import {
	getRoleForPetType,
	createPetUtility,
	recordUtilityAction,
	updateBond,
	getBondMoraleBonus,
	PET_ROLES,
} from "../../../src/game/systems/pet-utility.js";

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
		expect(utility!.bondStrength).toBe(0);
	});

	it("creates utility with correct role for each pet type", () => {
		expect(createPetUtility("cat-hub")!.role).toBe("scout");
		expect(createPetUtility("dog-office")!.role).toBe("fetch");
		expect(createPetUtility("owl-perch")!.role).toBe("audit");
		expect(createPetUtility("parrot-desk")!.role).toBe("echo");
		expect(createPetUtility("fox-den")!.role).toBe("triage");
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
		expect(Object.keys(PET_ROLES)).toHaveLength(5);
	});

	it("records utility action and increments score", () => {
		const util = createPetUtility("cat-hub")!;
		const updated = recordUtilityAction(util, "found orphan note");
		expect(updated.utilityScore).toBe(1);
		expect(updated.lastAction).toBe("found orphan note");
	});

	it("accumulates utility score across multiple actions", () => {
		let util = createPetUtility("cat-hub")!;
		util = recordUtilityAction(util, "first");
		util = recordUtilityAction(util, "second");
		util = recordUtilityAction(util, "third");
		expect(util.utilityScore).toBe(3);
		expect(util.lastAction).toBe("third");
	});

	it("builds bond with nearby agent", () => {
		const util = createPetUtility("dog-office")!;
		const bonded = updateBond(util, "auditor", 5000);
		expect(bonded.bondedAgent).toBe("auditor");
		expect(bonded.bondStrength).toBeGreaterThan(0);
	});

	it("returns unchanged utility when no agent nearby", () => {
		const util = createPetUtility("cat-hub")!;
		const result = updateBond(util, null, 5000);
		expect(result).toBe(util);
	});

	it("strengthens existing bond over time", () => {
		let util = createPetUtility("cat-hub")!;
		util = updateBond(util, "auditor", 5000);
		const strength1 = util.bondStrength;
		util = updateBond(util, "auditor", 5000);
		expect(util.bondStrength).toBeGreaterThan(strength1);
	});

	it("caps bond strength at 100", () => {
		let util = createPetUtility("cat-hub")!;
		// Build bond in steps so it goes through same-agent path with capping
		util = updateBond(util, "auditor", 50000);
		util = updateBond(util, "auditor", 50000);
		util = updateBond(util, "auditor", 50000);
		expect(util.bondStrength).toBeLessThanOrEqual(100);
		expect(util.bondStrength).toBe(100);
	});

	it("switches bond when current bond is weak and new agent appears", () => {
		let util = createPetUtility("cat-hub")!;
		util = updateBond(util, "agent-a", 2000); // weak bond (2.0)
		expect(util.bondedAgent).toBe("agent-a");
		util = updateBond(util, "agent-b", 5000); // new agent appears, bond < 10
		expect(util.bondedAgent).toBe("agent-b");
	});

	it("decays bond slowly when different agent is near and existing bond is strong", () => {
		let util = createPetUtility("cat-hub")!;
		util = updateBond(util, "agent-a", 20000); // strong bond (20.0)
		const strongBond = util.bondStrength;
		util = updateBond(util, "agent-b", 5000); // different agent but strong existing bond
		expect(util.bondStrength).toBeLessThan(strongBond);
		expect(util.bondedAgent).toBe("agent-a"); // keeps original bond
	});

	it("gives morale bonus when bonded above threshold", () => {
		const util = createPetUtility("cat-hub")!;
		const bonded = { ...util, bondedAgent: "auditor", bondStrength: 50 };
		expect(getBondMoraleBonus(bonded)).toBe(5);
	});

	it("no morale bonus when bond too weak", () => {
		const util = createPetUtility("cat-hub")!;
		const bonded = { ...util, bondedAgent: "auditor", bondStrength: 10 };
		expect(getBondMoraleBonus(bonded)).toBe(0);
	});

	it("no morale bonus when no bonded agent", () => {
		const util = createPetUtility("cat-hub")!;
		expect(getBondMoraleBonus(util)).toBe(0);
	});

	it("morale bonus at exact threshold boundary returns 0", () => {
		const util = createPetUtility("cat-hub")!;
		const bonded = { ...util, bondedAgent: "auditor", bondStrength: 25 };
		expect(getBondMoraleBonus(bonded)).toBe(5);
	});

	it("morale bonus just below threshold returns 0", () => {
		const util = createPetUtility("cat-hub")!;
		const bonded = { ...util, bondedAgent: "auditor", bondStrength: 24.9 };
		expect(getBondMoraleBonus(bonded)).toBe(0);
	});
});
