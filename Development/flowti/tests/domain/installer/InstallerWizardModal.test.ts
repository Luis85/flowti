// @vitest-environment happy-dom
/**
 * Unit tests for InstallerWizardModal.
 *
 * Tests the categorised review page and keyboard navigation.
 */

import "../../mocks/obsidian-stub";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InstallerWizardModal } from "../../../src/domain/installer/InstallerWizardModal";
import type { IInstallerService } from "../../../src/domain/installer/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { App } from "obsidian";
import { App as StubApp } from "../../mocks/obsidian-stub";

function createMockInstallerService(): IInstallerService {
	return {
		isInstalled: vi.fn(() => false),
		getSteps: vi.fn(() => [
			{ id: "user-creation", name: "Create User Profile", description: "Creates your user profile", intro: "Your user profile...", order: 10 },
			{ id: "folder-scaffold", name: "Scaffold Folders", description: "Creates folder structure", intro: "The folder structure...", order: 20 },
			{ id: "seed-content", name: "Seed Content", description: "Seeds sample content", intro: "Sample content...", order: 30 },
		]),
		runAll: vi.fn(async () => true),
		load: vi.fn(async () => {}),
	} as unknown as IInstallerService;
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
	} as unknown as IEventBus;
}

describe("InstallerWizardModal", () => {
	let modal: InstallerWizardModal;
	let installer: IInstallerService;
	let eventBus: IEventBus;

	beforeEach(() => {
		installer = createMockInstallerService();
		eventBus = createMockEventBus();
		modal = new InstallerWizardModal(new StubApp() as unknown as App, installer, eventBus);
		// Set userName directly so navigation works
		(modal as unknown as { userName: string }).userName = "Test User";
		modal.onOpen(); // renders welcome page
	});

	/** Navigate to a specific page. */
	function goToPage(page: "welcome" | "role" | "review"): void {
		if (page === "welcome") return; // already there after onOpen()

		// Welcome → Role: click "Next"
		clickButton("Next");
		if (page === "role") return;

		// Role → Review: click "Next"
		clickButton("Next");
	}

	function clickButton(label: string): void {
		const btns = Array.from(modal.contentEl.querySelectorAll("button"));
		const btn = btns.find((b) => b.textContent === label);
		btn?.click();
	}

	function fireKey(key: string): void {
		modal.contentEl.dispatchEvent(
			new KeyboardEvent("keydown", { key, bubbles: true }),
		);
	}

	function getHeadingTexts(tag: "h2" | "h3" = "h3"): string[] {
		return Array.from(modal.contentEl.querySelectorAll(tag))
			.map((h) => h.textContent ?? "");
	}

	describe("categorised review page", () => {
		it("shows Folder Structure section", () => {
			goToPage("review");
			expect(getHeadingTexts()).toContain("Folder Structure");
		});

		it("shows Sample Content section", () => {
			goToPage("review");
			expect(getHeadingTexts()).toContain("Sample Content");
		});

		it("shows Pre-Built Dashboard section", () => {
			goToPage("review");
			expect(getHeadingTexts()).toContain("Pre-Built Dashboard");
		});

		it("shows session templates for supplier-manager role", () => {
			(modal as unknown as { selectedRole: string }).selectedRole = "supplier-manager";
			goToPage("review");
			expect(modal.contentEl.textContent).toContain("3 session templates");
		});

		it("hides session templates for user role", () => {
			(modal as unknown as { selectedRole: string }).selectedRole = "user";
			goToPage("review");
			expect(modal.contentEl.textContent).not.toContain("3 session templates");
		});

		it("shows folder descriptions from config", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("00 - Connectivity");
			expect(text).toContain("External connections");
		});
	});

	describe("keyboard navigation", () => {
		it("Escape on welcome page closes the modal", () => {
			const closeSpy = vi.spyOn(modal, "close");
			fireKey("Escape");
			expect(closeSpy).toHaveBeenCalled();
		});

		it("Enter on role page advances to review", () => {
			goToPage("role");
			fireKey("Enter");
			expect(getHeadingTexts()).toContain("Folder Structure");
		});

		it("Escape on role page goes back to welcome", () => {
			goToPage("role");
			fireKey("Escape");
			expect(getHeadingTexts("h2")[0]).toContain("Welcome");
		});

		it("Escape on review page goes back to role", () => {
			goToPage("review");
			fireKey("Escape");
			expect(getHeadingTexts("h2")[0]).toContain("role");
		});
	});
});
