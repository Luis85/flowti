/**
 * coffee-machine.ts — Coffee machine environmental object.
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
				// Machine body
				ctx.fillStyle = "#5C4033";
				ctx.fillRect(4, 8, 24, 28);

				// Top section (darker)
				ctx.fillStyle = "#3a2a1f";
				ctx.fillRect(4, 8, 24, 8);

				// Power light
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(24, 12, 2, 0, Math.PI * 2);
				ctx.fill();

				// Cup area / drip tray
				ctx.fillStyle = "#d4a574";
				ctx.fillRect(10, 28, 12, 6);

				// Cup
				ctx.fillStyle = "#f5f5f4";
				ctx.fillRect(12, 24, 8, 8);
				ctx.fillStyle = "#d4a574";
				ctx.fillRect(13, 25, 6, 6);

				// Steam lines
				ctx.strokeStyle = "rgba(200, 200, 200, 0.6)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(12, 6);
				ctx.quadraticCurveTo(14, 2, 12, 0);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(16, 7);
				ctx.quadraticCurveTo(18, 3, 16, 0);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(20, 6);
				ctx.quadraticCurveTo(22, 2, 20, 0);
				ctx.stroke();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Coffee", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
