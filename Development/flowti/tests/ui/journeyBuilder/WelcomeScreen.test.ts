// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { WelcomeScreen } from "../../../src/ui/journeyBuilder/WelcomeScreen";
import type { WelcomeScreenDeps } from "../../../src/ui/journeyBuilder/WelcomeScreen";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

function allByTestId(root: HTMLElement, id: string): HTMLElement[] {
	return Array.from(root.querySelectorAll(`[data-test-id="${id}"]`));
}

describe("WelcomeScreen", () => {
	let container: HTMLDivElement;
	let deps: WelcomeScreenDeps;

	beforeEach(() => {
		container = document.createElement("div");
		deps = {
			hasExistingJourneys: false,
			onCreateNew: vi.fn(),
			onOpenExisting: vi.fn(),
			onImportFile: vi.fn(),
			onImportFromSystem: vi.fn(),
		};
	});

	describe("empty state (no journeys)", () => {
		it("renders empty welcome container", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-empty-welcome")).toBeTruthy();
		});

		it("renders empty icon", () => {
			new WelcomeScreen(container, deps).render();
			expect(container.querySelector(".ft-jb-empty-icon")).toBeTruthy();
		});

		it("renders empty title", () => {
			new WelcomeScreen(container, deps).render();
			const title = container.querySelector(".ft-jb-empty-title");
			expect(title).toBeTruthy();
			expect(title!.textContent).toBe("No journeys yet");
		});

		it("renders create first button", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-create-new")).toBeTruthy();
		});

		it("calls onCreateNew on create button click", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-create-new")!.click();
			expect(deps.onCreateNew).toHaveBeenCalledOnce();
		});

		it("renders import link", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-import-link")).toBeTruthy();
		});

		it("calls onImportFile on import link click", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-import-link")!.click();
			expect(deps.onImportFile).toHaveBeenCalledOnce();
		});

		it("renders browse link", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-browse-link")).toBeTruthy();
		});

		it("calls onImportFromSystem on browse link click", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-browse-link")!.click();
			expect(deps.onImportFromSystem).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation on import link (Enter)", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-import-link")!.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
			expect(deps.onImportFile).toHaveBeenCalledOnce();
		});

		it("does not render welcome cards", () => {
			new WelcomeScreen(container, deps).render();
			expect(container.querySelector(".ft-jb-welcome-cards")).toBeNull();
		});
	});

	describe("cards state (journeys exist)", () => {
		beforeEach(() => {
			deps.hasExistingJourneys = true;
		});

		it("renders welcome cards container", () => {
			new WelcomeScreen(container, deps).render();
			expect(container.querySelector(".ft-jb-welcome-cards")).toBeTruthy();
		});

		it("renders three cards", () => {
			new WelcomeScreen(container, deps).render();
			const titles = allByTestId(container, "jb-card-title");
			expect(titles).toHaveLength(3);
		});

		it("renders open existing card", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-open-existing")).toBeTruthy();
		});

		it("calls onOpenExisting on open card click", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-open-existing")!.click();
			expect(deps.onOpenExisting).toHaveBeenCalledOnce();
		});

		it("renders create new card", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-create-new")).toBeTruthy();
		});

		it("calls onCreateNew on create card click", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-create-new")!.click();
			expect(deps.onCreateNew).toHaveBeenCalledOnce();
		});

		it("renders import definition card", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-import-definition")).toBeTruthy();
		});

		it("calls onImportFile on import card click", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-import-definition")!.click();
			expect(deps.onImportFile).toHaveBeenCalledOnce();
		});

		it("supports keyboard activation on cards (Enter)", () => {
			new WelcomeScreen(container, deps).render();
			byTestId(container, "jb-open-existing")!.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
			expect(deps.onOpenExisting).toHaveBeenCalledOnce();
		});

		it("does not render empty welcome", () => {
			new WelcomeScreen(container, deps).render();
			expect(byTestId(container, "jb-empty-welcome")).toBeNull();
		});
	});
});
