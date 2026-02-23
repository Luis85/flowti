// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TrainResumeModal, type ResumeChoice } from "../../../src/ui/train/TrainResumeModal";

type ChoiceFn = (choice: ResumeChoice) => void;

// ── Helpers ──────────────────────────────────────────────

function createModal(onChoice: ChoiceFn): TrainResumeModal {
	return new TrainResumeModal({} as import("obsidian").App, {
		trainTitle: "Deep Research",
		currentThoughtTitle: "Second Idea",
		headThoughtTitle: "Latest Idea",
		onChoice,
	});
}

function getContentEl(modal: TrainResumeModal): HTMLElement {
	return (modal as unknown as { contentEl: HTMLElement }).contentEl;
}

// ── Tests ────────────────────────────────────────────────

describe("TrainResumeModal", () => {
	let onChoice: ChoiceFn;

	beforeEach(() => {
		onChoice = vi.fn<ChoiceFn>();
	});

	describe("rendering", () => {
		it("renders the train title in the heading", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			expect(el.textContent).toContain("Resume: Deep Research");
		});

		it("renders current and head thought titles in description", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			expect(el.textContent).toContain("Second Idea");
			expect(el.textContent).toContain("Latest Idea");
		});

		it("renders three option buttons", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const buttons = el.querySelectorAll("button");
			expect(buttons.length).toBe(3);
		});

		it("renders options with correct data-choice attributes", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const buttons = el.querySelectorAll("button");
			const choices = Array.from(buttons).map((b) => b.dataset.choice);
			expect(choices).toEqual(["jump-to-end", "branch-from-here", "stay-here"]);
		});

		it("renders Jump to end as primary button", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const jumpBtn = el.querySelector("[data-choice='jump-to-end']") as HTMLElement;
			expect(jumpBtn.className).toContain("ft-btn-primary");
		});

		it("renders Branch from here and Stay here as ghost buttons", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const branchBtn = el.querySelector("[data-choice='branch-from-here']") as HTMLElement;
			const stayBtn = el.querySelector("[data-choice='stay-here']") as HTMLElement;
			expect(branchBtn.className).toContain("ft-btn-ghost");
			expect(stayBtn.className).toContain("ft-btn-ghost");
		});
	});

	describe("choice callbacks", () => {
		it("calls onChoice with 'jump-to-end' when Jump to end clicked", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const jumpBtn = el.querySelector("[data-choice='jump-to-end']") as HTMLElement;
			jumpBtn.click();

			expect(onChoice).toHaveBeenCalledWith("jump-to-end");
		});

		it("calls onChoice with 'branch-from-here' when Branch clicked", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const branchBtn = el.querySelector("[data-choice='branch-from-here']") as HTMLElement;
			branchBtn.click();

			expect(onChoice).toHaveBeenCalledWith("branch-from-here");
		});

		it("calls onChoice with 'stay-here' when Stay here clicked", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const stayBtn = el.querySelector("[data-choice='stay-here']") as HTMLElement;
			stayBtn.click();

			expect(onChoice).toHaveBeenCalledWith("stay-here");
		});

		it("calls onChoice with 'stay-here' when modal closed without choosing", () => {
			const modal = createModal(onChoice);
			modal.onOpen();
			modal.onClose();

			expect(onChoice).toHaveBeenCalledWith("stay-here");
		});

		it("does not call onChoice again on close after a choice was made", () => {
			const modal = createModal(onChoice);
			modal.onOpen();

			const el = getContentEl(modal);
			const jumpBtn = el.querySelector("[data-choice='jump-to-end']") as HTMLElement;
			jumpBtn.click();
			vi.mocked(onChoice).mockClear();

			modal.onClose();
			expect(onChoice).not.toHaveBeenCalled();
		});
	});
});
