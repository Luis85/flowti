/**
 * Shared helpers for the Train of Thoughts domain.
 */

/**
 * Derive the canvas path for a train.
 * Used by TrainCanvasSyncService, TrainMainView, and main.ts command palette.
 */
export function getCanvasPath(title: string, trainFolder: string): string {
	return trainFolder ? `${trainFolder}/${title}.canvas` : `${title}.canvas`;
}
