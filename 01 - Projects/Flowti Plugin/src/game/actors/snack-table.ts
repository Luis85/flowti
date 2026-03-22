/**
 * snack-table.ts — Food Cart environmental object.
 * A communal food station that draws agents during breaks.
 * Boosts energy, social, and morale on interaction.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class SnackTable extends InteractableActor {
	constructor() {
		super({
			objectId: "snack-table",
			objectType: "energy",
			width: 48,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { energy: 10, social: 8, morale: 3, hunger: 25 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Cart legs
				ctx.fillStyle = "#4e3628";
				ctx.fillRect(4, 30, 3, 10);
				ctx.fillRect(41, 30, 3, 10);

				// Cart wheels
				ctx.fillStyle = "#5c4033";
				ctx.beginPath();
				ctx.arc(5, 39, 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(43, 39, 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#4e3628";
				ctx.beginPath();
				ctx.arc(5, 39, 1, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(43, 39, 1, 0, Math.PI * 2);
				ctx.fill();

				// Cart surface (wood plank)
				ctx.fillStyle = "#5c4033";
				ctx.fillRect(2, 20, 44, 12);

				// Wood grain lines
				ctx.strokeStyle = "#4e3628";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.moveTo(2, 24);
				ctx.lineTo(46, 24);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(2, 28);
				ctx.lineTo(46, 28);
				ctx.stroke();

				// Cart edge (top trim)
				ctx.fillStyle = "#3a2a1f";
				ctx.fillRect(2, 19, 44, 2);

				// Round bread loaf
				ctx.fillStyle = "#d4a574";
				ctx.beginPath();
				ctx.arc(10, 23, 4, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#c49464";
				ctx.beginPath();
				ctx.arc(10, 24, 3, 0, Math.PI);
				ctx.fill();

				// Red apple
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(22, 24, 3.5, 0, Math.PI * 2);
				ctx.fill();
				// Apple stem
				ctx.fillStyle = "#4e3628";
				ctx.fillRect(21, 20, 1.5, 2);

				// Fish (blue, elongated)
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.ellipse(36, 24, 6, 3, 0, 0, Math.PI * 2);
				ctx.fill();
				// Fish tail
				ctx.beginPath();
				ctx.moveTo(42, 24);
				ctx.lineTo(45, 21);
				ctx.lineTo(45, 27);
				ctx.closePath();
				ctx.fill();
				// Fish eye
				ctx.fillStyle = "#f5f5f4";
				ctx.beginPath();
				ctx.arc(32, 23, 1, 0, Math.PI * 2);
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Food", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
