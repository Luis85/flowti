/**
 * coffee-machine.ts — Potion Brewing Station environmental object.
 * Agents visit when energy is low or during morning/slump phases.
 * Boosts energy and focus on interaction.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class CoffeeMachine extends InteractableActor {
	constructor() {
		super({
			objectId: "coffee-machine",
			objectType: "energy",
			width: 32,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: { energy: 15, focus: 5, thirst: 20 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Wooden stand legs
				ctx.fillStyle = "#5c4033";
				ctx.fillRect(6, 32, 4, 8);
				ctx.fillRect(22, 32, 4, 8);

				// Wooden crossbar
				ctx.fillStyle = "#4e3628";
				ctx.fillRect(6, 34, 20, 3);

				// Cauldron body (wide base, narrowing top)
				ctx.fillStyle = "#3a3a3a";
				ctx.beginPath();
				ctx.moveTo(4, 16);
				ctx.quadraticCurveTo(2, 32, 6, 34);
				ctx.lineTo(26, 34);
				ctx.quadraticCurveTo(30, 32, 28, 16);
				ctx.closePath();
				ctx.fill();

				// Cauldron rim
				ctx.fillStyle = "#4a4a4a";
				ctx.beginPath();
				ctx.ellipse(16, 16, 13, 4, 0, 0, Math.PI * 2);
				ctx.fill();

				// Potion liquid surface
				ctx.fillStyle = "#1a6b3a";
				ctx.beginPath();
				ctx.ellipse(16, 17, 11, 3, 0, 0, Math.PI * 2);
				ctx.fill();

				// Bubbling potion — green bubbles
				ctx.fillStyle = "#22c55e";
				ctx.beginPath();
				ctx.arc(12, 16, 2, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(20, 15, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Bubbling potion — purple bubbles
				ctx.fillStyle = "#a855f7";
				ctx.beginPath();
				ctx.arc(16, 14, 1.8, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(10, 14, 1, 0, Math.PI * 2);
				ctx.fill();

				// Steam wisps
				ctx.strokeStyle = "rgba(180, 220, 180, 0.5)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(11, 12);
				ctx.quadraticCurveTo(9, 6, 11, 2);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(16, 11);
				ctx.quadraticCurveTo(18, 5, 16, 0);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(21, 12);
				ctx.quadraticCurveTo(23, 7, 21, 3);
				ctx.stroke();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Potions", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
