// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionOutputPickerModal } from "../../../src/ui/session/SessionOutputPickerModal";
import type { SessionOutputTemplate } from "../../../src/domain/session/types";
import { BUILT_IN_OUTPUT_TEMPLATES } from "../../../src/domain/session/helpers";

// Minimal app stub — Modal only needs app.scope for hotkeys
const mockApp = { scope: {} } as never;

describe("SessionOutputPickerModal", () => {
	it("renders all 3 built-in template cards", () => {
		const onSelect = vi.fn();
		const modal = new SessionOutputPickerModal(mockApp, { onSelect });
		modal.onOpen();

		const cards = modal.contentEl.querySelectorAll(".ft-output-picker-card");
		expect(cards.length).toBe(3);
		expect(cards[0].textContent).toContain("Meeting Invite");
		expect(cards[1].textContent).toContain("Action Items");
		expect(cards[2].textContent).toContain("Review Summary");
	});

	it("renders custom templates alongside built-in", () => {
		const custom: SessionOutputTemplate = {
			type: "custom",
			title: "Sprint Retro",
			description: "Sprint retrospective summary",
			sections: [{ heading: "Summary", placeholder: "{{overview}}" }],
		};
		const onSelect = vi.fn();
		const modal = new SessionOutputPickerModal(mockApp, { customTemplates: [custom], onSelect });
		modal.onOpen();

		const cards = modal.contentEl.querySelectorAll(".ft-output-picker-card");
		expect(cards.length).toBe(4); // 3 built-in + 1 custom
		expect(cards[3].textContent).toContain("Sprint Retro");
	});

	it("calls onSelect with the clicked template and closes", () => {
		const onSelect = vi.fn();
		const modal = new SessionOutputPickerModal(mockApp, { onSelect });
		const closeSpy = vi.spyOn(modal, "close");
		modal.onOpen();

		const cards = modal.contentEl.querySelectorAll(".ft-output-picker-card");
		(cards[0] as HTMLElement).click();

		expect(onSelect).toHaveBeenCalledWith(BUILT_IN_OUTPUT_TEMPLATES[0]);
		expect(closeSpy).toHaveBeenCalled();
	});

	it("shows title and description for each card", () => {
		const onSelect = vi.fn();
		const modal = new SessionOutputPickerModal(mockApp, { onSelect });
		modal.onOpen();

		const cards = modal.contentEl.querySelectorAll(".ft-output-picker-card");
		// Review Summary card
		expect(cards[2].textContent).toContain("Review Summary");
		expect(cards[2].textContent).toContain("Complete session review with all details");
	});

	it("shows type badge on each card", () => {
		const onSelect = vi.fn();
		const modal = new SessionOutputPickerModal(mockApp, { onSelect });
		modal.onOpen();

		const badges = modal.contentEl.querySelectorAll(".ft-badge");
		expect(badges.length).toBe(3);
		expect(badges[0].textContent).toBe("meeting-invite");
		expect(badges[1].textContent).toBe("action-items");
		expect(badges[2].textContent).toBe("review-summary");
	});
});
