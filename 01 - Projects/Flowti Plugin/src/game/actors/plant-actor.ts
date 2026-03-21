/**
 * plant-actor.ts — Decorative plant environmental object.
 * Adds visual warmth to the office. No direct needs effects,
 * but may trigger comment bubbles from plant-parent agents.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class PlantActor extends InteractableActor {
	constructor() {
		super({
			objectId: "plant",
			objectType: "focus",
			width: 20,
			height: 28,
			interactionOffset: { x: 0, y: 16 },
			needsEffects: {},
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Pot
				ctx.fillStyle = "#92400e";
				ctx.beginPath();
				ctx.moveTo(3, 18);
				ctx.lineTo(5, 28);
				ctx.lineTo(15, 28);
				ctx.lineTo(17, 18);
				ctx.closePath();
				ctx.fill();

				// Pot rim
				ctx.fillStyle = "#b45309";
				ctx.fillRect(2, 17, 16, 3);

				// Soil
				ctx.fillStyle = "#451a03";
				ctx.beginPath();
				ctx.arc(10, 18, 7, 0, Math.PI);
				ctx.fill();

				// Stem
				ctx.strokeStyle = "#16a34a";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(10, 17);
				ctx.lineTo(10, 8);
				ctx.stroke();

				// Leaves (triangular shapes)
				ctx.fillStyle = "#22c55e";
				// Left leaf
				ctx.beginPath();
				ctx.moveTo(10, 10);
				ctx.lineTo(3, 6);
				ctx.lineTo(7, 12);
				ctx.closePath();
				ctx.fill();

				// Right leaf
				ctx.beginPath();
				ctx.moveTo(10, 8);
				ctx.lineTo(17, 4);
				ctx.lineTo(13, 10);
				ctx.closePath();
				ctx.fill();

				// Top leaf
				ctx.fillStyle = "#16a34a";
				ctx.beginPath();
				ctx.moveTo(10, 8);
				ctx.lineTo(6, 1);
				ctx.lineTo(14, 1);
				ctx.closePath();
				ctx.fill();

				// Small accent leaf
				ctx.fillStyle = "#22c55e";
				ctx.beginPath();
				ctx.moveTo(10, 12);
				ctx.lineTo(16, 10);
				ctx.lineTo(12, 14);
				ctx.closePath();
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Plant", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
