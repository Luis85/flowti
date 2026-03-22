/**
 * food-bowl.ts — Wooden Bowl with food environmental object for pet agents.
 * Restores hunger when visited.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class FoodBowl extends InteractableActor {
	constructor(objectId = "food-bowl") {
		super({
			objectId,
			objectType: "food",
			width: 32,
			height: 32,
			interactionOffset: { x: 0, y: 20 },
			needsEffects: { hunger: 30 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Bowl shadow
				ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
				ctx.beginPath();
				ctx.ellipse(16, 24, 13, 5, 0, 0, Math.PI * 2);
				ctx.fill();

				// Wooden bowl — outer
				ctx.fillStyle = "#5c4a35";
				ctx.beginPath();
				ctx.ellipse(16, 20, 14, 8, 0, 0, Math.PI * 2);
				ctx.fill();

				// Wooden bowl — inner rim
				ctx.fillStyle = "#6b5a45";
				ctx.beginPath();
				ctx.ellipse(16, 19, 12, 6, 0, 0, Math.PI * 2);
				ctx.fill();

				// Bowl interior
				ctx.fillStyle = "#4e3d2a";
				ctx.beginPath();
				ctx.ellipse(16, 19, 10, 5, 0, 0, Math.PI * 2);
				ctx.fill();

				// Fish piece (blue)
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.ellipse(13, 18, 4, 2, -0.3, 0, Math.PI * 2);
				ctx.fill();

				// Meat piece (brown)
				ctx.fillStyle = "#8b4513";
				ctx.beginPath();
				ctx.ellipse(19, 19, 3, 2, 0.2, 0, Math.PI * 2);
				ctx.fill();

				// Small garnish (green)
				ctx.fillStyle = "#22c55e";
				ctx.beginPath();
				ctx.arc(16, 17, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Wood grain highlight
				ctx.strokeStyle = "rgba(107, 90, 69, 0.4)";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.arc(16, 20, 13, 0.2, 1.2);
				ctx.stroke();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "7px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Food", 16, 32);
			},
		});
		this.graphics.use(canvas);
	}

	getAgentEffects(): Partial<{ hunger: number; thirst: number }> {
		return { hunger: 10 };
	}
}
