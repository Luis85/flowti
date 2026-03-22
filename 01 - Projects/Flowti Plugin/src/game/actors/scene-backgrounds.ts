/**
 * scene-backgrounds.ts — Pixel-art room interiors drawn via Canvas2D.
 *
 * Each function paints a full-scene background styled after the
 * Ninja Adventure tileset aesthetic — blocky shapes, limited palette,
 * warm lighting, and hand-placed furniture elements.
 *
 * Rooms:
 *   Hub     → Tavern       (warm wood, stone walls, barrels, lanterns)
 *   Office  → Dojo         (tatami floors, paper walls, weapon racks)
 *   Village → Market Square (cobblestone, stalls, crates, fabrics)
 *   Station → Workshop     (dark stone, forge, tool racks, embers)
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

/** Draw a cobblestone pattern with rounded stones. */
function drawCobblestones(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colors: readonly string[], stoneSize: number): void {
	let row = 0;
	for (let sy = y; sy < y + h; sy += stoneSize) {
		const offset = row % 2 === 0 ? 0 : stoneSize / 2;
		for (let sx = x - stoneSize; sx < x + w + stoneSize; sx += stoneSize) {
			const rx = sx + offset;
			if (rx + stoneSize <= x || rx >= x + w) continue;
			const cx = rx + stoneSize / 2;
			const cy = sy + stoneSize / 2;
			ctx.fillStyle = colors[(row + Math.floor((sx - x) / stoneSize)) % colors.length];
			ctx.beginPath();
			ctx.ellipse(cx, cy, stoneSize / 2 - 1, stoneSize / 2 - 1, 0, 0, Math.PI * 2);
			ctx.fill();
			// Mortar shadow
			ctx.strokeStyle = "rgba(0,0,0,0.25)";
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		row++;
	}
}

/** Draw a lantern with warm glow. */
function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
	// Bracket
	pxRect(ctx, x - 2, y - 8, 4, 6, "#5c4033");
	// Lantern body
	pxRect(ctx, x - 4, y - 2, 8, 10, "#5c4033");
	pxRect(ctx, x - 3, y, 6, 6, "#fbbf24");
	// Warm glow
	const grad = ctx.createRadialGradient(x, y + 2, 0, x, y + 2, radius);
	grad.addColorStop(0, "rgba(251, 191, 36, 0.12)");
	grad.addColorStop(0.5, "rgba(251, 146, 20, 0.06)");
	grad.addColorStop(1, "rgba(251, 146, 20, 0)");
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(x, y + 2, radius, 0, Math.PI * 2);
	ctx.fill();
}

/** Draw a barrel shape. */
function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
	// Body
	pxRect(ctx, x - 8, y, 16, 20, "#6b5940");
	pxRect(ctx, x - 9, y + 4, 18, 2, "#5c4a35");
	pxRect(ctx, x - 9, y + 14, 18, 2, "#5c4a35");
	// Stave lines
	ctx.fillStyle = "rgba(0,0,0,0.12)";
	ctx.fillRect(x - 4, y, 1, 20);
	ctx.fillRect(x + 3, y, 1, 20);
	// Top rim
	pxRect(ctx, x - 7, y - 2, 14, 3, "#4e3d2a");
	// Highlight
	ctx.fillStyle = "rgba(255,255,255,0.06)";
	ctx.fillRect(x - 6, y + 2, 3, 14);
}

/** Draw a simple crate. */
function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
	pxRect(ctx, x, y, size, size, "#5c4033");
	pxRect(ctx, x + 1, y + 1, size - 2, size - 2, "#6b5240");
	// Cross bracing
	ctx.strokeStyle = "#4a3525";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + size, y + size);
	ctx.moveTo(x + size, y);
	ctx.lineTo(x, y + size);
	ctx.stroke();
	// Nail dots
	ctx.fillStyle = "#8a7a6a";
	ctx.fillRect(x + 2, y + 2, 2, 2);
	ctx.fillRect(x + size - 4, y + 2, 2, 2);
}

// ── Hub — Tavern ─────────────────────────────────────────────────────

