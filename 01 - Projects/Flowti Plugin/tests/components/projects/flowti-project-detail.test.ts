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

	it("renders project name", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Flowti CLI");
	});

	it("renders 5 tab buttons when a project is selected", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const tabs = shadow.querySelectorAll(".tab-btn");
		expect(tabs.length).toBe(5);
		const labels = Array.from(tabs).map((t) => t.textContent?.trim());
		expect(labels).toEqual(["Overview", "Components", "Event Catalog", "Reporting", "Config"]);
	});

	it("renders flowti-tab-overview on overview tab by default", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const overview = shadow.querySelector("flowti-tab-overview");
		expect(overview).not.toBeNull();
	});

	it("renders flowti-tab-config when config tab is active", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.activeTab = "config";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const configTab = shadow.querySelector("flowti-tab-config");
		expect(configTab).not.toBeNull();
		expect(shadow.querySelector("flowti-tab-overview")).toBeNull();
	});

	it("renders flowti-tab-components when components tab is active", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.activeTab = "components";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-tab-components")).not.toBeNull();
		expect(shadow.querySelector("flowti-tab-overview")).toBeNull();
	});

	it("renders flowti-tab-event-catalog when catalog tab is active", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.activeTab = "catalog";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-tab-event-catalog")).not.toBeNull();
	});

	it("renders flowti-tab-reporting when reporting tab is active", async () => {
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.activeTab = "reporting";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-tab-reporting")).not.toBeNull();
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

	it("passes storybook properties to components tab", async () => {
		const sb = { installed: true, framework: "react", running: true, url: "http://localhost:6006", pid: 1234, hasStaticBuild: false };
		el.projectName = "Flowti CLI";
		el.projectType = "cli";
		el.storybook = sb;
		el.activeTab = "components";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const child = el.shadowRoot!.querySelector("flowti-tab-components") as HTMLElement & Record<string, unknown>;
		expect(child).not.toBeNull();
		expect(child.storybookInstalled).toBe(true);
		expect(child.storybookFramework).toBe("react");
		expect(child.storybookRunning).toBe(true);
		expect(child.storybookUrl).toBe("http://localhost:6006");
	});
});
