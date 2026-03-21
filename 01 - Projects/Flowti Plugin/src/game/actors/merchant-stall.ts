/**
 * merchant-stall.ts — Shop stall actor in the hub room.
 * Provides a visual shop presence for economy interactions.
 */

import { InteractableActor } from "./interactable-actor.js";
import * as ex from "excalibur";

export class MerchantStall extends InteractableActor {
	constructor() {
		super({
			objectId: "merchant-stall",
			objectType: "shop",
			width: 48,
			height: 48,
			interactionOffset: { x: 0, y: 24 },
			needsEffects: {}, // no needs effects — shop interaction only
		});

		const canvas = new ex.Canvas({
			width: this.width,
			height: this.height,
			draw: (ctx) => {
				// Stall base
				ctx.fillStyle = "#8B4513";
				ctx.fillRect(4, 20, 40, 24);
				// Counter
				ctx.fillStyle = "#D2691E";
				ctx.fillRect(2, 18, 44, 6);
				// Awning
				ctx.fillStyle = "#DAA520";
				ctx.fillRect(0, 4, 48, 16);
				ctx.fillStyle = "#B8860B";
				for (let i = 0; i < 4; i++) {
					ctx.fillRect(i * 12, 14, 6, 6);
				}
				// Sign
				ctx.fillStyle = "#f5f5f4";
				ctx.font = "7px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Shop", 24, 14);
			},
		});
		this.graphics.use(canvas);
	}
}
