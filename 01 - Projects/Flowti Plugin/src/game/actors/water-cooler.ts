/**
 * water-cooler.ts — Water Barrel environmental object.
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
				// Barrel body (rounded rectangle shape)
				ctx.fillStyle = "#5c4a35";
				ctx.beginPath();
				ctx.moveTo(4, 6);
				ctx.quadraticCurveTo(2, 6, 2, 10);
				ctx.lineTo(1, 20);
				ctx.quadraticCurveTo(1, 36, 4, 38);
				ctx.lineTo(20, 38);
				ctx.quadraticCurveTo(23, 36, 23, 20);
				ctx.lineTo(22, 10);
				ctx.quadraticCurveTo(22, 6, 20, 6);
				ctx.closePath();
				ctx.fill();

				// Barrel plank shading (vertical lines)
				ctx.strokeStyle = "#4e3d2a";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.moveTo(8, 7);
				ctx.lineTo(7, 37);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(12, 6);
				ctx.lineTo(12, 38);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(16, 7);
				ctx.lineTo(17, 37);
				ctx.stroke();

				// Metal band — top
				ctx.fillStyle = "#6a6a6a";
				ctx.fillRect(2, 9, 20, 2);

				// Metal band — middle
				ctx.fillRect(1, 20, 22, 2);

				// Metal band — bottom
				ctx.fillRect(2, 32, 20, 2);

				// Band rivets (small dots)
				ctx.fillStyle = "#8a8a8a";
				ctx.beginPath();
				ctx.arc(5, 10, 0.8, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(19, 10, 0.8, 0, Math.PI * 2);
				ctx.fill();

				// Barrel lid / top rim
				ctx.fillStyle = "#4e3d2a";
				ctx.fillRect(3, 5, 18, 3);

				// Tap / spigot
				ctx.fillStyle = "#4a4a4a";
				ctx.fillRect(21, 22, 3, 2);
				ctx.fillRect(22, 21, 2, 4);

				// Water droplet below tap
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.moveTo(23, 26);
				ctx.quadraticCurveTo(24, 28, 23, 29);
				ctx.quadraticCurveTo(22, 28, 23, 26);
				ctx.fill();

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
