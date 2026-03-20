/**
 * couch-actor.ts — Couch environmental object.
 * A comfortable rest spot where agents recover energy during downtime.
 * Boosts energy and morale on interaction.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class CouchActor extends InteractableActor {
	constructor() {
		super({
			objectId: "couch",
			objectType: "rest",
			width: 64,
			height: 36,
			interactionOffset: { x: 0, y: 20 },
			needsEffects: { energy: 20, morale: 5 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Couch legs
				ctx.fillStyle = "#4a2d85";
				ctx.fillRect(6, 30, 4, 6);
				ctx.fillRect(54, 30, 4, 6);

				// Back rest
				ctx.fillStyle = "#7c3aed";
				ctx.beginPath();
				ctx.moveTo(4, 4);
				ctx.quadraticCurveTo(0, 4, 0, 10);
				ctx.lineTo(0, 28);
				ctx.lineTo(64, 28);
				ctx.lineTo(64, 10);
				ctx.quadraticCurveTo(64, 4, 60, 4);
				ctx.closePath();
				ctx.fill();

				// Seat cushion area (lighter)
				ctx.fillStyle = "#a78bfa";
				ctx.beginPath();
				ctx.moveTo(4, 16);
				ctx.quadraticCurveTo(2, 16, 2, 18);
				ctx.lineTo(2, 28);
				ctx.lineTo(62, 28);
				ctx.lineTo(62, 18);
				ctx.quadraticCurveTo(62, 16, 60, 16);
				ctx.closePath();
				ctx.fill();

				// Cushion divider lines
				ctx.strokeStyle = "#7c3aed";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(22, 17);
				ctx.lineTo(22, 27);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(42, 17);
				ctx.lineTo(42, 27);
				ctx.stroke();

				// Armrests
				ctx.fillStyle = "#6d28d9";
				ctx.fillRect(0, 8, 6, 22);
				ctx.fillRect(58, 8, 6, 22);

				// Armrest rounded tops
				ctx.beginPath();
				ctx.arc(3, 8, 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(61, 8, 3, 0, Math.PI * 2);
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Couch", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
