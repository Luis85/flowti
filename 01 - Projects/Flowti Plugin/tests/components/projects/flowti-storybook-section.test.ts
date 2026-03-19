// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/projects/flowti-storybook-section.js";

type LitEl = HTMLElement & Record<string, unknown> & { updateComplete: Promise<boolean> };

describe("flowti-storybook-section", () => {
	let el: LitEl;

	beforeEach(() => {
		el = document.createElement("flowti-storybook-section") as LitEl;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-storybook-section")).toBeDefined();
	});

	it("renders setup description when installed=false", async () => {
		el.installed = false;
		await el.updateComplete;
		const text = el.shadowRoot!.textContent;
		expect(text).toContain("Select a framework to initialize");
	});

	it("shows 6 framework buttons when not installed", async () => {
		el.installed = false;
		await el.updateComplete;
		const buttons = el.shadowRoot!.querySelectorAll(".framework-btn");
		expect(buttons.length).toBe(6);
		const labels = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(labels).toContain("HTML");
		expect(labels).toContain("React");
		expect(labels).toContain("Vue");
		expect(labels).toContain("Angular");
		expect(labels).toContain("Web Components");
		expect(labels).toContain("Svelte");
	});

	it("dispatches storybook-install with framework on button click", async () => {
		el.installed = false;
		await el.updateComplete;
		let detail: unknown = null;
		el.addEventListener("storybook-install", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector(".framework-btn") as HTMLButtonElement;
		btn.click();
		expect(detail).toEqual({ framework: "html" });
	});

	it("shows Start/Build/Open/Regenerate buttons when installed but not running", async () => {
		el.installed = true;
		el.running = false;
		el.framework = "react";
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		const buttons = shadow.querySelectorAll(".action-btn");
		const labels = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(labels).toContain("Start");
		expect(labels).toContain("Build");
		expect(labels).toContain("Open folder");
		expect(labels).toContain("Regenerate");
	});

	it("badge and dot are rendered by parent, not by this component", async () => {
		el.installed = true;
		el.running = false;
		el.framework = "react";
		await el.updateComplete;
		const badge = el.shadowRoot!.querySelector(".framework-badge");
		expect(badge).toBeNull();
	});

	it("shows URL when running", async () => {
		el.installed = true;
		el.running = true;
		el.url = "http://localhost:6006";
		el.pid = 1234;
		el.framework = "react";
		await el.updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("http://localhost:6006");
	});

	it("shows View/Stop/Build buttons when running", async () => {
		el.installed = true;
		el.running = true;
		el.url = "http://localhost:6006";
		el.pid = 1234;
		el.framework = "react";
		await el.updateComplete;
		const buttons = el.shadowRoot!.querySelectorAll(".action-btn");
		const labels = Array.from(buttons).map((b) => b.textContent?.trim());
		expect(labels).toContain("View");
		expect(labels).toContain("Stop");
		expect(labels).toContain("Build");
	});

	it("dispatches storybook-start on Start click", async () => {
		el.installed = true;
		el.running = false;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-start", () => { fired = true; });
		const btn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Start") as HTMLButtonElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("dispatches storybook-stop on Stop click", async () => {
		el.installed = true;
		el.running = true;
		el.url = "http://localhost:6006";
		el.pid = 1234;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-stop", () => { fired = true; });
		const btn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Stop") as HTMLButtonElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("dispatches storybook-build on Build click (installed state)", async () => {
		el.installed = true;
		el.running = false;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-build", () => { fired = true; });
		const btn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Build") as HTMLButtonElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("dispatches storybook-regenerate-confirmed after confirm", async () => {
		el.installed = true;
		el.running = false;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-regenerate-confirmed", () => { fired = true; });
		// Click "Regenerate" to show confirm dialog
		const regenBtn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Regenerate") as HTMLButtonElement;
		regenBtn.click();
		await el.updateComplete;
		// Click "Confirm" in the confirm row
		const confirmBtn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Confirm") as HTMLButtonElement;
		confirmBtn.click();
		expect(fired).toBe(true);
	});

	it("dispatches storybook-open-folder on Open folder click", async () => {
		el.installed = true;
		el.running = false;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-open-folder", () => { fired = true; });
		const btn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Open folder") as HTMLButtonElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("dispatches storybook-view on View click", async () => {
		el.installed = true;
		el.running = true;
		el.url = "http://localhost:6006";
		el.pid = 1234;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-view", () => { fired = true; });
		const btn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "View") as HTMLButtonElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("dispatches storybook-build on Build click (running state)", async () => {
		el.installed = true;
		el.running = true;
		el.url = "http://localhost:6006";
		el.pid = 1234;
		el.framework = "react";
		await el.updateComplete;
		let fired = false;
		el.addEventListener("storybook-build", () => { fired = true; });
		const btn = Array.from(el.shadowRoot!.querySelectorAll(".action-btn"))
			.find((b) => b.textContent?.trim() === "Build") as HTMLButtonElement;
		btn.click();
		expect(fired).toBe(true);
	});
});