export function drawTavernFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Floor — warm wood planks
	drawWoodPlanks(ctx, 0, 56, w, h - 56, "#5c4a35", "#4e3d2a", 14);

	// Plank stagger — offset darker strips for visual interest
	for (let py = 56; py < h; py += 28) {
		const stripX = ((py - 56) / 28) % 2 === 0 ? 100 : 260;
		pxRect(ctx, stripX, py, 2, 14, "rgba(0,0,0,0.08)");
		pxRect(ctx, stripX + 200, py, 2, 14, "rgba(0,0,0,0.08)");
	}

	// Back wall — stone blocks
	drawStoneWall(ctx, 0, 0, w, 58, "#3a3a4a", "#2e2e3a", 28, 18);
	// Mortar accent line at wall base
	pxRect(ctx, 0, 54, w, 4, "#1a1a24");

	// Right wall — wood panelling
	drawWoodPlanks(ctx, w - 30, 0, 30, h, "#4a3a28", "#3e3020", 20);
	pxRect(ctx, w - 32, 0, 2, h, "#2e2418");

	// Wall-mounted shelves on back wall
	for (const shelfX of [140, 400, 580]) {
		pxRect(ctx, shelfX, 30, 60, 4, "#5c4033");
		pxRect(ctx, shelfX, 34, 60, 2, "#4a3525");
		// Bottles/mugs
		const bottleColors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6"];
		for (let i = 0; i < 3; i++) {
			const bx = shelfX + 8 + i * 18;
			ctx.fillStyle = bottleColors[i % bottleColors.length];
			ctx.fillRect(bx, 20, 4, 10);
			ctx.fillStyle = "#4a3a28";
			ctx.fillRect(bx - 1, 18, 6, 3);
		}
	}

	// Lanterns on back wall
	drawLantern(ctx, 80, 22, 50);
	drawLantern(ctx, 340, 22, 50);
	drawLantern(ctx, 700, 22, 50);

	// Barrels in corners
	drawBarrel(ctx, 50, 80);
	drawBarrel(ctx, 70, 100);
	drawBarrel(ctx, w - 50, 400);

	// Large floor rug — warm rug under center area
	pxRect(ctx, 160, 140, 360, 220, "#4a2020");
	pxRect(ctx, 164, 144, 352, 212, "#3e1a1a");
	// Rug border pattern
	ctx.strokeStyle = "#6a3030";
	ctx.lineWidth = 2;
	ctx.setLineDash([6, 4]);
	ctx.strokeRect(168, 148, 344, 204);
	ctx.setLineDash([]);
	// Rug center motif
	ctx.strokeStyle = "#7a4040";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(340, 250, 30, 0, Math.PI * 2);
	ctx.stroke();

	// Fireplace on right wall
	const fpX = w - 28;
	pxRect(ctx, fpX - 20, 160, 18, 28, "#2a2a2a");
	pxRect(ctx, fpX - 18, 162, 14, 24, "#1a0a0a");
	// Fire glow
	const fireGrad = ctx.createRadialGradient(fpX - 11, 178, 0, fpX - 11, 178, 40);
	fireGrad.addColorStop(0, "rgba(239, 68, 68, 0.12)");
	fireGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.06)");
	fireGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
	ctx.fillStyle = fireGrad;
	ctx.beginPath();
	ctx.arc(fpX - 11, 178, 40, 0, Math.PI * 2);
	ctx.fill();
	// Ember flickers
	ctx.fillStyle = "#f59e0b";
	ctx.fillRect(fpX - 16, 176, 3, 3);
	ctx.fillStyle = "#ef4444";
	ctx.fillRect(fpX - 10, 180, 2, 2);
	ctx.fillStyle = "#fbbf24";
	ctx.fillRect(fpX - 12, 172, 2, 4);

	// Bottom border — timber
	pxRect(ctx, 0, h - 6, w, 6, "#3e3020");
	pxRect(ctx, 0, h - 8, w, 2, "#4a3a28");
}

// ── Office — Dojo ────────────────────────────────────────────────────

