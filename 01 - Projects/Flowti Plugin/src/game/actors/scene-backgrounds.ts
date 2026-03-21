/**
 * scene-backgrounds.ts — Pixel-art room interiors drawn via Canvas2D.
 *
 * Each function paints a full-scene background styled after the
 * Ninja Adventure tileset aesthetic — blocky shapes, limited palette,
 * warm lighting, and hand-placed furniture elements.
 */

// ── Shared helpers ───────────────────────────────────────────────────

/** Draw a pixel-art rectangle (snapped to grid). */
function pxRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
	ctx.fillStyle = color;
	ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Draw horizontal wood planks across a region. */
function drawWoodPlanks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, baseColor: string, altColor: string, plankH: number): void {
	let row = 0;
	for (let py = y; py < y + h; py += plankH) {
		ctx.fillStyle = row % 2 === 0 ? baseColor : altColor;
		ctx.fillRect(x, py, w, Math.min(plankH, y + h - py));
		// Plank seam
		ctx.fillStyle = "rgba(0,0,0,0.15)";
		ctx.fillRect(x, py + plankH - 1, w, 1);
		row++;
	}
}

/** Draw a stone/brick wall strip. */
function drawStoneWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color1: string, color2: string, brickW: number, brickH: number): void {
	let row = 0;
	for (let by = y; by < y + h; by += brickH) {
		const offset = row % 2 === 0 ? 0 : brickW / 2;
		for (let bx = x - brickW; bx < x + w + brickW; bx += brickW) {
			const rx = bx + offset;
			if (rx + brickW <= x || rx >= x + w) continue;
			const clippedX = Math.max(rx, x);
			const clippedW = Math.min(rx + brickW, x + w) - clippedX;
			ctx.fillStyle = (row + Math.floor((bx - x) / brickW)) % 2 === 0 ? color1 : color2;
			ctx.fillRect(clippedX, by, clippedW, Math.min(brickH, y + h - by));
			// Mortar lines
			ctx.fillStyle = "rgba(0,0,0,0.2)";
			ctx.fillRect(clippedX, by + brickH - 1, clippedW, 1);
			ctx.fillRect(clippedX + clippedW - 1, by, 1, Math.min(brickH, y + h - by));
		}
		row++;
	}
}

// ── Office — Tech Studio Interior ────────────────────────────────────

