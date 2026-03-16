/**
 * pixel-sprites.ts — Pixel-art sprite rendering for agent actors.
 *
 * Provides color utilities and pose drawing functions that render
 * 24x32 pixel-art characters onto a CanvasRenderingContext2D.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface SpritePalette {
	readonly body: string;
	readonly limb: string;
	readonly hair: string;
}

// ── Color Utilities ──────────────────────────────────────────────────

/**
 * Hash a name string into a deterministic HSL-based hex color for hair.
 * Produces visually distinct hues across different names.
 */
export function hashColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
	}
	const hue = ((hash % 360) + 360) % 360;
	const saturation = 60;
	const lightness = 45;
	return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
	const sNorm = s / 100;
	const lNorm = l / 100;
	const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = lNorm - c / 2;
	let r = 0, g = 0, b = 0;

	if (h < 60) { r = c; g = x; b = 0; }
	else if (h < 120) { r = x; g = c; b = 0; }
	else if (h < 180) { r = 0; g = c; b = x; }
	else if (h < 240) { r = 0; g = x; b = c; }
	else if (h < 300) { r = x; g = 0; b = c; }
	else { r = c; g = 0; b = x; }

	const toHex = (v: number) => {
		const hex = Math.round((v + m) * 255).toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	};
	return "#" + toHex(r) + toHex(g) + toHex(b);
}

const STATUS_BODY_LIMB: Record<string, { body: string; limb: string }> = {
	busy: { body: "#22c55e", limb: "#16a34a" },
	idle: { body: "#3b82f6", limb: "#2563eb" },
	unassigned: { body: "#6b7280", limb: "#4b5563" },
	waiting: { body: "#f59e0b", limb: "#d97706" },
};

/**
 * Map a status string to body and limb colors.
 */
export function statusPalette(status: string): { body: string; limb: string } {
	return STATUS_BODY_LIMB[status] ?? STATUS_BODY_LIMB["unassigned"];
}

// ── Drawing Helpers ──────────────────────────────────────────────────

function drawMouth(ctx: CanvasRenderingContext2D, x: number, y: number, mood: string): void {
	ctx.fillStyle = "#1a1a2e";
	if (mood === "happy" || mood === "excited") {
		// smile: 2px wide arc approximation
		ctx.fillRect(x, y, 1, 1);
		ctx.fillRect(x + 1, y + 1, 1, 1);
		ctx.fillRect(x + 2, y, 1, 1);
	} else if (mood === "frustrated" || mood === "angry") {
		// frown
		ctx.fillRect(x, y + 1, 1, 1);
		ctx.fillRect(x + 1, y, 1, 1);
		ctx.fillRect(x + 2, y + 1, 1, 1);
	} else {
		// neutral line
		ctx.fillRect(x, y, 3, 1);
	}
}

function drawEyes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(x, y, 1, 1);
	ctx.fillRect(x + 2, y, 1, 1);
}

function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, palette: SpritePalette, mood: string): void {
	// Hair (top 2 rows of 4x4 head)
	ctx.fillStyle = palette.hair;
	ctx.fillRect(x, y, 4, 2);

	// Face / body color (bottom 2 rows of head)
	ctx.fillStyle = palette.body;
	ctx.fillRect(x, y + 2, 4, 2);

	// Eyes on row y+2
	drawEyes(ctx, x + 1, y + 2);

	// Mouth on row y+3
	drawMouth(ctx, x + 1, y + 3, mood);
}

function applyFlip(
	ctx: CanvasRenderingContext2D,
	flip: boolean,
	width: number,
	drawFn: () => void,
): void {
	if (flip) {
		ctx.save();
		ctx.translate(width, 0);
		ctx.scale(-1, 1);
		drawFn();
		ctx.restore();
	} else {
		drawFn();
	}
}

// ── Pose: Idle ───────────────────────────────────────────────────────

/**
 * Draw the idle standing pose (24x32 sprite area).
 * Head at y=2, body at y=7, arms at sides, legs below body.
 */
export function drawIdlePose(
	ctx: CanvasRenderingContext2D,
	palette: SpritePalette,
	mood: string,
	flip: boolean,
): void {
	applyFlip(ctx, flip, 24, () => {
		// Head: 4x4 at center (x=10, y=2)
		drawHead(ctx, 10, 2, palette, mood);

		// Body: 6x8 rect at (x=9, y=7)
		ctx.fillStyle = palette.body;
		ctx.fillRect(9, 7, 6, 8);

		// Left arm: 2px wide at x=7
		ctx.fillStyle = palette.limb;
		ctx.fillRect(7, 8, 2, 7);

		// Right arm: 2px wide at x=15
		ctx.fillRect(15, 8, 2, 7);

		// Left leg: 2px wide at x=9
		ctx.fillRect(9, 15, 2, 6);

		// Right leg: 2px wide at x=13
		ctx.fillRect(13, 15, 2, 6);
	});
}
