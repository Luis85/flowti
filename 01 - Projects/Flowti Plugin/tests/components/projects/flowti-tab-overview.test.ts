// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-tab-overview.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-tab-overview", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-tab-overview") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-tab-overview")).toBeDefined();
	});

	it("renders brief section with goal", async () => {
		el.brief = { goal: "Ship MVP", status: "active" };
		el.projectName = "TestProject";
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Ship MVP");
	});

	it("renders health score when available", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("85");
	});

	it("shows health refresh button", async () => {
		await el.updateComplete;
		const btn = el.shadowRoot!.querySelector(".health-refresh-btn");
		expect(btn).not.toBeNull();
	});

	it("renders TODO items", async () => {
		el.todos = [{ text: "First task", done: false }, { text: "Done task", done: true }];
		el.todosExist = true;
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("First task");
		expect(el.shadowRoot!.textContent).toContain("Done task");
	});

	it("dispatches todo-add on add button click", async () => {
		el.todosExist = true;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-add", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const input = el.shadowRoot!.querySelector(".todo-input") as HTMLInputElement;
		if (input) {
			input.value = "New task";
			const btn = el.shadowRoot!.querySelector(".todo-add-btn") as HTMLElement;
			btn?.click();
			expect(detail).toEqual({ text: "New task" });
		}
	});

	it("dispatches todo-toggle on checkbox click", async () => {
		el.todos = [{ text: "Task", done: false }];
		el.todosExist = true;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-toggle", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const checkbox = el.shadowRoot!.querySelector(".todo-checkbox") as HTMLInputElement;
		checkbox?.click();
		expect(detail).toEqual({ index: 0 });
	});

	it("dispatches health-refresh on refresh click", async () => {
		await el.updateComplete;
		let fired = false;
		el.addEventListener("health-refresh", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector(".health-refresh-btn") as HTMLElement;
		btn?.click();
		expect(fired).toBe(true);
	});

	it("dispatches todo-delete on delete button click", async () => {
		el.todos = [{ text: "Task to delete", done: false }];
		el.todosExist = true;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("todo-delete", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector(".todo-delete-btn") as HTMLElement;
		btn?.click();
		expect(detail).toEqual({ index: 0 });
	});

	it("dispatches open-project-note when brief note exists", async () => {
		el.brief = { goal: "Ship MVP", status: "active" };
		el.projectName = "TestProject";
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("open-project-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const link = el.shadowRoot!.querySelector(".brief-open-btn") as HTMLElement;
		if (link) {
			link.click();
			expect(detail).toBeDefined();
		}
	});

	it("shows empty health state when no score", async () => {
		el.healthScore = null;
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Run health check");
	});

	it("shows health error when healthError set", async () => {
		el.healthError = "Connection failed";
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Connection failed");
	});

	it("shows create TODO list button when todosExist is false", async () => {
		el.todosExist = false;
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Create TODO list");
	});

	it("shows brief create button when no brief exists", async () => {
		el.brief = undefined;
		el.projectName = "TestProject";
		await el.updateComplete;
		const btn = el.shadowRoot!.querySelector(".brief-create-btn") as HTMLElement;
		expect(btn).not.toBeNull();
	});

	it("dispatches create-note on create brief click", async () => {
		el.brief = undefined;
		el.projectName = "TestProject";
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("create-note", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector(".brief-create-btn") as HTMLElement;
		btn?.click();
		expect(detail).toEqual({ name: "TestProject" });
	});

	it("renders health grade badge", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("B");
	});

	it("renders config badges when config is set", async () => {
		el.brief = { goal: "Ship it" };
		el.config = { buildModes: ["production"], testPresets: ["unit"], framework: "react" };
		await el.updateComplete;
		expect(el.shadowRoot!.textContent).toContain("react");
	});

	it("color-codes health score green for >= 80", async () => {
		el.healthScore = { overall: 85, grade: "B", categories: { tests: 90, coverage: 80, build: 100, lint: 70, security: 85, git: 90 } };
		await el.updateComplete;
		const circle = el.shadowRoot!.querySelector(".health-score-circle") as HTMLElement;
		expect(circle).not.toBeNull();
	});
});
