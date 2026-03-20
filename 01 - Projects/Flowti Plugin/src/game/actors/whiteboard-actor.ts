/**
 * whiteboard-actor.ts — Whiteboard environmental object.
 * Used for collaborative brainstorming and diagram sessions.
 * Boosts social, focus, and morale on interaction.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class WhiteboardActor extends InteractableActor {
	constructor() {
		super({
			objectId: "whiteboard",
			objectType: "focus",
			width: 64,
			height: 48,
			interactionOffset: { x: 0, y: 30 },
			needsEffects: { social: 5, focus: 3, morale: 2 },
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Board border
				ctx.fillStyle = "#9ca3af";
				ctx.fillRect(0, 0, 64, 48);

				// White surface
				ctx.fillStyle = "#f0f0f0";
				ctx.fillRect(2, 2, 60, 44);

				// Scribble lines (blue)
				ctx.strokeStyle = "#3b82f6";
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.moveTo(8, 10);
				ctx.lineTo(30, 10);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(8, 16);
				ctx.lineTo(24, 16);
				ctx.stroke();

				// Green diagram box
				ctx.strokeStyle = "#10b981";
				ctx.lineWidth = 1;
				ctx.strokeRect(36, 6, 20, 14);
				ctx.beginPath();
				ctx.moveTo(46, 20);
				ctx.lineTo(46, 26);
				ctx.stroke();
				ctx.strokeRect(38, 26, 16, 10);

				// Red bullet points
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(10, 28, 2, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(10, 34, 2, 0, Math.PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(10, 40, 2, 0, Math.PI * 2);
				ctx.fill();

				// Red bullet text lines
				ctx.strokeStyle = "#6b7280";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(14, 28);
				ctx.lineTo(30, 28);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(14, 34);
				ctx.lineTo(26, 34);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(14, 40);
				ctx.lineTo(28, 40);
				ctx.stroke();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Whiteboard", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
