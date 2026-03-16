/**
 * scene-backgrounds.ts — Pure Canvas2D drawing functions for themed room floors.
 *
 * Each function paints a full-scene background with grid patterns and
 * ambient glow spots that hint at workstation positions.
 */

// ── Office ──────────────────────────────────────────────────────────

export function drawOfficeFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Base fill — dark blue-gray
	ctx.fillStyle = "#0c1524";
	ctx.fillRect(0, 0, w, h);

	// Terminal-green grid
	ctx.strokeStyle = "#1a3a2a";
	ctx.lineWidth = 0.5;
	for (let x = 0; x <= w; x += 40) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, h);
		ctx.stroke();
	}
	for (let y = 0; y <= h; y += 40) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}

	// Monitor glow spots — green-blue tint at workstation-ish positions
	const glowSpots = [
		{ x: w * 0.2, y: h * 0.3 },
		{ x: w * 0.5, y: h * 0.25 },
		{ x: w * 0.75, y: h * 0.4 },
		{ x: w * 0.4, y: h * 0.6 },
	];
	for (const spot of glowSpots) {
		const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, 30);
		grad.addColorStop(0, "rgba(34, 197, 94, 0.12)");
		grad.addColorStop(1, "rgba(34, 197, 94, 0)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(spot.x, spot.y, 30, 0, Math.PI * 2);
		ctx.fill();
	}
}

// ── Village ─────────────────────────────────────────────────────────

export function drawVillageFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Base fill — warm brown
	ctx.fillStyle = "#15120d";
	ctx.fillRect(0, 0, w, h);

	// Cobblestone pattern — alternating 20x20 blocks with row offset
	const stoneSize = 20;
	const colors = ["#1a150f", "#12100b"];
	for (let row = 0; row * stoneSize < h; row++) {
		const offsetX = row % 2 === 0 ? 0 : stoneSize / 2;
		for (let col = -1; col * stoneSize < w + stoneSize; col++) {
			const x = col * stoneSize + offsetX;
			const y = row * stoneSize;
			ctx.fillStyle = colors[(row + col) % 2 === 0 ? 0 : 1];
			ctx.fillRect(x, y, stoneSize, stoneSize);
		}
	}

	// Warm lantern glow spots — orange-yellow tint
	const lanterns = [
		{ x: w * 0.15, y: h * 0.2 },
		{ x: w * 0.55, y: h * 0.35 },
		{ x: w * 0.8, y: h * 0.25 },
		{ x: w * 0.35, y: h * 0.7 },
	];
	for (const spot of lanterns) {
		const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, 40);
		grad.addColorStop(0, "rgba(251, 191, 36, 0.1)");
		grad.addColorStop(1, "rgba(251, 191, 36, 0)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(spot.x, spot.y, 40, 0, Math.PI * 2);
		ctx.fill();
	}
}

// ── Station ─────────────────────────────────────────────────────────

export function drawStationFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Base fill — dark teal
	ctx.fillStyle = "#080d14";
	ctx.fillRect(0, 0, w, h);

	// Hex-inspired grid — vertical lines with horizontal connectors
	ctx.strokeStyle = "#0e3d4a";
	ctx.lineWidth = 0.5;
	const vSpacing = 50;
	const hConnectorSpacing = 40;

	for (let x = 0; x <= w; x += vSpacing) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, h);
		ctx.stroke();

		// Short horizontal connectors every 40px along each vertical
		for (let y = 0; y <= h; y += hConnectorSpacing) {
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + vSpacing * 0.4, y);
			ctx.stroke();
		}
	}

	// Console glow spots — cyan tint
	const consoles = [
		{ x: w * 0.25, y: h * 0.3 },
		{ x: w * 0.6, y: h * 0.2 },
		{ x: w * 0.45, y: h * 0.55 },
		{ x: w * 0.8, y: h * 0.45 },
	];
	for (const spot of consoles) {
		const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, 25);
		grad.addColorStop(0, "rgba(6, 182, 212, 0.14)");
		grad.addColorStop(1, "rgba(6, 182, 212, 0)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(spot.x, spot.y, 25, 0, Math.PI * 2);
		ctx.fill();
	}
}
