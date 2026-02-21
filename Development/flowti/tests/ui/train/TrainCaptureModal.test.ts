// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { TrainCaptureModal } from "../../../src/ui/train/TrainCaptureModal";

function createMockApp(): import("obsidian").App {
	return {} as import("obsidian").App;
}

describe("TrainCaptureModal", () => {
	it("renders train title heading", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "My Train",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
		});
		modal.onOpen();

		const h3 = modal.contentEl.querySelector("h3");
		expect(h3?.textContent).toBe("Train: My Train");
	});

	it("shows thought counter", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "Counter Test",
			previousThoughtTitle: null,
			thoughtCount: 3,
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
		});
		modal.onOpen();

		const counter = modal.contentEl.querySelector(".flowti-train-counter");
		expect(counter?.textContent).toBe("Thought #4");
	});

	it("shows context banner when previousThoughtTitle is provided", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "Context Test",
			previousThoughtTitle: "Previous Idea",
			thoughtCount: 1,
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
		});
		modal.onOpen();

		const banner = modal.contentEl.querySelector(".flowti-train-context");
		expect(banner).not.toBeNull();
		expect(banner?.textContent).toContain("Previous: Previous Idea");
	});

	it("hides context banner for first thought (null previousTitle)", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "No Context",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
		});
		modal.onOpen();

		const banner = modal.contentEl.querySelector(".flowti-train-context");
		expect(banner).toBeNull();
	});

	it("does not call onSubmit on open (requires user interaction)", () => {
		const onSubmit = vi.fn();
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "No Auto Submit",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit,
			onCancel: vi.fn(),
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
			onCancel,
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
			onCancel: vi.fn(),
		});
		modal.onOpen();
		expect(modal.contentEl.children.length).toBeGreaterThan(0);

		modal.onClose();
		expect(modal.contentEl.children.length).toBe(0);
	});

	it("creates DOM elements on open (h3, counter, settings)", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "DOM Test",
			previousThoughtTitle: "Prev",
			thoughtCount: 5,
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
		});
		modal.onOpen();

		// h3 + context banner + counter + 2 Setting wrappers
		expect(modal.contentEl.children.length).toBeGreaterThanOrEqual(3);
	});

	it("displays thought count starting at 1 for first thought", () => {
		const modal = new TrainCaptureModal(createMockApp(), {
			trainTitle: "First",
			previousThoughtTitle: null,
			thoughtCount: 0,
			onSubmit: vi.fn(),
			onCancel: vi.fn(),
		});
		modal.onOpen();

		const counter = modal.contentEl.querySelector(".flowti-train-counter");
		expect(counter?.textContent).toBe("Thought #1");
	});
});
