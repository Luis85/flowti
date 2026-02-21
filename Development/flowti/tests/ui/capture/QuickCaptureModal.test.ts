// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../../tests/mocks/obsidian-stub";
import { QuickCaptureModal } from "../../../src/ui/capture/QuickCaptureModal";

// Minimal App stub
function createMockApp(): import("obsidian").App {
	return {} as import("obsidian").App;
}

describe("QuickCaptureModal", () => {
	it("should render title heading on open", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
		});
		modal.onOpen();

		const h3 = modal.contentEl.querySelector("h3");
		expect(h3).not.toBeNull();
		expect(h3?.textContent).toBe("Quick Capture");
	});

	it("should clean up content on close", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
		});
		modal.onOpen();
		expect(modal.contentEl.children.length).toBeGreaterThan(0);

		modal.onClose();
		expect(modal.contentEl.children.length).toBe(0);
	});

	it("should accept showTypeSelector option without error", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
			showTypeSelector: true,
		});
		expect(() => modal.onOpen()).not.toThrow();
	});

	it("should accept defaultType option without error", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
			defaultType: "feedback",
		});
		expect(() => modal.onOpen()).not.toThrow();
	});

	it("should accept combined ribbon-style options (no selector, typed)", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
			showTypeSelector: false,
			defaultType: "idea",
		});
		expect(() => modal.onOpen()).not.toThrow();
	});

	it("should accept command-palette-style options (selector, no type)", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
			showTypeSelector: true,
		});
		expect(() => modal.onOpen()).not.toThrow();
	});

	it("should store onSubmit callback without calling it on open", () => {
		const onSubmit = vi.fn();
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit,
		});
		modal.onOpen();

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("should default to idea type when no defaultType provided", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
		});
		expect(() => modal.onOpen()).not.toThrow();
	});

	it("should open and close without errors", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
			showTypeSelector: true,
			defaultType: "bug",
		});
		expect(() => {
			modal.onOpen();
			modal.onClose();
		}).not.toThrow();
	});

	it("should accept custom capture type", () => {
		const modal = new QuickCaptureModal(createMockApp(), {
			onSubmit: vi.fn(),
			defaultType: "meeting-notes",
		});
		expect(() => modal.onOpen()).not.toThrow();
	});
});
