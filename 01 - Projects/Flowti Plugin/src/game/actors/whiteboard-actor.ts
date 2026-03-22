/**
 * whiteboard-actor.ts — Scroll Board environmental object.
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
				// Wooden frame — outer
				ctx.fillStyle = "#3a2a1f";
				ctx.fillRect(0, 0, 64, 48);

				// Wooden frame — inner border
				ctx.fillStyle = "#5c4033";
				ctx.fillRect(2, 2, 60, 44);

				// Parchment background
				ctx.fillStyle = "#d4c4a0";
				ctx.fillRect(4, 4, 56, 40);

				// Parchment texture (subtle lines)
				ctx.strokeStyle = "rgba(180, 160, 120, 0.3)";
				ctx.lineWidth = 0.5;
				for (let y = 8; y < 44; y += 4) {
					ctx.beginPath();
					ctx.moveTo(5, y);
					ctx.lineTo(59, y);
					ctx.stroke();
				}

				// Pinned scroll note 1 (top-left)
				ctx.fillStyle = "#c4b090";
				ctx.fillRect(7, 7, 18, 14);
				ctx.strokeStyle = "#a09070";
				ctx.lineWidth = 0.5;
				ctx.strokeRect(7, 7, 18, 14);

				// Pinned scroll note 2 (top-right)
				ctx.fillStyle = "#d4c4a0";
				ctx.fillRect(30, 8, 22, 12);
				ctx.strokeStyle = "#a09070";
				ctx.strokeRect(30, 8, 22, 12);

				// Pinned scroll note 3 (bottom-left)
				ctx.fillStyle = "#c8b898";
				ctx.fillRect(8, 26, 16, 14);
				ctx.strokeStyle = "#a09070";
				ctx.strokeRect(8, 26, 16, 14);

				// Pinned scroll note 4 (bottom-right)
				ctx.fillStyle = "#d0c098";
				ctx.fillRect(28, 28, 26, 12);
				ctx.strokeStyle = "#a09070";
				ctx.strokeRect(28, 28, 26, 12);

				// Ink text lines on notes
				ctx.strokeStyle = "#5c4a35";
				ctx.lineWidth = 0.8;
				ctx.beginPath();
				ctx.moveTo(9, 12);
				ctx.lineTo(22, 12);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(9, 15);
				ctx.lineTo(20, 15);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(32, 13);
				ctx.lineTo(48, 13);
				ctx.stroke();

				// Push pins
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(16, 8, 2, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.arc(41, 9, 2, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(16, 27, 2, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.arc(41, 29, 2, 0, Math.PI * 2);
				ctx.fill();

				// Frame corner accents (decorative)
				ctx.fillStyle = "#d4a017";
				ctx.fillRect(0, 0, 4, 4);
				ctx.fillRect(60, 0, 4, 4);
				ctx.fillRect(0, 44, 4, 4);
				ctx.fillRect(60, 44, 4, 4);

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Scrolls", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
