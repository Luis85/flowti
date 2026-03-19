// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-project-detail.js";

describe("flowti-project-detail", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-project-detail") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-project-detail")).toBeDefined();
	});

	it("renders project name and type", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Flowti CLI");
		expect(shadow.textContent).toContain("cli");
	});

	it("shows create note button when hasNote is false", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.hasNote = false;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const btn = shadow.querySelector(".note-create") as HTMLElement;
		expect(btn).not.toBeNull();
		expect(btn.textContent).toContain("Create brief");
	});

	it("shows open note link when hasNote is true", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.hasNote = true;
		el.notePath = "01 - Projects/Flowti CLI.md";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const link = shadow.querySelector(".note-link") as HTMLElement;
		expect(link).not.toBeNull();
		expect(link.textContent).toContain("Open brief");
	});

	it("dispatches back-to-list on back button click", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let fired = false;
		el.addEventListener("back-to-list", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector(".back-btn") as HTMLElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("dispatches open-project-note with path", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.hasNote = true;
		el.notePath = "01 - Projects/Flowti CLI.md";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("open-project-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const link = el.shadowRoot!.querySelector(".note-link") as HTMLElement;
		link.click();
		expect(detail).toEqual({ path: "01 - Projects/Flowti CLI.md" });
	});

	it("dispatches create-project-note with name", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.hasNote = false;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("create-project-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector(".note-create") as HTMLElement;
		btn.click();
		expect(detail).toEqual({ name: "Flowti CLI" });
	});

	it("composes flowti-storybook-section child", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.storybook = { installed: true, framework: "react", running: false, url: null, pid: null };
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const child = el.shadowRoot!.querySelector("flowti-storybook-section");
		expect(child).not.toBeNull();
	});

	it("passes storybook status to child", async () => {
		const sb = { installed: true, framework: "react", running: true, url: "http://localhost:6006", pid: 1234 };
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.storybook = sb;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const child = el.shadowRoot!.querySelector("flowti-storybook-section") as HTMLElement & Record<string, unknown>;
		expect(child).not.toBeNull();
		expect((child as unknown as Record<string, unknown>).installed).toBe(true);
		expect((child as unknown as Record<string, unknown>).framework).toBe("react");
		expect((child as unknown as Record<string, unknown>).running).toBe(true);
		expect((child as unknown as Record<string, unknown>).url).toBe("http://localhost:6006");
		expect((child as unknown as Record<string, unknown>).pid).toBe(1234);
	});
});
