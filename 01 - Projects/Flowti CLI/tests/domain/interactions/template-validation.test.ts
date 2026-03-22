import { describe, it, expect } from "vitest";
import { AGENT_AGENT_TEMPLATES } from "../../../src/domain/interactions/templates/agent-agent.js";
import { AGENT_PET_TEMPLATES } from "../../../src/domain/interactions/templates/agent-pet.js";
import { PET_SOCIAL_TEMPLATES } from "../../../src/domain/interactions/templates/pet-social.js";
import { NPC_INTERACTION_TEMPLATES } from "../../../src/domain/interactions/templates/npc-interactions.js";
import { ROOM_REACTION_TEMPLATES } from "../../../src/domain/interactions/templates/room-reactions.js";
import { DIRECTOR_COMMAND_TEMPLATES } from "../../../src/domain/interactions/templates/director-commands.js";
import { CROSS_TYPE_TEMPLATES } from "../../../src/domain/interactions/templates/cross-type.js";
import { ENVIRONMENT_EVENT_TEMPLATES } from "../../../src/domain/interactions/templates/environment-events.js";
import type { InteractionTemplate } from "../../../src/domain/interactions/interaction-types.js";

const ALL_TEMPLATES: readonly InteractionTemplate[] = [
	...AGENT_AGENT_TEMPLATES,
	...AGENT_PET_TEMPLATES,
	...PET_SOCIAL_TEMPLATES,
	...NPC_INTERACTION_TEMPLATES,
	...ROOM_REACTION_TEMPLATES,
	...DIRECTOR_COMMAND_TEMPLATES,
	...CROSS_TYPE_TEMPLATES,
	...ENVIRONMENT_EVENT_TEMPLATES,
];

describe("Template Validation", () => {
	it("has at least 80 templates total", () => {
		expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(80);
	});

	it("all template IDs are unique", () => {
		const ids = ALL_TEMPLATES.map(t => t.id);
		const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
		expect(dupes).toEqual([]);
	});

	it("all templates have required fields", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.id, `template missing id`).toBeTruthy();
			expect(t.category, `${t.id} missing category`).toBeTruthy();
			expect(t.action, `${t.id} missing action`).toBeTruthy();
			expect(t.cardinality, `${t.id} missing cardinality`).toBeTruthy();
			expect(t.initiatorTypes.length, `${t.id} no initiatorTypes`).toBeGreaterThan(0);
			expect(t.targetTypes.length, `${t.id} no targetTypes`).toBeGreaterThan(0);
			expect(t.weight, `${t.id} weight must be > 0`).toBeGreaterThan(0);
			expect(t.cooldownMs, `${t.id} cooldownMs must be >= 0`).toBeGreaterThanOrEqual(0);
			expect(Array.isArray(t.effects), `${t.id} effects not array`).toBe(true);
			expect(Array.isArray(t.tags), `${t.id} tags not array`).toBe(true);
		}
	});

	it("all templates have at least one tag", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.tags.length, `${t.id} has no tags`).toBeGreaterThan(0);
		}
	});

	it("covers at least 7 distinct categories", () => {
		const categories = new Set(ALL_TEMPLATES.map(t => t.category));
		expect(categories.size).toBeGreaterThanOrEqual(7);
	});

	it("no template has weight above 5", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.weight, `${t.id} weight ${t.weight} > 5`).toBeLessThanOrEqual(5);
		}
	});

	it("all templates have at least one effect", () => {
		for (const t of ALL_TEMPLATES) {
			expect(t.effects.length, `${t.id} has no effects`).toBeGreaterThan(0);
		}
	});
});