export function drawOfficeFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Floor — dark wood planks
	drawWoodPlanks(ctx, 0, 50, w, h - 50, "#1e1a14", "#1a1610", 16);

	// Back wall — stone
	drawStoneWall(ctx, 0, 0, w, 54, "#2a2a3a", "#24243a", 32, 18);

	// Wall baseboard
	pxRect(ctx, 0, 50, w, 4, "#3a3540");

	// Right wall — thinner strip
	drawStoneWall(ctx, w - 28, 0, 28, h, "#28283a", "#222238", 28, 18);

	// Windows on back wall — two light-blue panes
	for (const wx of [200, 460]) {
		// Window frame
		pxRect(ctx, wx - 2, 8, 84, 38, "#3a3540");
		// Glass panes (2×1)
		pxRect(ctx, wx, 10, 38, 34, "#1a3a5a");
		pxRect(ctx, wx + 42, 10, 38, 34, "#1a3a5a");
		// Mullion
		pxRect(ctx, wx + 38, 10, 4, 34, "#3a3540");
		pxRect(ctx, wx, 25, 80, 3, "#3a3540");
		// Light glow from window
		const grad = ctx.createRadialGradient(wx + 40, 44, 0, wx + 40, 44, 80);
		grad.addColorStop(0, "rgba(100, 160, 220, 0.08)");
		grad.addColorStop(1, "rgba(100, 160, 220, 0)");
		ctx.fillStyle = grad;
		ctx.fillRect(wx - 40, 44, 160, 100);
	}

	// Bookshelf on right wall
	const shelfX = w - 26;
	pxRect(ctx, shelfX, 60, 24, 120, "#3d2a1e");
	// Shelves
	for (const sy of [60, 90, 120, 150]) {
		pxRect(ctx, shelfX, sy, 24, 3, "#4a3525");
		// Books
		const bookColors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];
		let bx = shelfX + 2;
		for (let i = 0; i < 4 && bx < shelfX + 20; i++) {
			const bw = 3 + Math.floor(Math.random() * 3);
			ctx.fillStyle = bookColors[Math.floor(Math.random() * bookColors.length)];
			ctx.fillRect(bx, sy + 3, bw, 26);
			bx += bw + 1;
		}
	}

	// Floor rug under desk area
	pxRect(ctx, 120, 120, 420, 240, "#1a2540");
	pxRect(ctx, 124, 124, 412, 232, "#16203a");
	// Rug border pattern
	ctx.strokeStyle = "#2a3a5a";
	ctx.lineWidth = 1;
	ctx.setLineDash([4, 4]);
	ctx.strokeRect(128, 128, 404, 224);
	ctx.setLineDash([]);

	// Wall clock on back wall
	pxRect(ctx, 370, 14, 20, 20, "#2a2018");
	ctx.fillStyle = "#f5f0e0";
	ctx.beginPath();
	ctx.arc(380, 24, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "#1a1510";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(380, 24);
	ctx.lineTo(380, 18);
	ctx.moveTo(380, 24);
	ctx.lineTo(384, 24);
	ctx.stroke();

	// Floor cable conduit
	ctx.strokeStyle = "#2a2520";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(600, h);
	ctx.lineTo(600, 300);
	ctx.lineTo(w - 28, 300);
	ctx.stroke();

	// Ambient glow from monitors
	for (const gx of [180, 340, 500]) {
		const grad = ctx.createRadialGradient(gx, 170, 0, gx, 170, 40);
		grad.addColorStop(0, "rgba(59, 130, 246, 0.06)");
		grad.addColorStop(1, "rgba(59, 130, 246, 0)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(gx, 170, 40, 0, Math.PI * 2);
		ctx.fill();
	}
}

// ── Village — Garden Workshop ────────────────────────────────────────

export function drawVillageFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Grass base — two-tone green
	for (let y = 0; y < h; y += 16) {
		for (let x = 0; x < w; x += 16) {
			const shade = ((x + y) / 16) % 3 === 0 ? "#1a2a12" : ((x + y) / 16) % 3 === 1 ? "#1e2e16" : "#1a2810";
			pxRect(ctx, x, y, 16, 16, shade);
		}
	}

	// Grass tufts — small random lighter patches
	ctx.fillStyle = "#2a3e1a";
	for (let i = 0; i < 30; i++) {
		const gx = Math.floor(Math.random() * w / 8) * 8;
		const gy = Math.floor(Math.random() * h / 8) * 8 + 60;
		if (gy < h - 40) {
			ctx.fillRect(gx, gy, 4, 2);
			ctx.fillRect(gx + 2, gy - 2, 2, 2);
		}
	}

	// Stone path from door to work area
	const pathY = h / 2;
	for (let px = 20; px < 550; px += 24) {
		const stoneY = pathY - 12 + Math.sin(px * 0.05) * 4;
		const stoneColors = ["#4a4a42", "#3e3e38", "#44443c"];
		ctx.fillStyle = stoneColors[Math.floor(Math.random() * stoneColors.length)];
		ctx.beginPath();
		ctx.ellipse(px, stoneY, 14, 8, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(0,0,0,0.3)";
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	// Wooden fence along top
	pxRect(ctx, 0, 0, w, 8, "#3d2a1e");
	pxRect(ctx, 0, 8, w, 4, "#5c4033");
	pxRect(ctx, 0, 32, w, 4, "#5c4033");
	// Fence posts
	for (let fx = 30; fx < w; fx += 60) {
		pxRect(ctx, fx - 3, 0, 6, 44, "#4a3525");
		pxRect(ctx, fx - 1, 0, 2, 4, "#5c4a3a");
	}

	// Trees at corners (back-right and back-left edges)
	for (const [tx, ty] of [[w - 70, 50], [w - 120, 70], [80, 60]] as const) {
		// Trunk
		pxRect(ctx, tx - 4, ty, 8, 20, "#4a3525");
		pxRect(ctx, tx - 3, ty + 2, 6, 16, "#5c4033");
		// Canopy — layered circles
		for (const [ox, oy, r] of [[0, -10, 18], [-8, -4, 12], [8, -4, 12]] as const) {
			ctx.fillStyle = "#1a4a1a";
			ctx.beginPath();
			ctx.arc(tx + ox, ty + oy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		// Highlight
		ctx.fillStyle = "#2a5a2a";
		ctx.beginPath();
		ctx.arc(tx - 4, ty - 14, 8, 0, Math.PI * 2);
		ctx.fill();
	}

	// Flower patches
	const flowerColors = ["#ef4444", "#f59e0b", "#ec4899", "#a855f7", "#f97316"];
	for (const [fx, fy] of [[650, 400], [700, 420], [720, 380], [100, 400], [140, 380], [660, 100], [700, 120]] as const) {
		// Stem
		ctx.fillStyle = "#2a4a1a";
		ctx.fillRect(fx, fy - 4, 2, 6);
		// Petals
		ctx.fillStyle = flowerColors[Math.floor(Math.random() * flowerColors.length)];
		ctx.beginPath();
		ctx.arc(fx + 1, fy - 6, 3, 0, Math.PI * 2);
		ctx.fill();
		// Center
		ctx.fillStyle = "#fbbf24";
		ctx.beginPath();
		ctx.arc(fx + 1, fy - 6, 1, 0, Math.PI * 2);
		ctx.fill();
	}

	// Wooden awning/canopy over work area
	pxRect(ctx, 140, 100, 380, 6, "#5c4033");
	pxRect(ctx, 140, 106, 380, 3, "#4a3525");
	// Support posts
	for (const px of [144, 516]) {
		pxRect(ctx, px, 100, 6, 180, "#4a3525");
		pxRect(ctx, px + 1, 102, 4, 176, "#5c4033");
	}

	// Wooden platform under work area
	drawWoodPlanks(ctx, 150, 270, 360, 60, "#3d2a1e", "#4a3525", 12);

	// Lantern posts
	for (const [lx, ly] of [[60, 180], [w - 60, 300]] as const) {
		// Post
		pxRect(ctx, lx - 2, ly, 4, 40, "#4a3525");
		// Lantern
		pxRect(ctx, lx - 5, ly - 4, 10, 8, "#5c4033");
		pxRect(ctx, lx - 3, ly - 2, 6, 4, "#fbbf24");
		// Glow
		const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 50);
		grad.addColorStop(0, "rgba(251, 191, 36, 0.1)");
		grad.addColorStop(1, "rgba(251, 191, 36, 0)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(lx, ly, 50, 0, Math.PI * 2);
		ctx.fill();
	}

	// Bottom border — dirt path
	pxRect(ctx, 0, h - 20, w, 20, "#2a2018");
	pxRect(ctx, 0, h - 22, w, 2, "#3d2a1e");
}

// ── Station — Command Center ─────────────────────────────────────────

export function drawStationFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Metal tile floor
	const tileSize = 32;
	for (let y = 0; y < h; y += tileSize) {
		for (let x = 0; x < w; x += tileSize) {
			const shade = ((x / tileSize + y / tileSize) % 2 === 0) ? "#0e1218" : "#10141a";
			pxRect(ctx, x, y, tileSize, tileSize, shade);
			// Tile border
			ctx.strokeStyle = "rgba(100,120,140,0.1)";
			ctx.lineWidth = 0.5;
			ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
		}
	}

	// Warning stripes along bottom edge
	const stripeW = 16;
	for (let sx = 0; sx < w; sx += stripeW * 2) {
		pxRect(ctx, sx, h - 12, stripeW, 12, "#f59e0b");
		pxRect(ctx, sx + stripeW, h - 12, stripeW, 12, "#1a1a1a");
	}
	pxRect(ctx, 0, h - 14, w, 2, "#2a2a2a");

	// Back wall — dark panels with glow seams
	pxRect(ctx, 0, 0, w, 56, "#0a0e14");
	// Horizontal light strip
	pxRect(ctx, 0, 52, w, 2, "#06b6d4");
	ctx.globalAlpha = 0.3;
	pxRect(ctx, 0, 54, w, 2, "#06b6d4");
	ctx.globalAlpha = 1;

	// Wall-mounted screens on back wall
	for (const [sx, sw] of [[120, 100], [300, 160], [560, 100]] as const) {
		// Screen bezel
		pxRect(ctx, sx - 3, 8, sw + 6, 40, "#1a1e24");
		// Screen
		pxRect(ctx, sx, 10, sw, 36, "#0a1a2a");
		// Scan line effect
		for (let ly = 12; ly < 44; ly += 4) {
			ctx.fillStyle = "rgba(6, 182, 212, 0.04)";
			ctx.fillRect(sx + 2, ly, sw - 4, 1);
		}
		// Status bar at bottom of screen
		pxRect(ctx, sx + 4, 38, sw - 8, 4, "#0e2a3a");
		// Blinking dots
		for (let dx = 0; dx < 4; dx++) {
			ctx.fillStyle = dx < 3 ? "#22c55e" : "#ef4444";
			ctx.beginPath();
			ctx.arc(sx + 10 + dx * 8, 40, 1.5, 0, Math.PI * 2);
			ctx.fill();
		}
		// Screen glow
		const grad = ctx.createRadialGradient(sx + sw / 2, 30, 0, sx + sw / 2, 56, 60);
		grad.addColorStop(0, "rgba(6, 182, 212, 0.06)");
		grad.addColorStop(1, "rgba(6, 182, 212, 0)");
		ctx.fillStyle = grad;
		ctx.fillRect(sx - 20, 30, sw + 40, 80);
	}

	// Right wall — server rack strip
	pxRect(ctx, w - 32, 0, 32, h, "#0e1218");
	pxRect(ctx, w - 34, 0, 2, h, "#06b6d4");
	ctx.globalAlpha = 0.2;
	pxRect(ctx, w - 36, 0, 2, h, "#06b6d4");
	ctx.globalAlpha = 1;

	// Server rack units on right wall
	for (let ry = 60; ry < h - 60; ry += 30) {
		pxRect(ctx, w - 28, ry, 24, 24, "#141a22");
		pxRect(ctx, w - 26, ry + 2, 20, 20, "#0a1018");
		// Rack indicator LEDs
		for (let led = 0; led < 3; led++) {
			const ledColor = Math.random() > 0.3 ? "#22c55e" : "#ef4444";
			ctx.fillStyle = ledColor;
			ctx.beginPath();
			ctx.arc(w - 22 + led * 6, ry + 6, 1.5, 0, Math.PI * 2);
			ctx.fill();
		}
		// Ventilation lines
		for (let vl = 0; vl < 3; vl++) {
			ctx.fillStyle = "#1a2030";
			ctx.fillRect(w - 24, ry + 12 + vl * 4, 16, 1);
		}
	}

	// Central hologram projector pad
	ctx.fillStyle = "#0e2030";
	ctx.beginPath();
	ctx.ellipse(400, 350, 40, 20, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "#06b6d4";
	ctx.lineWidth = 1;
	ctx.stroke();
	// Inner ring
	ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
	ctx.beginPath();
	ctx.ellipse(400, 350, 25, 12, 0, 0, Math.PI * 2);
	ctx.stroke();
	// Glow
	const holoGrad = ctx.createRadialGradient(400, 350, 0, 400, 350, 50);
	holoGrad.addColorStop(0, "rgba(6, 182, 212, 0.08)");
	holoGrad.addColorStop(1, "rgba(6, 182, 212, 0)");
	ctx.fillStyle = holoGrad;
	ctx.beginPath();
	ctx.arc(400, 350, 50, 0, Math.PI * 2);
	ctx.fill();

	// Floor markings — dashed guide lines
	ctx.strokeStyle = "rgba(6, 182, 212, 0.08)";
	ctx.lineWidth = 1;
	ctx.setLineDash([8, 8]);
	ctx.beginPath();
	ctx.moveTo(60, h / 2);
	ctx.lineTo(w - 40, h / 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(w / 2, 56);
	ctx.lineTo(w / 2, h - 14);
	ctx.stroke();
	ctx.setLineDash([]);
}

// ── Hub — Central Gathering Floor ─────────────────────────────────────

export function drawHubFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Base floor
	ctx.fillStyle = "#0d1117";
	ctx.fillRect(0, 0, w, h);

	// Subtle grid
	ctx.strokeStyle = "#1b2332";
	ctx.lineWidth = 0.5;
	for (let x = 0; x < w; x += 40) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, h);
		ctx.stroke();
	}
	for (let y = 0; y < h; y += 40) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}

	// Center radial glow
	const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 180);
	gradient.addColorStop(0, "rgba(30, 41, 59, 0.3)");
	gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);

	// Top border accent
	ctx.fillStyle = "#1e293b";
	ctx.fillRect(0, 0, w, 3);
	// Bottom border accent
	ctx.fillRect(0, h - 3, w, 3);
}
