/**
 * water-cooler.ts — Water cooler environmental object.
 * The classic social gathering spot for casual conversations.
 * Boosts social on interaction.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class WaterCooler extends InteractableActor {
	constructor() {
		super({
			objectId: "water-cooler",
			objectType: "social",
			width: 24,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { social: 10, thirst: 15 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Stand / base
				ctx.fillStyle = "#6b7280";
				ctx.fillRect(4, 24, 16, 16);

				// Stand front panel
				ctx.fillStyle = "#9ca3af";
				ctx.fillRect(6, 26, 12, 12);

				// Tap / spigot
				ctx.fillStyle = "#4b5563";
				ctx.fillRect(9, 24, 6, 3);

				// Water bottle
				ctx.fillStyle = "#bfdbfe";
				ctx.beginPath();
				ctx.moveTo(6, 22);
				ctx.lineTo(6, 6);
				ctx.quadraticCurveTo(6, 2, 12, 2);
				ctx.quadraticCurveTo(18, 2, 18, 6);
				ctx.lineTo(18, 22);
				ctx.closePath();
				ctx.fill();

				// Bottle cap
				ctx.fillStyle = "#3b82f6";
				ctx.fillRect(9, 0, 6, 4);

				// Water level inside bottle
				ctx.fillStyle = "#93c5fd";
				ctx.fillRect(7, 12, 10, 10);

				// Water level shine
				ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
				ctx.fillRect(8, 6, 3, 14);

				// Drip cup
				ctx.fillStyle = "#d1d5db";
				ctx.fillRect(8, 36, 8, 3);

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Water", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
