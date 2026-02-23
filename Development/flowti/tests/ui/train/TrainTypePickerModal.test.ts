// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TrainTypePickerModal } from "../../../src/ui/train/TrainTypePickerModal";
import { BUILT_IN_TRAIN_TYPES, type TrainTypeConfig } from "../../../src/domain/train/types";
import type { App } from "obsidian";

// ── Helpers ──────────────────────────────────────────────

type SelectFn = (config: TrainTypeConfig) => void;

function createModal(onSelect: SelectFn): TrainTypePickerModal {
	return new TrainTypePickerModal({} as App, { onSelect });
}

function getContentEl(modal: TrainTypePickerModal): HTMLElement {
	return (modal as unknown as { contentEl: HTMLElement }).contentEl;
}

// ── Tests ────────────────────────────────────────────────

describe("TrainTypePickerModal", () => {
	let onSelect: SelectFn;

	beforeEach(() => {
		onSelect = vi.fn<SelectFn>();
	});

	describe("rendering", () => {
		it("renders heading", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			expect(getContentEl(modal).textContent).toContain("Start a new ride");
		});

		it("renders 4 type cards", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			const cards = getContentEl(modal).querySelectorAll(".ft-train-type-card");
			expect(cards.length).toBe(4);
		});

		it("renders each type with correct data-type-id", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			const cards = getContentEl(modal).querySelectorAll(".ft-train-type-card");
			const ids = Array.from(cards).map((c) => (c as HTMLElement).dataset.typeId);
			expect(ids).toEqual(["brainstorm", "research", "decision", "free-form"]);
		});

		it("displays duration text for timed types", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			const text = getContentEl(modal).textContent;
			expect(text).toContain("15 min");
			expect(text).toContain("25 min");
			expect(text).toContain("10 min");
		});

		it("displays 'No timer' for free-form", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			expect(getContentEl(modal).textContent).toContain("No timer");
		});
	});

	describe("selection", () => {
		it("calls onSelect with brainstorm config when clicked", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			const card = getContentEl(modal).querySelector("[data-type-id='brainstorm']") as HTMLElement;
			card.click();
			expect(onSelect).toHaveBeenCalledWith(BUILT_IN_TRAIN_TYPES[0]);
		});

		it("calls onSelect with research config when clicked", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			const card = getContentEl(modal).querySelector("[data-type-id='research']") as HTMLElement;
			card.click();
			expect(onSelect).toHaveBeenCalledWith(BUILT_IN_TRAIN_TYPES[1]);
		});

		it("does not call onSelect when dismissed without selection", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			modal.onClose();
			expect(onSelect).not.toHaveBeenCalled();
		});

		it("does not call onSelect again on close after selection", () => {
			const modal = createModal(onSelect);
			modal.onOpen();
			const card = getContentEl(modal).querySelector("[data-type-id='decision']") as HTMLElement;
			card.click();
			vi.mocked(onSelect).mockClear();
			modal.onClose();
			expect(onSelect).not.toHaveBeenCalled();
		});
	});
});
