import { describe, it, expect } from "vitest";
import {
	CANVAS_GAP,
	CANVAS_PADDING,
	JOURNEY_LAYOUT,
	TEMPLATE_LAYOUT,
	TRAIN_LAYOUT,
} from "../../../src/domain/canvas/layoutConstants";

describe("layoutConstants", () => {
	it("exports shared base constants", () => {
		expect(CANVAS_GAP).toBe(40);
		expect(CANVAS_PADDING).toBe(40);
	});

	it("JOURNEY_LAYOUT has correct dimensions", () => {
		expect(JOURNEY_LAYOUT.NODE_W).toBe(160);
		expect(JOURNEY_LAYOUT.NODE_H).toBe(80);
		expect(JOURNEY_LAYOUT.GROUP_W).toBe(480);
		expect(JOURNEY_LAYOUT.GROUP_H).toBe(160);
		expect(JOURNEY_LAYOUT.INNER_PAD).toBe(50);
		expect(JOURNEY_LAYOUT.INNER_W).toBe(480 - 50 * 2);
	});

	it("TEMPLATE_LAYOUT has correct dimensions", () => {
		expect(TEMPLATE_LAYOUT.GROUP_W).toBe(460);
		expect(TEMPLATE_LAYOUT.GROUP_H).toBe(400);
		expect(TEMPLATE_LAYOUT.CARD_W).toBe(380);
		expect(TEMPLATE_LAYOUT.CARD_H).toBe(80);
		expect(TEMPLATE_LAYOUT.CARD_PAD).toBe(40);
	});

	it("TRAIN_LAYOUT has correct dimensions", () => {
		expect(TRAIN_LAYOUT.NODE_WIDTH).toBe(400);
		expect(TRAIN_LAYOUT.NODE_HEIGHT).toBe(200);
		expect(TRAIN_LAYOUT.SPACING_Y).toBe(280);
		expect(TRAIN_LAYOUT.BRANCH_LANE_WIDTH).toBe(500);
		expect(TRAIN_LAYOUT.GROUP_PADDING).toBe(40);
	});
});
