/**
 * Canvas2D / WebGL stub for headless ExcaliburJS tests.
 *
 * ExcaliburJS requires real WebGL/Canvas2D contexts that jsdom cannot
 * provide.  This setup file stubs HTMLCanvasElement.getContext to return
 * a Proxy-based no-op Canvas2D context so ExcaliburJS internals
 * (Detector, Raster, etc.) do not throw during construction.
 *
 * Loaded automatically via vitest.config.ts `setupFiles`.
 */

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
