// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/analytics/flowti-analytics-tile";

describe("flowti-analytics-tile", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-analytics-tile") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-analytics-tile")).toBeDefined();
	});

	it("renders stat card variant with value and label", async () => {
		el.tileType = "stat";
		el.title = "Total Revenue";
		el.data = { value: "$12,500", label: "Revenue" };
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".tile")).not.toBeNull();
		expect(shadow.textContent).toContain("Total Revenue");
		expect(shadow.textContent).toContain("$12,500");
	});

	it("renders table variant with columns and rows", async () => {
		el.tileType = "table";
		el.title = "Sales Data";
		el.data = {
			columns: ["Product", "Amount"],
			rows: [
				{ Product: "Widget", Amount: 100 },
				{ Product: "Gadget", Amount: 200 },
			],
		};
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".tile")).not.toBeNull();
		expect(shadow.textContent).toContain("Sales Data");
		const thCells = shadow.querySelectorAll("th");
		expect(thCells.length).toBe(2);
		expect(thCells[0].textContent).toContain("Product");
		expect(thCells[1].textContent).toContain("Amount");
		const tdCells = shadow.querySelectorAll("td");
		expect(tdCells.length).toBe(4);
	});

	it("renders chart variant with placeholder", async () => {
		el.tileType = "chart";
		el.title = "Revenue Trend";
		el.data = {
			columns: ["Month", "Revenue"],
			rows: [
				{ Month: "Jan", Revenue: 1000 },
				{ Month: "Feb", Revenue: 1500 },
			],
		};
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.querySelector(".tile")).not.toBeNull();
		expect(shadow.textContent).toContain("Revenue Trend");
		expect(shadow.querySelector(".tile-chart")).not.toBeNull();
	});

	it("renders empty state when no data provided", async () => {
		el.tileType = "stat";
		el.title = "Empty Tile";
		el.data = null;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No data");
	});

	it("applies config to rendering", async () => {
		el.tileType = "stat";
		el.title = "Configured Tile";
		el.data = { value: "42", label: "Count" };
		el.config = { color: "success" };
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const tile = shadow.querySelector(".tile");
		expect(tile).not.toBeNull();
		expect(tile!.classList.contains("tile--success")).toBe(true);
	});
});
