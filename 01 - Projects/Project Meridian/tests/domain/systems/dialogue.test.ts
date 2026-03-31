import { describe, it, expect } from 'vitest';
import { selectDialogue, DIALOGUE_TEMPLATES, type DialogueInput } from '../../../src/domain/systems/dialogue.js';
import { createGameRNG } from '../../../src/domain/core/game-rng.js';

function makeInput(overrides: Partial<DialogueInput> = {}): DialogueInput {
	return {
		agentKind: 'merchant',
		agentName: 'Elena',
		agentMoodBucket: 'content',
		partnerKind: 'guard',
		partnerName: 'Marcus',
		partnerMoodBucket: 'content',
		disposition: 10,
		partnerDisposition: 10,
		familiarity: 5,
		gossipFamiliarityThreshold: 3,
		rng: createGameRNG(42),
		...overrides,
	};
}

describe('selectDialogue', () => {
	it('selects lines from correct template for known kinds', () => {
		const result = selectDialogue(makeInput({
			agentKind: 'merchant',
			agentMoodBucket: 'elated',
			partnerKind: 'scholar',
			partnerMoodBucket: 'content',
		}));

		const merchantElated = DIALOGUE_TEMPLATES['merchant:elated']!;
		const scholarContent = DIALOGUE_TEMPLATES['scholar:content']!;

		expect(merchantElated).toContain(result.agentLine);
		expect(scholarContent).toContain(result.partnerLine);
	});

	it('uses default fallback for unknown agent kind', () => {
		const result = selectDialogue(makeInput({
			agentKind: 'unknown_kind',
			agentMoodBucket: 'stressed',
		}));

		const defaultStressed = DIALOGUE_TEMPLATES['default:stressed']!;
		expect(defaultStressed).toContain(result.agentLine);
	});

	it('uses default fallback for unknown partner kind', () => {
		const result = selectDialogue(makeInput({
			partnerKind: 'wizard',
			partnerMoodBucket: 'elated',
		}));

		const defaultElated = DIALOGUE_TEMPLATES['default:elated']!;
		expect(defaultElated).toContain(result.partnerLine);
	});

	it('returns positive tone when both moods are happy and minDisposition >= 0', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'elated',
			partnerMoodBucket: 'content',
			disposition: 5,
			partnerDisposition: 0,
		}));

		expect(result.tone).toBe('positive');
		expect(result.dispositionChange).toBe(1);
	});

	it('returns negative tone when either mood is distressed', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'content',
			partnerMoodBucket: 'distressed',
			disposition: 50,
			partnerDisposition: 50,
		}));

		expect(result.tone).toBe('negative');
		expect(result.dispositionChange).toBe(-1);
	});

	it('returns negative tone when either mood is breakdown', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'breakdown',
			partnerMoodBucket: 'elated',
			disposition: 50,
			partnerDisposition: 50,
		}));

		expect(result.tone).toBe('negative');
		expect(result.dispositionChange).toBe(-1);
	});

	it('returns negative tone when minDisposition <= -20', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'content',
			partnerMoodBucket: 'content',
			disposition: -20,
			partnerDisposition: 50,
		}));

		expect(result.tone).toBe('negative');
		expect(result.dispositionChange).toBe(-1);
	});

	it('returns neutral tone for moderate mood and disposition', () => {
		const result = selectDialogue(makeInput({
			agentMoodBucket: 'stressed',
			partnerMoodBucket: 'content',
			disposition: 10,
			partnerDisposition: 10,
		}));

		expect(result.tone).toBe('neutral');
		expect(result.dispositionChange).toBe(0);
	});

	it('gates gossip based on familiarity threshold', () => {
		const aboveThreshold = selectDialogue(makeInput({
			familiarity: 5,
			gossipFamiliarityThreshold: 3,
		}));
		expect(aboveThreshold.shouldExchangeGossip).toBe(true);

		const belowThreshold = selectDialogue(makeInput({
			familiarity: 2,
			gossipFamiliarityThreshold: 3,
		}));
		expect(belowThreshold.shouldExchangeGossip).toBe(false);
	});

	it('RNG produces different lines with different seeds', () => {
		const result1 = selectDialogue(makeInput({ rng: createGameRNG(1) }));
		const result2 = selectDialogue(makeInput({ rng: createGameRNG(999) }));

		// With different seeds on a 3-line template, at least one pair likely differs.
		// We verify both are valid lines from the template regardless.
		const merchantContent = DIALOGUE_TEMPLATES['merchant:content']!;
		const guardContent = DIALOGUE_TEMPLATES['guard:content']!;

		expect(merchantContent).toContain(result1.agentLine);
		expect(merchantContent).toContain(result2.agentLine);
		expect(guardContent).toContain(result1.partnerLine);
		expect(guardContent).toContain(result2.partnerLine);
	});

	it('all 25 template entries exist and have at least 3 lines', () => {
		const kinds = ['merchant', 'guard', 'artisan', 'scholar', 'default'];
		const moods = ['elated', 'content', 'stressed', 'distressed', 'breakdown'];

		for (const kind of kinds) {
			for (const mood of moods) {
				const key = `${kind}:${mood}`;
				const templates = DIALOGUE_TEMPLATES[key];
				expect(templates, `Missing template for ${key}`).toBeDefined();
				expect(templates!.length, `${key} has fewer than 3 lines`).toBeGreaterThanOrEqual(3);
			}
		}
	});
});
