/**
 * notice-board.ts — Notice board environmental object.
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
				// Frame
				ctx.fillStyle = "#92400e";
				ctx.fillRect(0, 0, 48, 40);

				// Cork surface
				ctx.fillStyle = "#d97706";
				ctx.fillRect(3, 3, 42, 34);

				// Cork texture dots
				ctx.fillStyle = "#b45309";
				for (let i = 0; i < 8; i++) {
					const dotX = 6 + (i % 4) * 10;
					const dotY = 6 + Math.floor(i / 4) * 16;
					ctx.beginPath();
					ctx.arc(dotX, dotY, 0.5, 0, Math.PI * 2);
					ctx.fill();
				}

				// Sticky note 1 (yellow, top-left)
				ctx.fillStyle = "#fbbf24";
				ctx.fillRect(5, 5, 12, 10);

				// Sticky note 2 (blue, top-right)
				ctx.fillStyle = "#60a5fa";
				ctx.fillRect(22, 6, 14, 9);

				// Sticky note 3 (red, bottom-left)
				ctx.fillStyle = "#f87171";
				ctx.fillRect(8, 20, 11, 12);

				// Sticky note 4 (green, bottom-right)
				ctx.fillStyle = "#34d399";
				ctx.fillRect(24, 22, 16, 10);

				// Small note (white, center)
				ctx.fillStyle = "#fef3c7";
				ctx.fillRect(38, 5, 6, 8);

				// Pin dots on notes
				ctx.fillStyle = "#ef4444";
				ctx.beginPath();
				ctx.arc(11, 6, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#3b82f6";
				ctx.beginPath();
				ctx.arc(29, 7, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#fbbf24";
				ctx.beginPath();
				ctx.arc(13, 21, 1.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#10b981";
				ctx.beginPath();
				ctx.arc(32, 23, 1.5, 0, Math.PI * 2);
				ctx.fill();

				// Scribble lines on yellow note
				ctx.strokeStyle = "#92400e";
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.moveTo(6, 9);
				ctx.lineTo(15, 9);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(6, 11);
				ctx.lineTo(13, 11);
				ctx.stroke();

				// Label
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "8px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Notices", this.width / 2, this.height + 10);
			},
		});
		this.graphics.use(canvas);
	}
}
