import { describe, it, expect, vi } from "vitest";
import { runInputFlow, createInputFlowHandler } from "../../src/infrastructure/input-flow.js";
import type { InputField } from "../../src/infrastructure/input-flow.js";
import type { IInput } from "../../src/infrastructure/types.js";

function mockInput(answers: string[]): IInput {
	let idx = 0;
	return {
		ask: vi.fn(async () => answers[idx++] ?? ""),
		askYesNo: vi.fn(async () => answers[idx++] === "yes"),
		waitForEnter: vi.fn(),
	};
}

describe("runInputFlow", () => {
	it("collects text fields", async () => {
		const fields: InputField[] = [
			{ type: "text", name: "name", label: "Name" },
			{ type: "text", name: "domain", label: "Domain", default: "core" },
		];
		const inp = mockInput(["my-event", "billing"]);

		const result = await runInputFlow(fields, inp);

		expect(result.submitted).toBe(true);
		expect(result.values.name).toBe("my-event");
		expect(result.values.domain).toBe("billing");
	});

	it("cancels when required text field is empty", async () => {
		const fields: InputField[] = [
			{ type: "text", name: "name", label: "Name", required: true },
		];
		const inp = mockInput([""]);

		const result = await runInputFlow(fields, inp);

		expect(result.submitted).toBe(false);
		expect(result.values).toEqual({});
	});

	it("collects boolean fields", async () => {
		const fields: InputField[] = [
			{ type: "boolean", name: "public", label: "Public?" },
		];
		const inp = mockInput(["yes"]);

		const result = await runInputFlow(fields, inp);

		expect(result.submitted).toBe(true);
		expect(result.values.public).toBe(true);
	});

	it("collects select fields", async () => {
		const fields: InputField[] = [
			{
				type: "select", name: "framework", label: "Framework",
				options: [
					{ key: "1", label: "HTML", value: "html" },
					{ key: "2", label: "Angular", value: "angular" },
				],
			},
		];
		const inp = mockInput(["2"]);

		const result = await runInputFlow(fields, inp);

		expect(result.submitted).toBe(true);
		expect(result.values.framework).toBe("angular");
	});

	it("uses default for select when choice doesn't match", async () => {
		const fields: InputField[] = [
			{
				type: "select", name: "fw", label: "FW",
				options: [
					{ key: "1", label: "A", value: "a" },
					{ key: "2", label: "B", value: "b" },
				],
			},
		];
		const inp = mockInput(["9"]);

		const result = await runInputFlow(fields, inp);

		expect(result.submitted).toBe(true);
		expect(result.values.fw).toBe("a"); // fallback to first option
	});

	it("allows empty non-required text fields", async () => {
		const fields: InputField[] = [
			{ type: "text", name: "desc", label: "Description" },
		];
		const inp = mockInput([""]);

		const result = await runInputFlow(fields, inp);

		expect(result.submitted).toBe(true);
		expect(result.values.desc).toBe("");
	});
});

describe("createInputFlowHandler", () => {
	it("calls onSubmit with collected values", async () => {
		const onSubmit = vi.fn();
		const handler = createInputFlowHandler(
			[{ type: "text", name: "name", label: "Name", required: true }],
			onSubmit,
		);
		const inp = mockInput(["test"]);

		const result = await handler(inp);

		expect(result).toBe(true);
		expect(onSubmit).toHaveBeenCalledWith({ name: "test" });
	});

	it("returns false when cancelled", async () => {
		const onSubmit = vi.fn();
		const handler = createInputFlowHandler(
			[{ type: "text", name: "name", label: "Name", required: true }],
			onSubmit,
		);
		const inp = mockInput([""]);

		const result = await handler(inp);

		expect(result).toBe(false);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
