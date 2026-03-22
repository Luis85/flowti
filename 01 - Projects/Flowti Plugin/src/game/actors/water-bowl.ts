/**
 * water-bowl.ts — Stone Water Dish environmental object for pet agents.
 * Restores thirst when visited.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class WaterBowl extends InteractableActor {
	constructor(objectId = "water-bowl") {
		super({
			objectId,
			objectType: "drink",
			width: 32,
			height: 32,
			interactionOffset: { x: 0, y: 20 },
			needsEffects: { thirst: 25 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Dish shadow
				ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
				ctx.beginPath();
				ctx.ellipse(16, 24, 13, 5, 0, 0, Math.PI * 2);
				ctx.fill();

				// Stone dish — outer
				ctx.fillStyle = "#6a6a6a";
				ctx.beginPath();
				ctx.ellipse(16, 20, 14, 8, 0, 0, Math.PI * 2);
				ctx.fill();

				// Stone dish — inner rim
				ctx.fillStyle = "#7a7a7a";
				ctx.beginPath();
				ctx.ellipse(16, 19, 12, 6, 0, 0, Math.PI * 2);
				ctx.fill();

				// Dish interior (darker stone)
				ctx.fillStyle = "#555555";
				ctx.beginPath();
				ctx.ellipse(16, 19, 10, 5, 0, 0, Math.PI * 2);
				ctx.fill();

				// Water surface
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.ellipse(16, 18, 9, 4, 0, 0, Math.PI * 2);
				ctx.fill();

				// Water highlight (lighter reflection)
				ctx.fillStyle = "rgba(147, 197, 253, 0.5)";
				ctx.beginPath();
				ctx.ellipse(13, 17, 4, 2, -0.3, 0, Math.PI * 2);
				ctx.fill();

				// Bright specular highlight
				ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
				ctx.beginPath();
				ctx.ellipse(11, 16, 2, 1, -0.4, 0, Math.PI * 2);
				ctx.fill();

				// Stone texture speckles
				ctx.fillStyle = "rgba(90, 90, 90, 0.3)";
				ctx.beginPath();
				ctx.arc(8, 21, 0.6, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(22, 20, 0.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(20, 23, 0.7, 0, Math.PI * 2);
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "7px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Water", 16, 32);
			},
		});
		this.graphics.use(canvas);
	}

	getAgentEffects(): Partial<{ hunger: number; thirst: number }> {
		return { thirst: 8 };
	}
}
