// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainCaptureModal } from "../../../src/ui/train/TrainCaptureModal";

function createMockApp(): import("obsidian").App {
	return {} as import("obsidian").App;
}

describe("TrainCaptureModal", () => {
	it("renders train title heading (no prefix for first thought)", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "My Train",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();

		const h3 = modal.contentEl.querySelector("h3");
		expect(h3?.textContent).toBe("My Train");
	});

	it("renders previous thought title as heading when provided", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "My Train",
			previousThoughtTitle: "Previous Idea",
			thoughtCount: 1,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();

		const h3 = modal.contentEl.querySelector("h3");
		expect(h3?.textContent).toBe("Previous Idea");
	});

	it("shows thought counter in title input label", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "Counter Test",
			previousThoughtTitle: null,
			thoughtCount: 3,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();

		const text = modal.contentEl.textContent ?? "";
		expect(text).toContain("Thought #4");
	});

	it("does not call onSubmit on open (requires user interaction)", () => {
		const onSubmit = vi.fn();
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "No Auto Submit",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit,
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("calls onCancel when closed without submitting", () => {
		const onCancel = vi.fn();
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "Cancel Test",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel,
			durationMinutes: 0,
		});
		modal.onOpen();
		modal.onClose();

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("cleans up content on close", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "Cleanup",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();
		expect(modal.contentEl.children.length).toBeGreaterThan(0);

		modal.onClose();
		expect(modal.contentEl.children.length).toBe(0);
	});

	it("creates DOM elements on open (h3 + settings)", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "DOM Test",
			previousThoughtTitle: "Prev",
			thoughtCount: 5,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();

		// h3 + Setting wrappers (title input, direction, buttons)
		expect(modal.contentEl.children.length).toBeGreaterThanOrEqual(2);
	});

	it("displays thought count starting at 1 for first thought", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "First",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onComplete: vi.fn(),
			onCancel: vi.fn(),
		durationMinutes: 0,
		});
		modal.onOpen();

		const text = modal.contentEl.textContent ?? "";
		expect(text).toContain("Thought #1");
	});

	describe("keyboard navigation", () => {
		it("Esc key closes modal and triggers onCancel", () => {
			const onCancel = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Esc Test",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel,
				durationMinutes: 0,
			});
			modal.onOpen();

			modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			// Stub close() is no-op, so call onClose() manually
			modal.onClose();

			expect(onCancel).toHaveBeenCalledOnce();
		});

		it("Tab key toggles direction from next to branch", () => {
			const onSubmit = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Tab Test",
				previousThoughtTitle: "Previous",
				thoughtCount: 1,
				onSubmit,
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			// Direction starts as "next" (default)
			const dropdown = modal.contentEl.querySelector("select") as HTMLSelectElement;
			expect(dropdown.value).toBe("next");

			// Press Tab → should toggle to "branch"
			modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
			expect(dropdown.value).toBe("branch");
		});

		it("Tab key toggles direction from branch back to next", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Tab Toggle",
				previousThoughtTitle: "Previous",
				thoughtCount: 1,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				defaultDirection: "branch",
			});
			modal.onOpen();

			const dropdown = modal.contentEl.querySelector("select") as HTMLSelectElement;
			expect(dropdown.value).toBe("branch");

			modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
			expect(dropdown.value).toBe("next");
		});

		it("Tab does nothing when no direction selector (first thought)", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Tab No-op",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			// No dropdown present
			const dropdown = modal.contentEl.querySelector("select");
			expect(dropdown).toBeNull();

			// Tab should not throw or affect state
			modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
		});

		it("shows keyboard hint near direction selector", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Hint Test",
				previousThoughtTitle: "Previous",
				thoughtCount: 1,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			const allText = modal.contentEl.textContent ?? "";
			expect(allText).toContain("Tab to cycle");
		});

		it("hides keyboard hint when no direction selector", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "No Hint",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			const allText = modal.contentEl.textContent ?? "";
			expect(allText).not.toContain("Tab to cycle");
		});

		it("submits with toggled direction after Tab", () => {
			const onSubmit = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Submit Toggle",
				previousThoughtTitle: "Previous",
				thoughtCount: 1,
				onSubmit,
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			// Tab to toggle to "branch"
			modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

			// Type a title and submit
			const input = modal.contentEl.querySelector("input") as HTMLInputElement;
			input.value = "Branched thought";
			input.dispatchEvent(new Event("input", { bubbles: true }));

			// Trigger Enter to submit
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			modal.onClose();

			expect(onSubmit).toHaveBeenCalledWith("Branched thought", "branch");
		});
	});

	describe("back button", () => {
		it("shows back button in the action row when onBack is provided", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Previous",
				thoughtCount: 1,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onBack: vi.fn(),
			});
			modal.onOpen();

			const backBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
				(b) => b.textContent?.includes("back"),
			);
			expect(backBtn).toBeDefined();
			// Back button should be in the same Setting row as the Add thought button
			const addBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
				(b) => b.textContent?.includes("Add thought"),
			);
			const actionSetting = addBtn?.closest(".setting-item");
			expect(backBtn?.closest(".setting-item")).toBe(actionSetting);
		});

		it("does not show back button when onBack is not provided", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			const backBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
				(b) => b.textContent?.includes("back"),
			);
			expect(backBtn).toBeUndefined();
		});

		it("triggers onBack when back button is clicked", () => {
			const onBack = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Previous",
				thoughtCount: 1,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onBack,
			});
			modal.onOpen();

			const backBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
				(b) => b.textContent?.includes("back"),
			) as HTMLButtonElement;
			backBtn.click();
			modal.onClose();

			expect(onBack).toHaveBeenCalledOnce();
		});
	});

	describe("direction row", () => {
		it("renders direction dropdown on a separate row from action buttons", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Direction Row",
				previousThoughtTitle: "Previous",
				thoughtCount: 4,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			const dropdown = modal.contentEl.querySelector("select") as HTMLSelectElement;
			expect(dropdown).not.toBeNull();
			// Direction dropdown is in its own Setting row, separate from the action buttons
			const dropdownSetting = dropdown.closest(".setting-item");
			const addBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
				(b) => b.textContent?.includes("Add thought"),
			);
			const actionSetting = addBtn?.closest(".setting-item");
			expect(dropdownSetting).not.toBe(actionSetting);
		});
	});

	describe("timer display", () => {
		it("shows no timer when durationMinutes is 0", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "No Timer",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			const timer = modal.contentEl.querySelector(".ft-train-timer");
			expect(timer).toBeNull();
		});

		it("shows timer when durationMinutes > 0", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "With Timer",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 25,
				subscribeTimerTick: () => () => {},
				subscribeTimerCompleted: () => () => {},
			});
			modal.onOpen();

			const timer = modal.contentEl.querySelector(".ft-train-timer");
			expect(timer).not.toBeNull();
			expect(timer?.textContent).toBe("25:00");
		});

		it("updates timer on tick callback", () => {
			let tickCb: ((remainingMs: number) => void) | null = null;
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Tick Timer",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 10,
				subscribeTimerTick: (cb) => {
					tickCb = cb;
					return () => {};
				},
				subscribeTimerCompleted: () => () => {},
			});
			modal.onOpen();

			// Simulate tick at 5:30 remaining
			tickCb!(5 * 60_000 + 30_000);

			const timer = modal.contentEl.querySelector(".ft-train-timer");
			expect(timer?.textContent).toBe("05:30");
		});

		it("closes modal and calls onComplete when timer completes", () => {
			let completedCb: (() => void) | null = null;
			const onComplete = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Timer Complete",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete,
				onCancel: vi.fn(),
				durationMinutes: 5,
				subscribeTimerTick: () => () => {},
				subscribeTimerCompleted: (cb) => {
					completedCb = cb;
					return () => {};
				},
			});
			modal.onOpen();

			// Simulate timer completion — sets completed flag + calls close()
			completedCb!();
			// In real Obsidian close() calls onClose(), but stub close() is no-op
			// so we call onClose() manually (same pattern as other tests)
			modal.onClose();

			expect(onComplete).toHaveBeenCalledOnce();
		});

		it("unsubscribes timer listeners on close", () => {
			const unsubTick = vi.fn();
			const unsubCompleted = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "Unsub Timer",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 15,
				subscribeTimerTick: () => unsubTick,
				subscribeTimerCompleted: () => unsubCompleted,
			});
			modal.onOpen();
			modal.onClose();

			expect(unsubTick).toHaveBeenCalledOnce();
			expect(unsubCompleted).toHaveBeenCalledOnce();
		});
	});

	describe("thought rename", () => {
		it("shows pencil icon when onRenameThought and previousThoughtTitle are provided", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Existing Thought",
				thoughtCount: 2,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onRenameThought: vi.fn(),
			});
			modal.onOpen();

			const editBtn = modal.contentEl.querySelector("button[aria-label='Rename thought']");
			expect(editBtn).not.toBeNull();
		});

		it("does not show pencil icon when onRenameThought is not provided", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Existing Thought",
				thoughtCount: 2,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
			});
			modal.onOpen();

			const editBtn = modal.contentEl.querySelector("button[aria-label='Rename thought']");
			expect(editBtn).toBeNull();
		});

		it("does not show pencil icon for first thought (no previousThoughtTitle)", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: null,
				thoughtCount: 0,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onRenameThought: vi.fn(),
			});
			modal.onOpen();

			const editBtn = modal.contentEl.querySelector("button[aria-label='Rename thought']");
			expect(editBtn).toBeNull();
		});

		it("shows input field when pencil is clicked", () => {
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Existing Thought",
				thoughtCount: 2,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onRenameThought: vi.fn(),
			});
			modal.onOpen();

			const editBtn = modal.contentEl.querySelector("button[aria-label='Rename thought']") as HTMLButtonElement;
			editBtn.click();

			const input = modal.contentEl.querySelector("input.ft-train-rename-input") as HTMLInputElement;
			expect(input).not.toBeNull();
			expect(input.value).toBe("Existing Thought");
		});

		it("calls onRenameThought when Enter is pressed with new title", () => {
			const onRename = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Old Title",
				thoughtCount: 2,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onRenameThought: onRename,
			});
			modal.onOpen();

			const editBtn = modal.contentEl.querySelector("button[aria-label='Rename thought']") as HTMLButtonElement;
			editBtn.click();

			const input = modal.contentEl.querySelector("input.ft-train-rename-input") as HTMLInputElement;
			input.value = "New Title";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onRename).toHaveBeenCalledWith("New Title");
		});

		it("does not call onRenameThought when title is unchanged", () => {
			const onRename = vi.fn();
			const modal = new TrainCaptureModal(createMockApp(), {
				trainTitle: "My Train",
				previousThoughtTitle: "Same Title",
				thoughtCount: 2,
				onSubmit: vi.fn(),
				onComplete: vi.fn(),
				onCancel: vi.fn(),
				durationMinutes: 0,
				onRenameThought: onRename,
			});
			modal.onOpen();

			const editBtn = modal.contentEl.querySelector("button[aria-label='Rename thought']") as HTMLButtonElement;
			editBtn.click();

			const input = modal.contentEl.querySelector("input.ft-train-rename-input") as HTMLInputElement;
			// Value is still "Same Title" — press Enter
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onRename).not.toHaveBeenCalled();
		});
	});
});
