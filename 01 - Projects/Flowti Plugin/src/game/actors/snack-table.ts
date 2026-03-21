/**
 * snack-table.ts — Snack table environmental object.
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
				// Table legs
				ctx.fillStyle = "#6B4F12";
				ctx.fillRect(4, 28, 4, 12);
				ctx.fillRect(40, 28, 4, 12);

				// Table top
				ctx.fillStyle = "#8B6914";
				ctx.fillRect(0, 16, 48, 14);

				// Table edge highlight
				ctx.fillStyle = "#a07d1a";
				ctx.fillRect(0, 16, 48, 2);

				// Snacks — colorful circles
				// Apple (red)
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(10, 22, 4, 0, Math.PI * 2);
				ctx.fill();

				// Orange
				ctx.fillStyle = "#f97316";
				ctx.beginPath();
				ctx.arc(22, 20, 3, 0, Math.PI * 2);
				ctx.fill();

				// Grape cluster (purple)
				ctx.fillStyle = "#a855f7";
				ctx.beginPath();
				ctx.arc(34, 22, 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(37, 20, 2.5, 0, Math.PI * 2);
				ctx.fill();

				// Cookie (yellow)
				ctx.fillStyle = "#fbbf24";
				ctx.beginPath();
				ctx.arc(44, 21, 3, 0, Math.PI * 2);
				ctx.fill();

				// Banana (yellow-green)
				ctx.fillStyle = "#facc15";
				ctx.beginPath();
				ctx.arc(16, 19, 2.5, 0, Math.PI * 2);
				ctx.fill();

				// Donut (pink)
				ctx.fillStyle = "#f472b6";
				ctx.beginPath();
				ctx.arc(28, 23, 3, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#8B6914";
				ctx.beginPath();
				ctx.arc(28, 23, 1, 0, Math.PI * 2);
				ctx.fill();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Snacks", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
