import { describe, it, expect } from "vitest";
import { setProps } from "../../../src/infrastructure/handlers/handler-utils";

describe("setProps", () => {
	it("sets properties on an element", () => {
		const el = {} as Record<string, unknown>;
		setProps(el as unknown as HTMLElement, { foo: "bar", count: 42 });
		expect(el.foo).toBe("bar");
		expect(el.count).toBe(42);
	});

	it("handles empty props", () => {
		const el = {} as Record<string, unknown>;
		setProps(el as unknown as HTMLElement, {});
		expect(Object.keys(el)).toHaveLength(0);
	});
});