export function drawDojoFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Tatami grid floor
	const tatW = 48;
	const tatH = 24;
	for (let ty = 56; ty < h; ty += tatH) {
		for (let tx = 0; tx < w; tx += tatW) {
			const isAlt = ((tx / tatW + ty / tatH) % 2 === 0);
			pxRect(ctx, tx, ty, tatW, tatH, isAlt ? "#7a6a4a" : "#6e5e40");
			// Tatami edge border
			ctx.strokeStyle = "#5a4a30";
			ctx.lineWidth = 1;
			ctx.strokeRect(tx + 0.5, ty + 0.5, tatW - 1, tatH - 1);
			// Weave texture lines
			ctx.fillStyle = "rgba(0,0,0,0.04)";
			for (let line = tx + 4; line < tx + tatW; line += 8) {
				ctx.fillRect(line, ty + 1, 1, tatH - 2);
			}
		}
	}

	// Dark border strip around tatami
	pxRect(ctx, 0, 54, w, 3, "#3a2a18");

	// Back wall — paper screen panels with wood frames
	pxRect(ctx, 0, 0, w, 56, "#b0a080");
	// Wood frame grid
	for (let fx = 0; fx < w; fx += 100) {
		pxRect(ctx, fx, 0, 4, 56, "#5c4033");
	}
	pxRect(ctx, 0, 0, w, 4, "#5c4033");
	pxRect(ctx, 0, 52, w, 4, "#5c4033");
	pxRect(ctx, 0, 26, w, 3, "#5c4033");
	// Paper screen fill — subtle variation
	for (let fx = 4; fx < w; fx += 100) {
		const panelW = Math.min(96, w - fx);
		pxRect(ctx, fx, 4, panelW, 22, "#9a8a70");
		pxRect(ctx, fx, 29, panelW, 23, "#a09078");
	}

	// Right wall — wood panelling
	pxRect(ctx, w - 28, 0, 28, h, "#5c4033");
	pxRect(ctx, w - 30, 0, 2, h, "#4a3525");
	// Vertical slat pattern
	for (let sy = 0; sy < h; sy += 24) {
		pxRect(ctx, w - 26, sy, 22, 1, "rgba(0,0,0,0.1)");
	}

	// Weapon rack on right wall
	const rackX = w - 24;
	pxRect(ctx, rackX, 70, 18, 4, "#4a3525");
	pxRect(ctx, rackX, 130, 18, 4, "#4a3525");
	// Weapons — katana-style lines
	ctx.strokeStyle = "#a0a0b0";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(rackX + 2, 74);
	ctx.lineTo(rackX + 16, 74);
	ctx.stroke();
	ctx.strokeStyle = "#8090a0";
	ctx.beginPath();
	ctx.moveTo(rackX + 2, 134);
	ctx.lineTo(rackX + 16, 134);
	ctx.stroke();
	// Weapon handles
	ctx.fillStyle = "#3d2a1e";
	ctx.fillRect(rackX + 14, 72, 4, 4);
	ctx.fillRect(rackX + 14, 132, 4, 4);

	// Hanging scroll banners on back wall
	for (const [sx, color] of [[180, "#c0392b"], [500, "#2e4a8a"]] as const) {
		// Banner pole
		pxRect(ctx, sx - 1, 8, 22, 3, "#5c4033");
		// Banner body
		pxRect(ctx, sx + 2, 11, 16, 36, color);
		pxRect(ctx, sx + 3, 12, 14, 34, color);
		// Kanji-like markings
		ctx.fillStyle = "#f5e6c8";
		ctx.fillRect(sx + 7, 16, 6, 2);
		ctx.fillRect(sx + 8, 20, 4, 8);
		ctx.fillRect(sx + 7, 30, 6, 2);
		// Banner fringe
		pxRect(ctx, sx + 4, 47, 12, 2, "#fbbf24");
	}

	// Floor cushion circle (meditation area hint)
	ctx.fillStyle = "#8b2020";
	ctx.beginPath();
	ctx.ellipse(400, 340, 24, 12, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "#6a1818";
	ctx.lineWidth = 1;
	ctx.stroke();
	// Cushion highlight
	ctx.fillStyle = "rgba(255,255,255,0.06)";
	ctx.beginPath();
	ctx.ellipse(398, 336, 16, 6, 0, 0, Math.PI * 2);
	ctx.fill();

	// Incense burner near back wall
	const incX = 350;
	pxRect(ctx, incX, 42, 8, 8, "#4a3a2a");
	pxRect(ctx, incX + 1, 43, 6, 6, "#3a2a1a");
	// Smoke wisps
	ctx.strokeStyle = "rgba(200, 200, 200, 0.08)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(incX + 4, 42);
	ctx.quadraticCurveTo(incX + 8, 32, incX + 3, 22);
	ctx.stroke();
	ctx.strokeStyle = "rgba(200, 200, 200, 0.05)";
	ctx.beginPath();
	ctx.moveTo(incX + 4, 42);
	ctx.quadraticCurveTo(incX - 2, 34, incX + 5, 24);
	ctx.stroke();

	// Bottom border — raised platform edge
	pxRect(ctx, 0, h - 6, w, 6, "#4a3525");
	pxRect(ctx, 0, h - 8, w, 2, "#5c4033");
}

