/**
 * Defer work until after the browser has presented the next frame.
 * Keeps long interaction handlers from blocking the first paint after store/UI updates
 * (e.g. agent panel opening before Excalibur camera strategies or CLI spawn).
 */
export function afterNextPaint(callback: () => void): void {
	if (typeof requestAnimationFrame === "undefined") {
		globalThis.setTimeout(callback, 0);
		return;
	}
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			callback();
		});
	});
}
