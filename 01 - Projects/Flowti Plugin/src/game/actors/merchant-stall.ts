/**
 * merchant-stall.ts — Market Booth actor in the hub room.
 * Provides a visual shop presence for economy interactions.
 *
 * When the Director clicks the stall, fires a `merchant-stall-click`
 * custom event on the engine canvas so parent systems can open the
 * merchant panel UI.
 */

import { InteractableActor } from "./interactable-actor.js";
import * as ex from "excalibur";

export class MerchantStall extends InteractableActor {
	private hovered = false;

	constructor() {
		super({
			objectId: "merchant-stall",
			objectType: "shop",
			width: 48,
			height: 48,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: {}, // no needs effects — shop interaction only
		});

		this.buildGraphic();
	}

	onInitialize(engine: ex.Engine): void {
		this.on("pointerdown", () => {
			engine.canvas.dispatchEvent(
				new CustomEvent("merchant-stall-click", { bubbles: true }),
			);
		});
		this.on("pointerenter", () => {
			this.hovered = true;
			engine.canvas.classList.add("ft-cursor-pointer");
			this.buildGraphic();
		});
		this.on("pointerleave", () => {
			this.hovered = false;
			engine.canvas.classList.remove("ft-cursor-pointer");
			this.buildGraphic();
		});
	}

	private buildGraphic(): void {
		const borderColor = this.hovered ? "#f5c542" : "#DAA520";
		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Wooden support posts
				ctx.fillStyle = "#4e3628";
				ctx.fillRect(3, 4, 4, 44);
				ctx.fillRect(41, 4, 4, 44);

				// Canopy / awning (striped fabric)
				ctx.fillStyle = "#7b2d8b";
				ctx.fillRect(0, 2, 48, 14);
				// Stripes
				ctx.fillStyle = "#3b82f6";
				ctx.fillRect(0, 2, 12, 14);
				ctx.fillRect(24, 2, 12, 14);

				// Awning scalloped bottom edge
				ctx.fillStyle = borderColor;
				for (let i = 0; i < 6; i++) {
					ctx.beginPath();
					ctx.arc(4 + i * 8, 16, 4, 0, Math.PI);
					ctx.fill();
				}

				// Counter surface (wood)
				ctx.fillStyle = "#5c4033";
				ctx.fillRect(2, 22, 44, 8);

				// Counter edge highlight
				ctx.fillStyle = "#6b5040";
				ctx.fillRect(2, 22, 44, 2);

				// Stall base (under counter)
				ctx.fillStyle = "#4e3628";
				ctx.fillRect(4, 30, 40, 18);

				// Wood planks on base
				ctx.strokeStyle = "#3a2a1f";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.moveTo(4, 36);
				ctx.lineTo(44, 36);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(4, 42);
				ctx.lineTo(44, 42);
				ctx.stroke();

				// Display wares — gold coin
				ctx.fillStyle = "#f59e0b";
				ctx.beginPath();
				ctx.arc(14, 26, 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#d4a017";
				ctx.beginPath();
				ctx.arc(14, 26, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Display wares — emerald gem
				ctx.fillStyle = "#22c55e";
				ctx.beginPath();
				ctx.moveTo(26, 23);
				ctx.lineTo(29, 26);
				ctx.lineTo(26, 29);
				ctx.lineTo(23, 26);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = "#10b981";
				ctx.beginPath();
				ctx.moveTo(26, 24);
				ctx.lineTo(28, 26);
				ctx.lineTo(26, 28);
				ctx.lineTo(24, 26);
				ctx.closePath();
				ctx.fill();

				// Display wares — ruby
				ctx.fillStyle = "#c0392b";
				ctx.beginPath();
				ctx.moveTo(37, 23);
				ctx.lineTo(40, 26);
				ctx.lineTo(37, 29);
				ctx.lineTo(34, 26);
				ctx.closePath();
				ctx.fill();

				// Sign text
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "7px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Shop", 24, 12);
			},
		});
		this.graphics.use(canvas);
	}
}
