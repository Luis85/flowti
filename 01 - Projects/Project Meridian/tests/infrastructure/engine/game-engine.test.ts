import { describe, it, expect, beforeAll } from 'vitest';
import * as ex from 'excalibur';
import { createTestSprite } from '../../../src/infrastructure/engine/game-engine.js';

/**
 * ExcaliburJS Engine requires real WebGL/Canvas2D contexts that jsdom
 * cannot provide. We stub HTMLCanvasElement.getContext to return a
 * minimal mock so that ExcaliburJS internals (Detector, Raster) do
 * not throw during construction.
 *
 * createGameEngine is tested indirectly — it compiles and is
 * exercised by the game-view integration in Obsidian. The unit tests
 * here focus on the pure actor-creation helpers that we CAN validate
 * in a headless environment with the canvas stub.
 */
/**
 * Proxy-based Canvas2D stub: returns a no-op function for any
 * missing method and a sensible default for property reads.
 * This avoids whack-a-mole when ExcaliburJS internals call
 * canvas methods that jsdom does not implement.
 */
beforeAll(() => {
	const knownValues: Record<string, unknown> = {
		canvas: document.createElement('canvas'),
		fillStyle: '',
		strokeStyle: '',
		font: '',
		lineWidth: 1,
		lineCap: 'butt',
		lineJoin: 'miter',
		shadowOffsetX: 0,
		shadowOffsetY: 0,
		shadowBlur: 0,
		shadowColor: '',
		globalAlpha: 1,
		globalCompositeOperation: 'source-over',
		imageSmoothingEnabled: true,
	};

	const methodReturns: Record<string, () => unknown> = {
		getImageData: () => ({ data: new Uint8ClampedArray(0) }),
		createImageData: () => ({ data: new Uint8ClampedArray(0) }),
		measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
		getLineDash: () => [],
		createLinearGradient: () => new Proxy({}, { get: () => () => {} }),
		createRadialGradient: () => new Proxy({}, { get: () => () => {} }),
		createPattern: () => ({}),
	};

	const stub2d = new Proxy({} as Record<string | symbol, unknown>, {
		get(_target, prop) {
			if (typeof prop === 'symbol') return undefined;
			if (prop in knownValues) return knownValues[prop];
			if (prop in methodReturns) return methodReturns[prop];
			return () => {};
		},
		set(_target, prop, value) {
			if (typeof prop === 'string') knownValues[prop] = value;
			return true;
		},
	});

	const originalGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
		if (type === '2d') {
			return stub2d as unknown as CanvasRenderingContext2D;
		}
		return originalGetContext.call(this, type, ...args);
	} as typeof originalGetContext;

	HTMLCanvasElement.prototype.toDataURL = function () {
		return 'data:image/png;base64,stub';
	};
});

describe('GameEngine', () => {
	it('creates a test sprite actor at the specified position', () => {
		const sprite = createTestSprite({ x: 100, y: 200 });
		expect(sprite).toBeInstanceOf(ex.Actor);
		expect(sprite.pos.x).toBe(100);
		expect(sprite.pos.y).toBe(200);
	});

	it('creates a test sprite with dimensions', () => {
		const sprite = createTestSprite({ x: 0, y: 0 });
		expect(sprite.width).toBe(32);
		expect(sprite.height).toBe(32);
	});

	it('exports createGameEngine function', async () => {
		const mod = await import('../../../src/infrastructure/engine/game-engine.js');
		expect(typeof mod.createGameEngine).toBe('function');
	});
});
