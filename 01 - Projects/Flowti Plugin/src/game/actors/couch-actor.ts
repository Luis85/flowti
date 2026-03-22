/**
 * couch-actor.ts — Cushion Mat environmental object.
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
				// Mat shadow
				ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
				ctx.beginPath();
				ctx.roundRect(3, 18, 60, 18, 4);
				ctx.fill();

				// Cushion body (rich fabric)
				ctx.fillStyle = "#7b2d8b";
				ctx.beginPath();
				ctx.roundRect(2, 14, 60, 18, 4);
				ctx.fill();

				// Cushion top surface (lighter)
				ctx.fillStyle = "#9b3dab";
				ctx.beginPath();
				ctx.roundRect(4, 14, 56, 12, 3);
				ctx.fill();

				// Gold border trim — outer
				ctx.strokeStyle = "#d4a017";
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.roundRect(2, 14, 60, 18, 4);
				ctx.stroke();

				// Gold border trim — inner decorative
				ctx.strokeStyle = "#c49417";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.roundRect(6, 17, 52, 12, 2);
				ctx.stroke();

				// Center diamond pattern (gold embroidery)
				ctx.fillStyle = "#d4a017";
				ctx.beginPath();
				ctx.moveTo(32, 18);
				ctx.lineTo(38, 23);
				ctx.lineTo(32, 28);
				ctx.lineTo(26, 23);
				ctx.closePath();
				ctx.fill();

				// Inner diamond
				ctx.fillStyle = "#7b2d8b";
				ctx.beginPath();
				ctx.moveTo(32, 20);
				ctx.lineTo(36, 23);
				ctx.lineTo(32, 26);
				ctx.lineTo(28, 23);
				ctx.closePath();
				ctx.fill();

				// Corner tassels (gold dots)
				ctx.fillStyle = "#d4a017";
				ctx.beginPath();
				ctx.arc(5, 32, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(59, 32, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(5, 14, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(59, 14, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Rest", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
