// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { SessionTemplateModal, type SessionTemplateModalOptions } from "../../../src/ui/session/SessionTemplateModal";
import type { SessionTemplate } from "../../../src/domain/session/types";
import { App } from "obsidian";

// ── Helpers ──────────────────────────────────────────────

function makeTemplate(overrides: Partial<SessionTemplate> = {}): SessionTemplate {
	return {
		id: "tpl-1",
		name: "My Template",
		type: "documentation",
		durationMinutes: 25,
		description: "A test template",
		createdAt: Date.now(),
		...overrides,
	} as SessionTemplate;
}

function createModal(overrides: Partial<SessionTemplateModalOptions> = {}): { modal: SessionTemplateModal; onSubmit: ReturnType<typeof vi.fn> } {
	const onSubmit = vi.fn();
	const opts: SessionTemplateModalOptions = {
		template: makeTemplate(),
		onSubmit,
		...overrides,
	};
	const modal = new SessionTemplateModal(new App(), opts);
	return { modal, onSubmit };
}

function findButton(el: HTMLElement, text: string): HTMLButtonElement | undefined {
	return Array.from(el.querySelectorAll("button")).find((b) => b.textContent === text);
}

// ── Tests ────────────────────────────────────────────────

describe("SessionTemplateModal", () => {
	describe("rendering", () => {
		it("renders h3 title", () => {
			const { modal } = createModal();
			modal.onOpen();
			const h3 = modal.contentEl.querySelector("h3");
			expect(h3?.textContent).toBe("Edit template");
		});

		it("renders Name, Type, Duration, and Description settings", () => {
			const { modal } = createModal();
			modal.onOpen();
			const names = Array.from(modal.contentEl.querySelectorAll(".setting-item-name")).map((n) => n.textContent);
			expect(names).toContain("Name");
			expect(names).toContain("Type");
			expect(names).toContain("Duration (minutes)");
			expect(names).toContain("Description");
		});

		it("has Cancel and Save changes buttons", () => {
			const { modal } = createModal();
			modal.onOpen();
			expect(findButton(modal.contentEl, "Cancel")).toBeDefined();
			expect(findButton(modal.contentEl, "Save changes")).toBeDefined();
		});

		it("pre-fills fields from template", () => {
			const template = makeTemplate({ name: "Sprint Plan", durationMinutes: 45, description: "Plan the sprint" });
			const { modal } = createModal({ template });
			modal.onOpen();
			const inputs = Array.from(modal.contentEl.querySelectorAll("input"));
			const nameInput = inputs.find((i) => i.value === "Sprint Plan");
			const durationInput = inputs.find((i) => i.value === "45");
			expect(nameInput).toBeDefined();
			expect(durationInput).toBeDefined();
		});
	});

	describe("submit", () => {
		it("calls onSubmit with current values on Save", () => {
			const { modal, onSubmit } = createModal();
			modal.onOpen();
			findButton(modal.contentEl, "Save changes")?.click();
			expect(onSubmit).toHaveBeenCalledWith({
				name: "My Template",
				type: "documentation",
				durationMinutes: 25,
				description: "A test template",
			});
		});

		it("does not call onSubmit when name is empty", () => {
			const template = makeTemplate({ name: "" });
			const { modal, onSubmit } = createModal({ template });
			modal.onOpen();
			findButton(modal.contentEl, "Save changes")?.click();
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("does not call onSubmit when name is whitespace-only", () => {
			const template = makeTemplate({ name: "   " });
			const { modal, onSubmit } = createModal({ template });
			modal.onOpen();
			findButton(modal.contentEl, "Save changes")?.click();
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});

	describe("cleanup", () => {
		it("onClose empties contentEl", () => {
			const { modal } = createModal();
			modal.onOpen();
			expect(modal.contentEl.children.length).toBeGreaterThan(0);
			modal.onClose();
			expect(modal.contentEl.innerHTML).toBe("");
		});
	});
});
