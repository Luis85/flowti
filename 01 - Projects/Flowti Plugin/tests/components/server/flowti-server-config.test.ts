// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import "../../../src/components/server/flowti-server-config.js";
import { fixture, cleanup, shadowQuery } from "../test-utils.js";
import type { ServerConfig } from "../../../src/domain/server/types.js";

interface ServerConfigEl extends HTMLElement {
	config: ServerConfig;
	updateComplete: Promise<boolean>;
}

function makeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
	return { port: 4000, logLevel: "info", autoConnect: false, ...overrides };
}

describe("flowti-server-config", () => {
	afterEach(() => cleanup());

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-server-config")).toBeDefined();
	});

	it("renders all form fields", async () => {
		const el = await fixture<ServerConfigEl>("flowti-server-config", {
			config: makeConfig(),
		});

		const portInput = shadowQuery<HTMLInputElement>(el, 'input[type="number"]');
		const selectInput = shadowQuery<HTMLSelectElement>(el, "select");
		const checkboxInput = shadowQuery<HTMLInputElement>(el, 'input[type="checkbox"]');

		expect(portInput).not.toBeNull();
		expect(selectInput).not.toBeNull();
		expect(checkboxInput).not.toBeNull();
	});

	it("shows initial config values", async () => {
		const el = await fixture<ServerConfigEl>("flowti-server-config", {
			config: makeConfig({ port: 8080, logLevel: "warn", autoConnect: true }),
		});

		const portInput = shadowQuery<HTMLInputElement>(el, 'input[type="number"]');
		const selectInput = shadowQuery<HTMLSelectElement>(el, "select");
		const checkboxInput = shadowQuery<HTMLInputElement>(el, 'input[type="checkbox"]');

		expect(portInput!.value).toBe("8080");
		expect(selectInput!.value).toBe("warn");
		expect(checkboxInput!.checked).toBe(true);
	});

	it("has apply button disabled when form is clean", async () => {
		const el = await fixture<ServerConfigEl>("flowti-server-config", {
			config: makeConfig(),
		});

		const button = shadowQuery<HTMLButtonElement>(el, "button");
		expect(button).not.toBeNull();
		expect(button!.disabled).toBe(true);
	});

	it("enables apply button when form is dirty", async () => {
		const el = await fixture<ServerConfigEl>("flowti-server-config", {
			config: makeConfig({ port: 4000 }),
		});

		const portInput = shadowQuery<HTMLInputElement>(el, 'input[type="number"]');
		portInput!.value = "9999";
		portInput!.dispatchEvent(new Event("input", { bubbles: true }));
		await el.updateComplete;

		const button = shadowQuery<HTMLButtonElement>(el, "button");
		expect(button!.disabled).toBe(false);
	});

	it("dispatches config-apply with current values on button click", async () => {
		const el = await fixture<ServerConfigEl>("flowti-server-config", {
			config: makeConfig({ port: 4000, logLevel: "info", autoConnect: false }),
		});

		// Make it dirty first
		const portInput = shadowQuery<HTMLInputElement>(el, 'input[type="number"]');
		portInput!.value = "5555";
		portInput!.dispatchEvent(new Event("input", { bubbles: true }));
		await el.updateComplete;

		let detail: Record<string, unknown> | null = null;
		el.addEventListener("config-apply", ((e: CustomEvent) => {
			detail = e.detail as Record<string, unknown>;
		}) as EventListener);

		const button = shadowQuery<HTMLButtonElement>(el, "button");
		button!.click();

		expect(detail).not.toBeNull();
		expect(detail!.port).toBe(5555);
		expect(detail!.logLevel).toBe("info");
		expect(detail!.autoConnect).toBe(false);
	});

	it("tracks select changes as dirty", async () => {
		const el = await fixture<ServerConfigEl>("flowti-server-config", {
			config: makeConfig({ logLevel: "info" }),
		});

		const selectInput = shadowQuery<HTMLSelectElement>(el, "select");
		selectInput!.value = "error";
		selectInput!.dispatchEvent(new Event("change", { bubbles: true }));
		await el.updateComplete;

		const button = shadowQuery<HTMLButtonElement>(el, "button");
		expect(button!.disabled).toBe(false);
	});
});
