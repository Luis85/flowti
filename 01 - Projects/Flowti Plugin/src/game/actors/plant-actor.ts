/**
 * plant-actor.ts — Potted Bamboo environmental object.
 * Adds visual warmth to the scene. No direct needs effects,
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
				// Clay pot body
				ctx.fillStyle = "#8b6c4a";
				ctx.beginPath();
				ctx.moveTo(4, 18);
				ctx.lineTo(5, 27);
				ctx.lineTo(15, 27);
				ctx.lineTo(16, 18);
				ctx.closePath();
				ctx.fill();

				// Pot darker rim
				ctx.fillStyle = "#6b5236";
				ctx.fillRect(3, 17, 14, 3);

				// Pot highlight
				ctx.fillStyle = "#9b7c5a";
				ctx.fillRect(4, 18, 3, 8);

				// Soil in pot
				ctx.fillStyle = "#3a2a1a";
				ctx.beginPath();
				ctx.ellipse(10, 19, 6, 2.5, 0, 0, Math.PI * 2);
				ctx.fill();

				// Bamboo stem 1 (left)
				ctx.strokeStyle = "#22c55e";
				ctx.lineWidth = 2.5;
				ctx.beginPath();
				ctx.moveTo(7, 18);
				ctx.lineTo(7, 4);
				ctx.stroke();

				// Bamboo stem 2 (center)
				ctx.strokeStyle = "#10b981";
				ctx.lineWidth = 2.5;
				ctx.beginPath();
				ctx.moveTo(10, 18);
				ctx.lineTo(10, 2);
				ctx.stroke();

				// Bamboo stem 3 (right)
				ctx.strokeStyle = "#22c55e";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(13, 18);
				ctx.lineTo(13, 6);
				ctx.stroke();

				// Bamboo joints (nodes)
				ctx.strokeStyle = "#16a34a";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(6, 10);
				ctx.lineTo(8, 10);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(9, 7);
				ctx.lineTo(11, 7);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(9, 12);
				ctx.lineTo(11, 12);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(12, 11);
				ctx.lineTo(14, 11);
				ctx.stroke();

				// Leaves at top (small triangles)
				ctx.fillStyle = "#22c55e";
				// Left stem leaves
				ctx.beginPath();
				ctx.moveTo(7, 5);
				ctx.lineTo(2, 2);
				ctx.lineTo(5, 7);
				ctx.closePath();
				ctx.fill();

				// Center stem leaves
				ctx.fillStyle = "#10b981";
				ctx.beginPath();
				ctx.moveTo(10, 3);
				ctx.lineTo(14, 0);
				ctx.lineTo(12, 5);
				ctx.closePath();
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo(10, 4);
				ctx.lineTo(5, 1);
				ctx.lineTo(8, 6);
				ctx.closePath();
				ctx.fill();

				// Right stem leaf
				ctx.fillStyle = "#22c55e";
				ctx.beginPath();
				ctx.moveTo(13, 7);
				ctx.lineTo(17, 4);
				ctx.lineTo(15, 9);
				ctx.closePath();
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Bamboo", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
