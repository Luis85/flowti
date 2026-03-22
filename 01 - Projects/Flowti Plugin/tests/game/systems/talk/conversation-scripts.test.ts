import { describe, it, expect } from "vitest";
import type { ConversationScript } from "../../../../src/game/systems/talk/conversation-types.js";
import { RIVAL_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-rival.js";
import { ACQUAINTANCE_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-acquaintance.js";
import { COLLEAGUE_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-colleague.js";
import { FRIEND_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-friend.js";
import { BESTFRIEND_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-bestfriend.js";
import { GOSSIP_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-gossip.js";
import { DRAMA_SCRIPTS } from "../../../../src/game/systems/talk/templates/conversation-scripts-drama.js";

function validateScripts(scripts: readonly ConversationScript[]): void {
	it("has at least 10 scripts", () => {
		expect(scripts.length).toBeGreaterThanOrEqual(10);
	});

	it("all scripts have unique IDs", () => {
		const ids = scripts.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all scripts have at least 2 turns", () => {
		for (const s of scripts) {
			expect(s.turns.length, s.id).toBeGreaterThanOrEqual(2);
		}
	});

	it("all scripts have valid tier ranges", () => {
		for (const s of scripts) {
			expect(s.tierRange).toHaveLength(2);
		}
	});

	it("all scripts have positive weight", () => {
		for (const s of scripts) {
			expect(s.weight, s.id).toBeGreaterThan(0);
		}
	});
}

describe("rival scripts", () => { validateScripts(RIVAL_SCRIPTS); });
describe("acquaintance scripts", () => { validateScripts(ACQUAINTANCE_SCRIPTS); });
describe("colleague scripts", () => { validateScripts(COLLEAGUE_SCRIPTS); });
describe("friend scripts", () => { validateScripts(FRIEND_SCRIPTS); });
describe("best-friend scripts", () => { validateScripts(BESTFRIEND_SCRIPTS); });
describe("gossip scripts", () => { validateScripts(GOSSIP_SCRIPTS); });
describe("drama scripts", () => { validateScripts(DRAMA_SCRIPTS); });