// ── Village — Market Square ──────────────────────────────────────────

export function drawMarketSquareFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Cobblestone floor
	drawCobblestones(ctx, 0, 50, w, h - 50, ["#5a5a5a", "#4a4a4a", "#6a6a6a", "#555555"], 14);

	// Back wall — timber-frame facade
	pxRect(ctx, 0, 0, w, 54, "#5c4a35");
	drawStoneWall(ctx, 0, 4, w, 46, "#7a6a55", "#6a5a48", 24, 14);
	// Timber frame
	pxRect(ctx, 0, 0, w, 4, "#5c4033");
	pxRect(ctx, 0, 50, w, 4, "#5c4033");
	for (let fx = 0; fx < w; fx += 120) {
		pxRect(ctx, fx, 0, 6, 54, "#5c4033");
	}

	// Right wall — stone pillar
	drawStoneWall(ctx, w - 28, 0, 28, h, "#4a4a4a", "#3e3e3e", 28, 16);
	pxRect(ctx, w - 30, 0, 2, h, "#2a2a2a");

	// Market stall awnings on back wall
	for (const [ax, aw, color] of [[80, 140, "#7b2d8b"], [320, 120, "#3b82f6"], [540, 130, "#c0392b"]] as const) {
		// Support posts
		pxRect(ctx, ax, 40, 4, 60, "#5c4033");
		pxRect(ctx, ax + aw - 4, 40, 4, 60, "#5c4033");
		// Awning — scalloped fabric
		pxRect(ctx, ax, 40, aw, 6, color);
		pxRect(ctx, ax, 46, aw, 3, color + "cc");
		// Scallop fringe
		for (let scx = ax; scx < ax + aw; scx += 10) {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(scx + 5, 49, 4, 0, Math.PI);
			ctx.fill();
		}
		// Counter shelf
		pxRect(ctx, ax + 4, 88, aw - 8, 6, "#5c4033");
		pxRect(ctx, ax + 4, 94, aw - 8, 2, "#4a3525");
	}

	// Wares on stall counters
	// Stall 1 — potions / bottles
	const bottleColors = ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b"];
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = bottleColors[i];
		ctx.fillRect(92 + i * 24, 78, 5, 10);
		pxRect(ctx, 90 + i * 24, 76, 9, 3, "#4a3a2a");
	}
	// Stall 2 — scrolls
	for (let i = 0; i < 3; i++) {
		pxRect(ctx, 332 + i * 30, 80, 16, 8, "#f5e6c8");
		pxRect(ctx, 332 + i * 30, 80, 16, 2, "#c0392b");
	}
	// Stall 3 — fruit / produce
	const fruitColors = ["#ef4444", "#f59e0b", "#22c55e", "#ef4444"];
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = fruitColors[i];
		ctx.beginPath();
		ctx.arc(556 + i * 20, 84, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	// Crate stacks around the edges
	drawCrate(ctx, 40, 120, 16);
	drawCrate(ctx, 42, 104, 14);
	drawCrate(ctx, 660, 380, 18);
	drawCrate(ctx, 680, 376, 14);
	drawCrate(ctx, 670, 360, 12);

	// Barrel groups
	drawBarrel(ctx, 60, 380);
	drawBarrel(ctx, 80, 390);
	drawBarrel(ctx, w - 55, 120);

	// Hanging fabrics / banners between stalls
	for (const [bx, color] of [[260, "#f59e0b"], [470, "#8b5cf6"]] as const) {
		pxRect(ctx, bx, 16, 3, 32, "#5c4033");
		pxRect(ctx, bx - 6, 18, 14, 24, color);
		// Fabric pattern — simple stripes
		ctx.fillStyle = "rgba(255,255,255,0.12)";
		ctx.fillRect(bx - 4, 24, 10, 2);
		ctx.fillRect(bx - 4, 32, 10, 2);
	}

	// Ground details — scattered leaves / debris
	const debrisColors = ["#5c4a35", "#4a3a28", "#6b5a45"];
	for (let i = 0; i < 15; i++) {
		const dx = 40 + (i * 47) % (w - 80);
		const dy = 100 + (i * 31) % (h - 140);
		ctx.fillStyle = debrisColors[i % debrisColors.length];
		ctx.fillRect(dx, dy, 3, 2);
	}

	// Lantern posts
	drawLantern(ctx, 30, 60, 40);
	drawLantern(ctx, w - 45, 300, 40);

	// Bottom border — curb edge
	pxRect(ctx, 0, h - 8, w, 8, "#3a3a3a");
	pxRect(ctx, 0, h - 10, w, 2, "#4a4a4a");
}

