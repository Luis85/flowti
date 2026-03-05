// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import {
	renderHeader,
	renderBackButton,
	renderActionButton,
	renderLoading,
} from "../../../src/ui/journeyBuilder/sidebarHelpers";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

describe("sidebarHelpers", () => {
	let el: HTMLDivElement;

	beforeEach(() => {
		el = document.createElement("div");
	});

	describe("renderHeader", () => {
		it("renders header with title", () => {
			renderHeader(el);
			const title = byTestId(el, "jb-header-title");
			expect(title).toBeTruthy();
			expect(title!.textContent).toBe("Journey builder");
		});

		it("renders header container with class", () => {
			renderHeader(el);
			expect(el.querySelector(".ft-jb-header")).toBeTruthy();
		});

		it("renders icon element", () => {
			renderHeader(el);
			expect(el.querySelector(".ft-jb-header-icon")).toBeTruthy();
		});
	});

	describe("renderBackButton", () => {
		it("renders back button with test id", () => {
			renderBackButton(el, vi.fn());
			expect(byTestId(el, "jb-back-btn")).toBeTruthy();
		});

		it("calls onBack on click", () => {
			const onBack = vi.fn();
			renderBackButton(el, onBack);
			byTestId(el, "jb-back-btn")!.click();
			expect(onBack).toHaveBeenCalledOnce();
		});

		it("calls onBack on Enter key", () => {
			const onBack = vi.fn();
			renderBackButton(el, onBack);
			byTestId(el, "jb-back-btn")!.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
			expect(onBack).toHaveBeenCalledOnce();
		});

		it("has button role and tabindex", () => {
			renderBackButton(el, vi.fn());
			const btn = byTestId(el, "jb-back-btn")!;
			expect(btn.getAttribute("role")).toBe("button");
			expect(btn.getAttribute("tabindex")).toBe("0");
		});
	});

	describe("renderActionButton", () => {
		it("renders button with test id", () => {
			renderActionButton(el, {
				testId: "my-btn",
				cls: "ft-my-btn",
				icon: "plus",
				text: "Add",
				onClick: vi.fn(),
			});
			expect(byTestId(el, "my-btn")).toBeTruthy();
		});

		it("calls onClick on click", () => {
			const onClick = vi.fn();
			renderActionButton(el, {
				testId: "my-btn",
				cls: "ft-my-btn",
				icon: "plus",
				text: "Add",
				onClick,
			});
			byTestId(el, "my-btn")!.click();
			expect(onClick).toHaveBeenCalledOnce();
		});

		it("calls onClick on Space key", () => {
			const onClick = vi.fn();
			renderActionButton(el, {
				testId: "my-btn",
				cls: "ft-my-btn",
				icon: "plus",
				text: "Add",
				onClick,
			});
			byTestId(el, "my-btn")!.dispatchEvent(
				new KeyboardEvent("keydown", { key: " ", bubbles: true }),
			);
			expect(onClick).toHaveBeenCalledOnce();
		});

		it("applies the provided CSS class", () => {
			renderActionButton(el, {
				testId: "my-btn",
				cls: "ft-my-btn",
				icon: "plus",
				text: "Add",
				onClick: vi.fn(),
			});
			expect(el.querySelector(".ft-my-btn")).toBeTruthy();
		});
	});

	describe("renderLoading", () => {
		it("renders loading with test id", () => {
			renderLoading(el, "Loading…");
			expect(byTestId(el, "jb-loading")).toBeTruthy();
		});

		it("renders the message text", () => {
			renderLoading(el, "Importing journey…");
			const text = el.querySelector(".ft-jb-loading-text");
			expect(text).toBeTruthy();
			expect(text!.textContent).toBe("Importing journey…");
		});

		it("renders the spinner", () => {
			renderLoading(el, "Loading…");
			expect(el.querySelector(".ft-jb-loading-spinner")).toBeTruthy();
		});
	});
});
