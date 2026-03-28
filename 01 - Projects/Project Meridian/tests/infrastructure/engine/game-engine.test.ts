import { describe, it, expect } from 'vitest';
import * as ex from 'excalibur';
import { createTestActor } from '../../../src/infrastructure/engine/game-engine.js';

/**
 * ExcaliburJS Engine requires real WebGL/Canvas2D contexts that jsdom
 * cannot provide. The canvas stub is loaded globally via
 * vitest.config.ts `setupFiles` (tests/setup/canvas-stub.ts).
 *
 * createGameEngine is tested indirectly — it compiles and is
 * exercised by the game-view integration in Obsidian. The unit tests
 * here focus on the pure actor-creation helpers that we CAN validate
 * in a headless environment with the canvas stub.
 */

describe('GameEngine', () => {
	it('creates a test actor at the specified position', () => {
		const actor = createTestActor({ x: 100, y: 200 });
		expect(actor).toBeInstanceOf(ex.Actor);
		expect(actor.pos.x).toBe(100);
		expect(actor.pos.y).toBe(200);
	});

	it('creates a test actor with dimensions', () => {
		const actor = createTestActor({ x: 0, y: 0 });
		expect(actor.width).toBe(32);
		expect(actor.height).toBe(32);
	});

	it('exports createGameEngine function', async () => {
		const mod = await import('../../../src/infrastructure/engine/game-engine.js');
		expect(typeof mod.createGameEngine).toBe('function');
	});
});