// ── Station — Workshop / Forge ───────────────────────────────────────

export function drawWorkshopFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
	// Dark brick floor
	const brickW = 24;
	const brickH = 12;
	let row = 0;
	for (let by = 56; by < h; by += brickH) {
		const offset = row % 2 === 0 ? 0 : brickW / 2;
		for (let bx = -brickW; bx < w + brickW; bx += brickW) {
			const rx = bx + offset;
			if (rx + brickW <= 0 || rx >= w) continue;
			const clippedX = Math.max(rx, 0);
			const clippedW = Math.min(rx + brickW, w) - clippedX;
			const shade = (row + Math.floor(bx / brickW)) % 3;
			const colors = ["#3a2a2a", "#2e2020", "#4a3030"];
			ctx.fillStyle = colors[shade];
			ctx.fillRect(clippedX, by, clippedW, Math.min(brickH, h - by));
			// Mortar
			ctx.fillStyle = "rgba(0,0,0,0.15)";
			ctx.fillRect(clippedX, by + brickH - 1, clippedW, 1);
			ctx.fillRect(clippedX + clippedW - 1, by, 1, Math.min(brickH, h - by));
		}
		row++;
	}

	// Back wall — heavy stone
	drawStoneWall(ctx, 0, 0, w, 58, "#2a2a2a", "#1e1e1e", 32, 18);
	// Brick accent band
	pxRect(ctx, 0, 50, w, 3, "#4a2a2a");
	pxRect(ctx, 0, 53, w, 5, "#1a1010");

	// Right wall — dark stone with soot marks
	drawStoneWall(ctx, w - 30, 0, 30, h, "#2a2a2a", "#222222", 30, 18);
	pxRect(ctx, w - 32, 0, 2, h, "#1a1a1a");
	// Soot stains
	ctx.fillStyle = "rgba(0,0,0,0.15)";
	ctx.fillRect(w - 28, 80, 20, 40);
	ctx.fillStyle = "rgba(0,0,0,0.1)";
	ctx.fillRect(w - 26, 120, 18, 30);

	// Forge structure — back wall center
	const forgeX = 340;
	const forgeY = 8;
	// Stone frame
	pxRect(ctx, forgeX, forgeY, 80, 44, "#1e1e1e");
	pxRect(ctx, forgeX + 2, forgeY + 2, 76, 40, "#0e0808");
	// Fire pit
	pxRect(ctx, forgeX + 10, forgeY + 14, 60, 26, "#1a0a0a");
	// Ember glow
	const forgeGrad = ctx.createRadialGradient(forgeX + 40, forgeY + 30, 0, forgeX + 40, forgeY + 30, 60);
	forgeGrad.addColorStop(0, "rgba(239, 68, 68, 0.18)");
	forgeGrad.addColorStop(0.3, "rgba(245, 158, 11, 0.10)");
	forgeGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
	ctx.fillStyle = forgeGrad;
	ctx.beginPath();
	ctx.arc(forgeX + 40, forgeY + 30, 60, 0, Math.PI * 2);
	ctx.fill();
	// Fire shapes
	ctx.fillStyle = "#ef4444";
	ctx.fillRect(forgeX + 18, forgeY + 28, 6, 8);
	ctx.fillStyle = "#f59e0b";
	ctx.fillRect(forgeX + 30, forgeY + 24, 8, 12);
	ctx.fillStyle = "#fbbf24";
	ctx.fillRect(forgeX + 44, forgeY + 26, 6, 10);
	ctx.fillStyle = "#ef4444";
	ctx.fillRect(forgeX + 54, forgeY + 30, 4, 6);
	// Chimney flue
	pxRect(ctx, forgeX + 30, forgeY - 4, 20, 6, "#1a1a1a");
	// Smoke wisps
	ctx.strokeStyle = "rgba(100, 100, 100, 0.06)";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(forgeX + 40, forgeY - 4);
	ctx.quadraticCurveTo(forgeX + 50, forgeY - 20, forgeX + 38, forgeY - 30);
	ctx.stroke();

	// Tool rack on right wall
	const toolX = w - 26;
	pxRect(ctx, toolX, 70, 18, 4, "#3a3a3a");
	pxRect(ctx, toolX, 140, 18, 4, "#3a3a3a");
	// Hammer
	pxRect(ctx, toolX + 2, 74, 3, 30, "#5c4033");
	pxRect(ctx, toolX, 74, 7, 6, "#8a8a8a");
	// Tongs
	ctx.strokeStyle = "#6a6a6a";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(toolX + 10, 74);
	ctx.lineTo(toolX + 10, 100);
	ctx.lineTo(toolX + 14, 104);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(toolX + 12, 74);
	ctx.lineTo(toolX + 12, 100);
	ctx.lineTo(toolX + 8, 104);
	ctx.stroke();

	// Anvil shape on floor
	const anvilX = 180;
	const anvilY = 300;
	pxRect(ctx, anvilX, anvilY, 30, 8, "#5a5a5a");
	pxRect(ctx, anvilX + 4, anvilY + 8, 22, 12, "#4a4a4a");
	pxRect(ctx, anvilX + 2, anvilY + 20, 26, 6, "#3a3a3a");
	// Highlight
	ctx.fillStyle = "rgba(255,255,255,0.06)";
	ctx.fillRect(anvilX + 2, anvilY, 26, 3);

	// Water quench barrel
	drawBarrel(ctx, 240, 280);
	// Water surface hint
	ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
	ctx.beginPath();
	ctx.ellipse(240, 282, 6, 3, 0, 0, Math.PI * 2);
	ctx.fill();

	// Scattered metal ingots on floor
	for (const [ix, iy, color] of [[500, 350, "#8a8a8a"], [520, 360, "#6a6a6a"], [510, 340, "#9a7a3a"]] as const) {
		pxRect(ctx, ix, iy, 10, 6, color);
		ctx.fillStyle = "rgba(255,255,255,0.08)";
		ctx.fillRect(ix, iy, 10, 2);
	}

	// Coal pile near forge
	ctx.fillStyle = "#1a1a1a";
	for (let i = 0; i < 8; i++) {
		const cx = 460 + (i % 4) * 8;
		const cy = 80 + Math.floor(i / 4) * 6;
		ctx.beginPath();
		ctx.arc(cx, cy, 4, 0, Math.PI * 2);
		ctx.fill();
	}
	// Coal glow
	ctx.fillStyle = "rgba(239, 68, 68, 0.04)";
	ctx.fillRect(456, 72, 40, 24);

	// Ember glow from forge — extends onto floor
	const floorGrad = ctx.createRadialGradient(forgeX + 40, 80, 0, forgeX + 40, 80, 120);
	floorGrad.addColorStop(0, "rgba(245, 158, 11, 0.06)");
	floorGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
	ctx.fillStyle = floorGrad;
	ctx.fillRect(forgeX - 80, 56, 240, 140);

	// Bottom border — sooty edge
	pxRect(ctx, 0, h - 6, w, 6, "#1a1010");
	pxRect(ctx, 0, h - 8, w, 2, "#2a1a1a");
}
