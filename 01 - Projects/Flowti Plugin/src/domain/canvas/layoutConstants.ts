/**
 * Shared canvas layout constants and domain-specific presets (TD-131).
 *
 * Consolidates duplicated layout values from canvasSync, canvasTemplates,
 * and TrainCanvasWriter into a single source of truth.
 */

// ── Shared base constants ────────────────────────────────────

export const CANVAS_GAP = 40;
export const CANVAS_PADDING = 40;

// ── Journey canvas preset ────────────────────────────────────

export const JOURNEY_LAYOUT = {
	NODE_W: 160,
	NODE_H: 80,
	GROUP_W: 480,
	GROUP_H: 160,
	INNER_PAD: 50,
	INNER_W: 480 - 50 * 2, // GROUP_W - INNER_PAD * 2
	INNER_H: 60,
} as const;

// ── Template canvas preset ───────────────────────────────────

export const TEMPLATE_LAYOUT = {
	GROUP_W: 460,
	GROUP_H: 400,
	CARD_W: 380,
	CARD_H: 80,
	CARD_PAD: 40,
} as const;

// ── Train canvas preset ──────────────────────────────────────

export const TRAIN_LAYOUT = {
	NODE_WIDTH: 400,
	NODE_HEIGHT: 200,
	SPACING_Y: 280,
	BRANCH_LANE_WIDTH: 500,
	GROUP_PADDING: 40,
} as const;
