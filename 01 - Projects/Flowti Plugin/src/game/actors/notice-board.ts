/**
 * notice-board.ts — Quest Board environmental object.
 * Displays project metrics and announcements on click.
 * No direct needs effects — serves as an information hub.
 */

import * as ex from "excalibur";
import { InteractableActor } from "./interactable-actor.js";

export class NoticeBoard extends InteractableActor {
	constructor() {
		super({
			objectId: "notice-board",
			objectType: "morale",
			width: 48,
			height: 40,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: {},
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Wooden board back
				ctx.fillStyle = "#5c4033";
				ctx.fillRect(2, 2, 44, 36);

				// Wooden frame — outer
				ctx.strokeStyle = "#3a2a1f";
				ctx.lineWidth = 2;
				ctx.strokeRect(1, 1, 46, 38);

				// Title bar at top
				ctx.fillStyle = "#3a2a1f";
				ctx.fillRect(2, 2, 44, 8);

				// Title text
				ctx.fillStyle = "#d4a017";
				ctx.font = "6px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("QUESTS", 24, 9);

				// Parchment sheet 1 (top-left)
				ctx.fillStyle = "#d4c4a0";
				ctx.fillRect(5, 13, 14, 10);
				ctx.strokeStyle = "#b0a080";
				ctx.lineWidth = 0.5;
				ctx.strokeRect(5, 13, 14, 10);

				// Parchment sheet 2 (top-right)
				ctx.fillStyle = "#c4b090";
				ctx.fillRect(22, 12, 16, 11);
				ctx.strokeStyle = "#b0a080";
				ctx.strokeRect(22, 12, 16, 11);

				// Parchment sheet 3 (bottom-left)
				ctx.fillStyle = "#d4c4a0";
				ctx.fillRect(6, 26, 12, 10);
				ctx.strokeStyle = "#b0a080";
				ctx.strokeRect(6, 26, 12, 10);

				// Parchment sheet 4 (bottom-right, larger)
				ctx.fillStyle = "#c8b898";
				ctx.fillRect(21, 26, 18, 10);
				ctx.strokeStyle = "#b0a080";
				ctx.strokeRect(21, 26, 18, 10);

				// Text lines on sheets
				ctx.strokeStyle = "#5c4a35";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.moveTo(7, 17);
				ctx.lineTo(17, 17);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(7, 19);
				ctx.lineTo(15, 19);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(24, 16);
				ctx.lineTo(36, 16);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(24, 18);
				ctx.lineTo(34, 18);
				ctx.stroke();

				// Push pin dots
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(12, 14, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.arc(30, 13, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(12, 27, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.arc(30, 27, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Wood grain texture
				ctx.strokeStyle = "rgba(58, 42, 31, 0.2)";
				ctx.lineWidth = 0.3;
				ctx.beginPath();
				ctx.moveTo(3, 15);
				ctx.lineTo(3, 35);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(45, 15);
				ctx.lineTo(45, 35);
				ctx.stroke();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Quests", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
