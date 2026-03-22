import { describe, it, expect } from "vitest";
import {
	createEffectState,
	applyEffect,
} from "../../../src/domain/interactions/interaction-effects.js";
import type { EffectState } from "../../../src/domain/interactions/interaction-effects.js";
import type {
	EntityRef,
	InteractionEffect,
} from "../../../src/domain/interactions/interaction-types.js";

const initiator: EntityRef = { id: "atlas", entityType: "agent" };
const targets: EntityRef[] = [{ id: "vex", entityType: "agent" }];

describe("createEffectState", () => {
	it("returns an object with all empty arrays", () => {
		const state = createEffectState();
		expect(state.affinityChanges).toEqual([]);
		expect(state.needChanges).toEqual([]);
		expect(state.moodChanges).toEqual([]);
		expect(state.economyChanges).toEqual([]);
		expect(state.memoryRecords).toEqual([]);
		expect(state.roomMoodShifts).toEqual([]);
		expect(state.spawnedTemplateIds).toEqual([]);
		expect(state.renderActions).toEqual([]);
	});
});

describe("applyEffect", () => {
	it("affinity-change targeting targets creates correct from/to/amount", () => {
		const effect: InteractionEffect = {
			type: "affinity-change",
			target: "targets",
			amount: 5,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.affinityChanges).toEqual([
			{ from: "atlas", to: "vex", amount: 5 },
		]);
	});

	it("need-change targeting initiator creates correct entityId/need/amount", () => {
		const effect: InteractionEffect = {
			type: "need-change",
			target: "initiator",
			need: "energy",
			amount: -10,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.needChanges).toEqual([
			{ entityId: "atlas", need: "energy", amount: -10 },
		]);
	});

	it("need-change targeting all creates entries for initiator + all targets", () => {
		const multiTargets: EntityRef[] = [
			{ id: "vex", entityType: "agent" },
			{ id: "nova", entityType: "pet" },
		];
		const effect: InteractionEffect = {
			type: "need-change",
			target: "all",
			need: "social",
			amount: 3,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, multiTargets, state);

		expect(state.needChanges).toEqual([
			{ entityId: "atlas", need: "social", amount: 3 },
			{ entityId: "vex", need: "social", amount: 3 },
			{ entityId: "nova", need: "social", amount: 3 },
		]);
	});

	it("spawn-interaction collects templateId", () => {
		const effect: InteractionEffect = {
			type: "spawn-interaction",
			templateId: "follow-up-chat",
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.spawnedTemplateIds).toEqual(["follow-up-chat"]);
	});

	it("economy-transaction targeting targets creates correct currency/amount", () => {
		const effect: InteractionEffect = {
			type: "economy-transaction",
			target: "targets",
			currency: "coin",
			amount: 25,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.economyChanges).toEqual([
			{ entityId: "vex", currency: "coin", amount: 25 },
		]);
	});

	it("room-mood-shift creates correct mood/amount", () => {
		const effect: InteractionEffect = {
			type: "room-mood-shift",
			mood: "lively",
			amount: 2,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.roomMoodShifts).toEqual([
			{ mood: "lively", amount: 2 },
		]);
	});

	it("bubble targeting initiator goes to renderActions with bubbleKind/phrasePool", () => {
		const effect: InteractionEffect = {
			type: "bubble",
			target: "initiator",
			bubbleKind: "speech",
			phrasePool: "greetings",
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.renderActions).toEqual([
			{
				type: "bubble",
				entityId: "atlas",
				params: { bubbleKind: "speech", phrasePool: "greetings" },
			},
		]);
	});

	it("mood-change targeting targets creates correct entityId/mood", () => {
		const effect: InteractionEffect = {
			type: "mood-change",
			target: "targets",
			mood: "happy",
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.moodChanges).toEqual([
			{ entityId: "vex", mood: "happy" },
		]);
	});

	it("memory-record targeting initiator creates correct entityId/memory", () => {
		const effect: InteractionEffect = {
			type: "memory-record",
			target: "initiator",
			memory: "had a great chat with vex",
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.memoryRecords).toEqual([
			{ entityId: "atlas", memory: "had a great chat with vex" },
		]);
	});

	it("particle targeting targets goes to renderActions", () => {
		const effect: InteractionEffect = {
			type: "particle",
			target: "targets",
			particleType: "sparkle",
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.renderActions).toEqual([
			{
				type: "particle",
				entityId: "vex",
				params: { particleType: "sparkle" },
			},
		]);
	});

	it("sound targeting all goes to renderActions for each entity", () => {
		const effect: InteractionEffect = {
			type: "sound",
			target: "all",
			soundId: "ding",
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.renderActions).toEqual([
			{ type: "sound", entityId: "atlas", params: { soundId: "ding" } },
			{ type: "sound", entityId: "vex", params: { soundId: "ding" } },
		]);
	});

	it("state-change targeting initiator goes to renderActions", () => {
		const effect: InteractionEffect = {
			type: "state-change",
			target: "initiator",
			key: "isBusy",
			value: true,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.renderActions).toEqual([
			{
				type: "state-change",
				entityId: "atlas",
				params: { key: "isBusy", value: true },
			},
		]);
	});

	it("EntityRef target resolves to that specific entity", () => {
		const specificTarget: EntityRef = { id: "rex", entityType: "pet" };
		const effect: InteractionEffect = {
			type: "need-change",
			target: specificTarget,
			need: "hunger",
			amount: -5,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.needChanges).toEqual([
			{ entityId: "rex", need: "hunger", amount: -5 },
		]);
	});

	it("room target for non-room-mood effects resolves to empty entities", () => {
		const effect: InteractionEffect = {
			type: "need-change",
			target: "room",
			need: "comfort",
			amount: 1,
		};
		const state = createEffectState();
		applyEffect(effect, initiator, targets, state);

		expect(state.needChanges).toEqual([]);
	});
});
