import * as ex from 'excalibur';

/**
 * Custom ExcaliburJS loader for Obsidian integration.
 *
 * Suppresses the default loading screen (no "click to start" prompt).
 * Uses a minimal progress indicator that respects Obsidian theming.
 *
 * Usage:
 *   const loader = createGameLoader();
 *   // loader.addResource(myImage);  // Future: add sprites, tilemaps, etc.
 *   await engine.start(loader);
 */
export function createGameLoader(): ex.DefaultLoader {
	const loader = new ex.DefaultLoader();

	// Override the user action prompt — in Obsidian, the user already clicked to open the view
	loader.onUserAction = () => Promise.resolve();

	return loader;
}
