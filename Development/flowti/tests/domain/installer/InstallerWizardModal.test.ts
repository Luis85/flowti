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
	function goToPage(page: "welcome" | "review"): void {
		if (page === "welcome") return; // already there after onOpen()

		// Welcome → Review: click "Next"
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

	function getHeadingTexts(tag: "h2" | "h3" | "card" = "card"): string[] {
		if (tag === "card") {
			// Card headers use .ft-card-header span (no h3)
			return Array.from(modal.contentEl.querySelectorAll(".ft-card-header"))
				.map((h) => h.textContent ?? "");
		}
		return Array.from(modal.contentEl.querySelectorAll(tag))
			.map((h) => h.textContent ?? "");
	}

	describe("categorised review page", () => {
		it("shows Folder Structure section", () => {
			goToPage("review");
			expect(getHeadingTexts().some((t) => t.includes("Folder Structure"))).toBe(true);
		});

		it("shows Sample Content section", () => {
			goToPage("review");
			expect(getHeadingTexts().some((t) => t.includes("Sample Content"))).toBe(true);
		});

		it("shows Pre-Built Dashboard section", () => {
			goToPage("review");
			expect(getHeadingTexts().some((t) => t.includes("Pre-Built Dashboard"))).toBe(true);
		});

		it("shows individual session templates for supplier-manager role", () => {
			(modal as unknown as { selectedRole: string }).selectedRole = "supplier-manager";
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Supplier Review");
			expect(text).toContain("Monthly KPI Review");
			expect(text).toContain("Procurement Planning");
		});

		it("hides session templates for user role", () => {
			(modal as unknown as { selectedRole: string }).selectedRole = "user";
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).not.toContain("Supplier Review");
			expect(text).not.toContain("Monthly KPI Review");
		});

		it("shows folder names from config", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("00 - Connectivity");
			expect(text).toContain("03 - Resources");
		});
	});

	describe("visual polish", () => {
		it("welcome page has a hero icon element", () => {
			const heroIcon = modal.contentEl.querySelector(".ft-wizard-hero-icon");
			expect(heroIcon).toBeTruthy();
		});

		it("review page card headers use setIcon instead of emoji", () => {
			goToPage("review");
			const iconElements = modal.contentEl.querySelectorAll(".ft-icon-muted");
			// Folder, Sample Content, Dashboard = 3 setIcon calls
			expect(iconElements.length).toBeGreaterThanOrEqual(3);
		});

		it("welcome page uses setIcon for role card icons", () => {
			const roleIcons = modal.contentEl.querySelectorAll(".ft-role-icon");
			expect(roleIcons.length).toBe(3); // 3 role options
		});

		it("selected role card has ft-card-selected class on welcome page", () => {
			const selectedCards = modal.contentEl.querySelectorAll(".ft-card-selected");
			expect(selectedCards.length).toBe(1);
		});
	});

	describe("review page polish", () => {
		it("shows user icon in identity row", () => {
			goToPage("review");
			const identityRow = modal.contentEl.querySelector(".ft-review-identity");
			expect(identityRow).toBeTruthy();
			expect(identityRow!.querySelector(".ft-icon-muted")).toBeTruthy();
		});

		it("shows role badge for selected role", () => {
			goToPage("review");
			const badge = modal.contentEl.querySelector(".ft-role-badge");
			expect(badge).toBeTruthy();
			expect(badge!.textContent).toBe("User");
		});

		it("shows supplier-manager role badge when selected", () => {
			(modal as unknown as { selectedRole: string }).selectedRole = "supplier-manager";
			goToPage("review");
			const badge = modal.contentEl.querySelector(".ft-role-badge");
			expect(badge!.textContent).toBe("Supplier Manager");
		});
	});

	describe("complete page tips adapt to preferences", () => {
		type ModalInternals = {
			currentPage: string;
			installSuccess: boolean;
			installError: string;
			includeSampleContent: boolean;
			stepStatuses: Array<{ id: string; name: string; status: string; message?: string }>;
			renderPage: () => void;
		};

		function goToCompletePageWithPrefs(includeSamples: boolean): void {
			const m = modal as unknown as ModalInternals;
			m.stepStatuses = [
				{ id: "user-creation", name: "Create User Profile", status: "completed" },
				{ id: "folder-scaffold", name: "Scaffold Folders", status: "completed" },
				{ id: "seed-content", name: "Seed Content", status: includeSamples ? "completed" : "skipped" },
			];
			m.installSuccess = true;
			m.installError = "";
			m.includeSampleContent = includeSamples;
			m.currentPage = "complete";
			m.renderPage();
		}

		it("shows dashboard tip when samples included", () => {
			goToCompletePageWithPrefs(true);
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("dashboard");
		});

		it("omits dashboard and sample tips when samples skipped", () => {
			goToCompletePageWithPrefs(false);
			const text = modal.contentEl.textContent ?? "";
			expect(text).not.toContain("pre-built dashboard");
			expect(text).not.toContain("sample data");
		});

		it("shows 2 tips when samples skipped", () => {
			goToCompletePageWithPrefs(false);
			const tipIcons = modal.contentEl.querySelectorAll(".ft-tip-icon");
			expect(tipIcons.length).toBe(2);
		});
	});

	describe("enriched content and dashboard sections", () => {
		it("shows CSV description in sample content", () => {
			goToPage("review");
			expect(modal.contentEl.textContent).toContain("Supplier overview CSV");
		});

		it("shows welcome note in sample content", () => {
			goToPage("review");
			expect(modal.contentEl.textContent).toContain("Welcome note");
		});

		it("shows CSV row and column counts", () => {
			goToPage("review");
			expect(modal.contentEl.textContent).toContain("48 rows, 10 columns");
		});

		it("lists 5 dashboard tiles by name", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Total Spend");
			expect(text).toContain("Avg Quality Score");
			expect(text).toContain("Avg On-Time Delivery");
			expect(text).toContain("Monthly Spend Trend");
			expect(text).toContain("Supplier Breakdown");
		});

		it("shows 2 query names in dashboard section", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Supplier Overview - By Supplier");
			expect(text).toContain("Supplier Trend - Monthly Spend");
		});
	});

	describe("expandable folder tree", () => {
		it("shows all top-level folders", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("00 - Connectivity");
			expect(text).toContain("01 - Projects");
			expect(text).toContain("02 - Areas");
			expect(text).toContain("03 - Resources");
			expect(text).toContain("04 - Archive");
			expect(text).toContain("var");
		});

		it("shows total folder count in header", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Folder Structure");
			expect(text).toContain("25 folders");
		});

		it("shows child count badges on expandable folders", () => {
			goToPage("review");
			const badges = Array.from(modal.contentEl.querySelectorAll(".ft-badge"));
			// 00 - Connectivity has 5 children, 03 - Resources has many, var has children
			expect(badges.length).toBeGreaterThan(0);
		});

		it("expands children when clicking a folder row", () => {
			goToPage("review");
			// Find the Connectivity toggle (first expandable row)
			const arrows = modal.contentEl.querySelectorAll(".ft-folder-arrow");
			expect(arrows.length).toBeGreaterThan(0);

			// Children are hidden by default
			const childLists = modal.contentEl.querySelectorAll(".ft-folder-children");
			expect((childLists[0] as HTMLElement).classList.contains("ft-folder-children-hidden")).toBe(true);

			// Click the toggle
			(arrows[0].parentElement as HTMLElement).click();
			expect((childLists[0] as HTMLElement).classList.contains("ft-folder-children-hidden")).toBe(false);

			// Arrow should change to down
			expect(arrows[0].textContent).toBe("\u25BE");
		});
	});

	describe("step progress indicator", () => {
		function getStepLabels(): string[] {
			return Array.from(modal.contentEl.querySelectorAll(".ft-wizard-step"))
				.map((el) => el.querySelector(".ft-text-xs")?.textContent ?? "");
		}

		function getActiveStepLabel(): string | undefined {
			const steps = modal.contentEl.querySelectorAll(".ft-wizard-step");
			for (const step of Array.from(steps)) {
				const label = step.querySelector(".ft-text-xs") as HTMLElement | null;
				if (label?.classList.contains("ft-wizard-step-label-active")) return label.textContent ?? undefined;
			}
			return undefined;
		}

		it("renders all 4 step labels on welcome page", () => {
			expect(getStepLabels()).toEqual(["Welcome", "Review", "Install", "Done"]);
		});

		it("marks Welcome as active on welcome page", () => {
			expect(getActiveStepLabel()).toBe("Welcome");
		});

		it("marks Review as active and Welcome as completed on review page", () => {
			goToPage("review");
			expect(getActiveStepLabel()).toBe("Review");
			// Welcome circle should show checkmark
			const circles = Array.from(modal.contentEl.querySelectorAll(".ft-wizard-circle"));
			expect(circles[0].textContent).toBe("\u2713");
		});
	});

	describe("complete page enhancement", () => {
		type ModalInternals = {
			currentPage: string;
			installSuccess: boolean;
			installError: string;
			stepStatuses: Array<{ id: string; name: string; status: string; message?: string }>;
			renderPage: () => void;
		};

		function goToCompletePage(success: boolean): void {
			const m = modal as unknown as ModalInternals;
			m.stepStatuses = [
				{ id: "user-creation", name: "Create User Profile", status: "completed" },
				{ id: "folder-scaffold", name: "Scaffold Folders", status: "completed" },
				{ id: "seed-content", name: "Seed Content", status: success ? "completed" : "failed", message: success ? undefined : "Write error" },
			];
			m.installSuccess = success;
			m.installError = success ? "" : "Write error";
			m.currentPage = "complete";
			m.renderPage();
		}

		it("shows hero icon on success", () => {
			goToCompletePage(true);
			expect(modal.contentEl.querySelector(".ft-complete-hero")).toBeTruthy();
		});

		it("uses setIcon for step status indicators in summary", () => {
			goToCompletePage(true);
			const statusIcons = modal.contentEl.querySelectorAll(".ft-step-status-icon");
			expect(statusIcons.length).toBe(3);
		});

		it("shows icons on next steps tips", () => {
			goToCompletePage(true);
			const tipIcons = modal.contentEl.querySelectorAll(".ft-tip-icon");
			expect(tipIcons.length).toBe(4); // 4 tips
		});

		it("shows alert icon on error state", () => {
			goToCompletePage(false);
			expect(modal.contentEl.querySelector(".ft-complete-hero")).toBeTruthy();
			expect(modal.contentEl.textContent).toContain("Setup failed");
		});
	});

	describe("sample content preference toggle", () => {
		it("renders a toggle on the review page", () => {
			goToPage("review");
			const settings = modal.contentEl.querySelectorAll(".setting-item");
			expect(settings.length).toBeGreaterThan(0);
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Include sample data");
		});

		it("shows full sample content and dashboard when toggle is on (default)", () => {
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Supplier overview CSV");
			expect(text).toContain("Pre-Built Dashboard");
		});

		it("hides sample content details when toggle is off", () => {
			(modal as unknown as { includeSampleContent: boolean }).includeSampleContent = false;
			goToPage("review");
			const text = modal.contentEl.textContent ?? "";
			expect(text).toContain("Sample data will not be installed");
			expect(text).not.toContain("Supplier overview CSV");
		});

		it("hides dashboard card when toggle is off", () => {
			(modal as unknown as { includeSampleContent: boolean }).includeSampleContent = false;
			goToPage("review");
			const headings = getHeadingTexts();
			expect(headings).not.toContain("Pre-Built Dashboard");
		});
	});

	describe("keyboard navigation", () => {
		it("Escape on welcome page closes the modal", () => {
			const closeSpy = vi.spyOn(modal, "close");
			fireKey("Escape");
			expect(closeSpy).toHaveBeenCalled();
		});

		it("Enter on welcome page advances to review", () => {
			fireKey("Enter");
			expect(getHeadingTexts().some((t) => t.includes("Folder Structure"))).toBe(true);
		});

		it("Escape on review page goes back to welcome", () => {
			goToPage("review");
			fireKey("Escape");
			expect(getHeadingTexts("h2")[0]).toContain("Welcome");
		});
	});
});
