/**
 * water-bowl.ts — Water bowl environmental object for pet agents.
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
				// Bowl base
				ctx.fillStyle = "#93c5fd";
				ctx.beginPath();
				ctx.ellipse(16, 20, 14, 8, 0, 0, Math.PI * 2);
				ctx.fill();
				// Water surface highlight
				ctx.fillStyle = "#bfdbfe";
				ctx.beginPath();
				ctx.ellipse(16, 18, 8, 4, 0, 0, Math.PI * 2);
				ctx.fill();
				// Rim shine
				ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
				ctx.beginPath();
				ctx.ellipse(10, 17, 3, 1.5, -0.4, 0, Math.PI * 2);
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
