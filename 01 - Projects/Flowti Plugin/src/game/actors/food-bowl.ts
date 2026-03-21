/**
 * food-bowl.ts — Food bowl environmental object for pet agents.
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
				ctx.fillStyle = "#d4a574";
				ctx.beginPath();
				ctx.ellipse(16, 20, 14, 8, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.ellipse(16, 18, 8, 4, 0, 0, Math.PI * 2);
				ctx.fill();
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
