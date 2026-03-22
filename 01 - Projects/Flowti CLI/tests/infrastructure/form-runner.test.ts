import { describe, it, expect, vi } from "vitest";
import { runForm, validateForm } from "../../src/infrastructure/form-runner.js";
import type { FormRunnerDeps, FormData } from "../../src/infrastructure/form-runner.js";
import type { FormField, ValidationRule } from "../../src/domain/sitemap/unified-page.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeDeps(answers: string[] = [], yesNoAnswers: boolean[] = []): FormRunnerDeps {
	let askIdx = 0;
	let ynIdx = 0;
	return {
		input: {
			ask: vi.fn(async () => answers[askIdx++] ?? ""),
			askAbortable: vi.fn((q: string) => ({ promise: Promise.resolve(q), abort: () => {} })),
			askYesNo: vi.fn(async () => yesNoAnswers[ynIdx++] ?? false),
			waitForEnter: vi.fn(async () => {}),
		},
		log: vi.fn(),
	};
}

function textField(overrides: Partial<FormField> = {}): FormField {
	return { name: "field1", label: "Field 1", type: "text", ...overrides };
}

function numberField(overrides: Partial<FormField> = {}): FormField {
	return { name: "amount", label: "Amount", type: "number", ...overrides };
}

function selectField(overrides: Partial<FormField> = {}): FormField {
	return {
		name: "choice",
		label: "Choice",
		type: "select",
		options: [
			{ value: "a", label: "Option A" },
			{ value: "b", label: "Option B" },
			{ value: "c", label: "Option C" },
		],
		...overrides,
	};
}

function booleanField(overrides: Partial<FormField> = {}): FormField {
	return { name: "agree", label: "Do you agree?", type: "checkbox", ...overrides };
}

// ── Text fields ─────────────────────────────────────────────────────

describe("form-runner", () => {
	describe("runForm — text fields", () => {
		it("collects a required text field", async () => {
			const deps = makeDeps(["hello"]);
			const result = await runForm([textField({ required: true })], undefined, deps);
			expect(result).toEqual({ field1: "hello" });
		});

		it("returns null when required text field is left empty", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([textField({ required: true })], undefined, deps);
			expect(result).toBeNull();
		});

		it("accepts empty input for optional text field and falls back to empty string", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([textField()], undefined, deps);
			expect(result).toEqual({ field1: "" });
		});

		it("uses defaultValue when input is empty and default is set", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([textField({ defaultValue: "fallback" })], undefined, deps);
			expect(result).toEqual({ field1: "fallback" });
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1", "fallback");
		});

		it("passes user input over defaultValue", async () => {
			const deps = makeDeps(["override"]);
			const result = await runForm([textField({ defaultValue: "fallback" })], undefined, deps);
			expect(result).toEqual({ field1: "override" });
		});

		it("rejects input that does not match pattern on required field", async () => {
			const deps = makeDeps(["bad-input"]);
			const result = await runForm([textField({ pattern: "^\\d+$", required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Invalid format for Field 1.");
		});

		it("skips optional field when pattern does not match", async () => {
			const deps = makeDeps(["bad-input"]);
			const result = await runForm([textField({ pattern: "^\\d+$" })], undefined, deps);
			expect(result).toEqual({});
			expect(deps.log).toHaveBeenCalledWith("  Invalid format for Field 1.");
		});

		it("accepts input that matches pattern", async () => {
			const deps = makeDeps(["12345"]);
			const result = await runForm([textField({ pattern: "^\\d+$" })], undefined, deps);
			expect(result).toEqual({ field1: "12345" });
		});

		it("rejects input shorter than minLength on required field", async () => {
			const deps = makeDeps(["ab"]);
			const result = await runForm([textField({ minLength: 3, required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Field 1 must be at least 3 characters.");
		});

		it("skips optional field when input is shorter than minLength", async () => {
			const deps = makeDeps(["ab"]);
			const result = await runForm([textField({ minLength: 3 })], undefined, deps);
			expect(result).toEqual({});
		});

		it("accepts input at exactly minLength", async () => {
			const deps = makeDeps(["abc"]);
			const result = await runForm([textField({ minLength: 3 })], undefined, deps);
			expect(result).toEqual({ field1: "abc" });
		});

		it("rejects input longer than maxLength on required field", async () => {
			const deps = makeDeps(["toolong"]);
			const result = await runForm([textField({ maxLength: 3, required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Field 1 must be at most 3 characters.");
		});

		it("skips optional field when input exceeds maxLength", async () => {
			const deps = makeDeps(["toolong"]);
			const result = await runForm([textField({ maxLength: 3 })], undefined, deps);
			expect(result).toEqual({});
		});

		it("accepts input at exactly maxLength", async () => {
			const deps = makeDeps(["abc"]);
			const result = await runForm([textField({ maxLength: 3 })], undefined, deps);
			expect(result).toEqual({ field1: "abc" });
		});

		it("adds date hint for date field type", async () => {
			const deps = makeDeps(["2026-01-01"]);
			await runForm([textField({ type: "date" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (YYYY-MM-DD)", undefined);
		});

		it("adds email hint for email field type", async () => {
			const deps = makeDeps(["a@b.com"]);
			await runForm([textField({ type: "email" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (email)", undefined);
		});

		it("adds URL hint for url field type", async () => {
			const deps = makeDeps(["https://x.com"]);
			await runForm([textField({ type: "url" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (URL)", undefined);
		});

		it("adds phone hint for tel field type", async () => {
			const deps = makeDeps(["555-1234"]);
			await runForm([textField({ type: "tel" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (phone)", undefined);
		});

		it("adds time hint for time field type", async () => {
			const deps = makeDeps(["14:30"]);
			await runForm([textField({ type: "time" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (HH:mm)", undefined);
		});

		it("adds datetime-local hint for datetime-local field type", async () => {
			const deps = makeDeps(["2026-01-01T14:30"]);
			await runForm([textField({ type: "datetime-local" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (YYYY-MM-DDTHH:mm)", undefined);
		});

		it("uses placeholder as hint when no special type hint applies", async () => {
			const deps = makeDeps(["val"]);
			await runForm([textField({ placeholder: "enter name" })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Field 1 (enter name)", undefined);
		});

		it("skips pattern validation when input is empty (optional field)", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([textField({ pattern: "^\\d+$", defaultValue: "000" })], undefined, deps);
			expect(result).toEqual({ field1: "000" });
		});
	});

	// ── Number fields ───────────────────────────────────────────────────

	describe("runForm — number fields", () => {
		it("collects a valid number", async () => {
			const deps = makeDeps(["42"]);
			const result = await runForm([numberField()], undefined, deps);
			expect(result).toEqual({ amount: 42 });
		});

		it("parses floating-point numbers", async () => {
			const deps = makeDeps(["3.14"]);
			const result = await runForm([numberField()], undefined, deps);
			expect(result).toEqual({ amount: 3.14 });
		});

		it("returns null when required number field is left empty", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([numberField({ required: true })], undefined, deps);
			expect(result).toBeNull();
		});

		it("returns defaultValue as number when optional field is left empty", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([numberField({ defaultValue: 10 })], undefined, deps);
			expect(result).toEqual({ amount: 10 });
		});

		it("returns null for optional field with no default and empty input", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([numberField()], undefined, deps);
			// promptNumber returns null → field is skipped (value not set)
			expect(result).toEqual({});
		});

		it("rejects NaN input on required field", async () => {
			const deps = makeDeps(["abc"]);
			const result = await runForm([numberField({ required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Amount must be a number.");
		});

		it("skips optional field on NaN input", async () => {
			const deps = makeDeps(["abc"]);
			const result = await runForm([numberField()], undefined, deps);
			expect(result).toEqual({});
			expect(deps.log).toHaveBeenCalledWith("  Amount must be a number.");
		});

		it("rejects number below min on required field", async () => {
			const deps = makeDeps(["3"]);
			const result = await runForm([numberField({ min: 5, required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Amount must be at least 5.");
		});

		it("skips optional field when number is below min", async () => {
			const deps = makeDeps(["3"]);
			const result = await runForm([numberField({ min: 5 })], undefined, deps);
			expect(result).toEqual({});
		});

		it("accepts number at exactly min", async () => {
			const deps = makeDeps(["5"]);
			const result = await runForm([numberField({ min: 5 })], undefined, deps);
			expect(result).toEqual({ amount: 5 });
		});

		it("rejects number above max on required field", async () => {
			const deps = makeDeps(["100"]);
			const result = await runForm([numberField({ max: 50, required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Amount must be at most 50.");
		});

		it("skips optional field when number exceeds max", async () => {
			const deps = makeDeps(["100"]);
			const result = await runForm([numberField({ max: 50 })], undefined, deps);
			expect(result).toEqual({});
		});

		it("accepts number at exactly max", async () => {
			const deps = makeDeps(["50"]);
			const result = await runForm([numberField({ max: 50 })], undefined, deps);
			expect(result).toEqual({ amount: 50 });
		});

		it("handles range field type same as number", async () => {
			const deps = makeDeps(["7"]);
			const result = await runForm([numberField({ type: "range" })], undefined, deps);
			expect(result).toEqual({ amount: 7 });
		});

		it("passes defaultValue as string to ask", async () => {
			const deps = makeDeps(["25"]);
			await runForm([numberField({ defaultValue: 10 })], undefined, deps);
			expect(deps.input.ask).toHaveBeenCalledWith("Amount", "10");
		});
	});

	// ── Select fields ───────────────────────────────────────────────────

	describe("runForm — select fields", () => {
		it("collects a valid selection by number", async () => {
			const deps = makeDeps(["2"]);
			const result = await runForm([selectField()], undefined, deps);
			expect(result).toEqual({ choice: "b" });
		});

		it("selects first option by default when no defaultValue", async () => {
			const deps = makeDeps(["1"]);
			const result = await runForm([selectField()], undefined, deps);
			expect(result).toEqual({ choice: "a" });
		});

		it("uses defaultValue to compute the default index", async () => {
			const deps = makeDeps(["2"]);
			await runForm([selectField({ defaultValue: "b" })], undefined, deps);
			// Default index for "b" is 2 (1-based)
			expect(deps.input.ask).toHaveBeenCalledWith("Select", "2");
		});

		it("rejects invalid selection (out of range) on required field", async () => {
			const deps = makeDeps(["99"]);
			const result = await runForm([selectField({ required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Invalid selection.");
		});

		it("skips optional field on invalid selection (out of range)", async () => {
			const deps = makeDeps(["99"]);
			const result = await runForm([selectField()], undefined, deps);
			expect(result).toEqual({});
			expect(deps.log).toHaveBeenCalledWith("  Invalid selection.");
		});

		it("rejects selection of 0 on required field", async () => {
			const deps = makeDeps(["0"]);
			const result = await runForm([selectField({ required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Invalid selection.");
		});

		it("rejects non-numeric selection on required field", async () => {
			const deps = makeDeps(["xyz"]);
			const result = await runForm([selectField({ required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Invalid selection.");
		});

		it("returns null when no options are available on required field", async () => {
			const deps = makeDeps([]);
			const result = await runForm([selectField({ options: [], required: true })], undefined, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  No options available for Choice.");
		});

		it("skips optional field when no options are available", async () => {
			const deps = makeDeps([]);
			const result = await runForm([selectField({ options: [] })], undefined, deps);
			expect(result).toEqual({});
			expect(deps.log).toHaveBeenCalledWith("  No options available for Choice.");
		});

		it("returns null when options is undefined on required field", async () => {
			const deps = makeDeps([]);
			const result = await runForm([{ name: "choice", label: "Choice", type: "select" as const, required: true }], undefined, deps);
			expect(result).toBeNull();
		});

		it("skips optional field when options is undefined", async () => {
			const deps = makeDeps([]);
			const result = await runForm([{ name: "choice", label: "Choice", type: "select" as const }], undefined, deps);
			expect(result).toEqual({});
		});

		it("filters out disabled options", async () => {
			const deps = makeDeps(["1"]);
			const field = selectField({
				options: [
					{ value: "a", label: "Option A", disabled: true },
					{ value: "b", label: "Option B" },
					{ value: "c", label: "Option C" },
				],
			});
			const result = await runForm([field], undefined, deps);
			// "a" is disabled, so index 1 maps to "b"
			expect(result).toEqual({ choice: "b" });
		});

		it("returns null when required select field is left empty", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([selectField({ required: true })], undefined, deps);
			// empty input → idx = NaN → invalid selection → null
			// But since default is "1", ask returns "" which gets parsed
			expect(result).toBeNull();
		});

		it("handles radio type same as select", async () => {
			const deps = makeDeps(["1"]);
			const result = await runForm([selectField({ type: "radio" })], undefined, deps);
			expect(result).toEqual({ choice: "a" });
		});

		it("displays option labels with default marker", async () => {
			const deps = makeDeps(["1"]);
			await runForm([selectField({ defaultValue: "b" })], undefined, deps);
			// Check that log was called with the default marker
			const logCalls = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
			expect(logCalls).toContainEqual("    2. Option B (default)");
		});
	});

	// ── Boolean fields ──────────────────────────────────────────────────

	describe("runForm — boolean fields", () => {
		it("collects true from askYesNo", async () => {
			const deps = makeDeps([], [true]);
			const result = await runForm([booleanField()], undefined, deps);
			expect(result).toEqual({ agree: true });
		});

		it("collects false from askYesNo", async () => {
			const deps = makeDeps([], [false]);
			const result = await runForm([booleanField()], undefined, deps);
			expect(result).toEqual({ agree: false });
		});

		it("passes defaultNo=true when defaultValue is undefined", async () => {
			const deps = makeDeps([], [false]);
			await runForm([booleanField()], undefined, deps);
			expect(deps.input.askYesNo).toHaveBeenCalledWith("Do you agree?", true);
		});

		it("passes defaultNo=true when defaultValue is false", async () => {
			const deps = makeDeps([], [false]);
			await runForm([booleanField({ defaultValue: false })], undefined, deps);
			expect(deps.input.askYesNo).toHaveBeenCalledWith("Do you agree?", true);
		});

		it("passes defaultNo=false when defaultValue is true", async () => {
			const deps = makeDeps([], [true]);
			await runForm([booleanField({ defaultValue: true })], undefined, deps);
			expect(deps.input.askYesNo).toHaveBeenCalledWith("Do you agree?", false);
		});

		it("handles toggle type same as checkbox", async () => {
			const deps = makeDeps([], [true]);
			const result = await runForm([booleanField({ type: "toggle" })], undefined, deps);
			expect(result).toEqual({ agree: true });
		});
	});

	// ── Hidden fields ───────────────────────────────────────────────────

	describe("runForm — hidden fields", () => {
		it("uses defaultValue without prompting", async () => {
			const deps = makeDeps();
			const field: FormField = { name: "token", label: "Token", type: "hidden", defaultValue: "secret123" };
			const result = await runForm([field], undefined, deps);
			expect(result).toEqual({ token: "secret123" });
			expect(deps.input.ask).not.toHaveBeenCalled();
		});

		it("uses empty string when hidden field has no defaultValue", async () => {
			const deps = makeDeps();
			const field: FormField = { name: "token", label: "Token", type: "hidden" };
			const result = await runForm([field], undefined, deps);
			expect(result).toEqual({ token: "" });
		});
	});

	// ── Mixed field forms ───────────────────────────────────────────────

	describe("runForm — mixed field forms", () => {
		it("collects multiple field types in sequence", async () => {
			const fields: FormField[] = [
				textField({ name: "name", label: "Name" }),
				numberField({ name: "age", label: "Age" }),
				booleanField({ name: "active", label: "Active?" }),
				{ name: "id", label: "ID", type: "hidden", defaultValue: "auto-001" },
			];
			const deps = makeDeps(["Alice", "30"], [true]);
			const result = await runForm(fields, undefined, deps);
			expect(result).toEqual({
				name: "Alice",
				age: 30,
				active: true,
				id: "auto-001",
			});
		});

		it("stops and returns null when a required field in the middle is cancelled", async () => {
			const fields: FormField[] = [
				textField({ name: "first", label: "First" }),
				textField({ name: "second", label: "Second", required: true }),
				textField({ name: "third", label: "Third" }),
			];
			const deps = makeDeps(["hello", ""]);
			const result = await runForm(fields, undefined, deps);
			expect(result).toBeNull();
			// Third field should not be prompted
			expect(deps.input.ask).toHaveBeenCalledTimes(2);
		});

		it("skips optional field that returns null without cancelling form", async () => {
			const fields: FormField[] = [
				textField({ name: "first", label: "First" }),
				numberField({ name: "second", label: "Second" }),
				textField({ name: "third", label: "Third" }),
			];
			// "first" = "val", "second" = "abc" (NaN → null, optional → continue/skip), "third" = "end"
			const deps = makeDeps(["val", "abc", "end"]);
			const result = await runForm(fields, undefined, deps);
			// NaN on non-required field → promptNumber returns null → field skipped
			expect(result).toEqual({ first: "val", third: "end" });
		});

		it("collects text + select + boolean form", async () => {
			const fields: FormField[] = [
				textField({ name: "title", label: "Title" }),
				selectField({ name: "priority", label: "Priority" }),
				booleanField({ name: "confirm", label: "Confirm?" }),
			];
			const deps = makeDeps(["My Task", "2"], [true]);
			const result = await runForm(fields, undefined, deps);
			expect(result).toEqual({
				title: "My Task",
				priority: "b",
				confirm: true,
			});
		});
	});

	// ── Cancellation ────────────────────────────────────────────────────

	describe("runForm — cancellation", () => {
		it("returns null when a required text field is left empty", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([textField({ required: true })], undefined, deps);
			expect(result).toBeNull();
		});

		it("returns null when a required number field is left empty", async () => {
			const deps = makeDeps([""]);
			const result = await runForm([numberField({ required: true })], undefined, deps);
			expect(result).toBeNull();
		});

		it("returns null when a required select has no options", async () => {
			const deps = makeDeps([]);
			const result = await runForm([selectField({ required: true, options: [] })], undefined, deps);
			expect(result).toBeNull();
		});

		it("does not cancel when optional text field returns null due to pattern failure", async () => {
			const fields: FormField[] = [
				textField({ name: "code", label: "Code", pattern: "^[A-Z]+$" }),
				textField({ name: "name", label: "Name" }),
			];
			const deps = makeDeps(["123", "hello"]);
			const result = await runForm(fields, undefined, deps);
			// pattern fail on optional field → null → continue (skip field)
			expect(result).toEqual({ name: "hello" });
		});
	});

	// ── validateForm ────────────────────────────────────────────────────

	describe("validateForm", () => {
		it("returns error for required rule when value is undefined", () => {
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name is required" },
			];
			const errors = validateForm({}, rules);
			expect(errors).toEqual(["Name is required"]);
		});

		it("returns error for required rule when value is null", () => {
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name is required" },
			];
			const errors = validateForm({ name: null }, rules);
			expect(errors).toEqual(["Name is required"]);
		});

		it("returns error for required rule when value is empty string", () => {
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name is required" },
			];
			const errors = validateForm({ name: "" }, rules);
			expect(errors).toEqual(["Name is required"]);
		});

		it("passes required rule when value is present", () => {
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name is required" },
			];
			const errors = validateForm({ name: "Alice" }, rules);
			expect(errors).toEqual([]);
		});

		it("returns error for min rule when value is below minimum", () => {
			const rules: ValidationRule[] = [
				{ field: "age", rule: "min", value: 18, message: "Must be 18+" },
			];
			const errors = validateForm({ age: 10 }, rules);
			expect(errors).toEqual(["Must be 18+"]);
		});

		it("passes min rule when value equals minimum", () => {
			const rules: ValidationRule[] = [
				{ field: "age", rule: "min", value: 18, message: "Must be 18+" },
			];
			const errors = validateForm({ age: 18 }, rules);
			expect(errors).toEqual([]);
		});

		it("passes min rule when value is not a number", () => {
			const rules: ValidationRule[] = [
				{ field: "age", rule: "min", value: 18, message: "Must be 18+" },
			];
			const errors = validateForm({ age: "hello" }, rules);
			expect(errors).toEqual([]);
		});

		it("returns error for max rule when value exceeds maximum", () => {
			const rules: ValidationRule[] = [
				{ field: "score", rule: "max", value: 100, message: "Max is 100" },
			];
			const errors = validateForm({ score: 150 }, rules);
			expect(errors).toEqual(["Max is 100"]);
		});

		it("passes max rule when value equals maximum", () => {
			const rules: ValidationRule[] = [
				{ field: "score", rule: "max", value: 100, message: "Max is 100" },
			];
			const errors = validateForm({ score: 100 }, rules);
			expect(errors).toEqual([]);
		});

		it("returns error for minLength rule when string is too short", () => {
			const rules: ValidationRule[] = [
				{ field: "pwd", rule: "minLength", value: 8, message: "Too short" },
			];
			const errors = validateForm({ pwd: "abc" }, rules);
			expect(errors).toEqual(["Too short"]);
		});

		it("passes minLength rule when string meets minimum", () => {
			const rules: ValidationRule[] = [
				{ field: "pwd", rule: "minLength", value: 3, message: "Too short" },
			];
			const errors = validateForm({ pwd: "abc" }, rules);
			expect(errors).toEqual([]);
		});

		it("passes minLength rule when value is not a string", () => {
			const rules: ValidationRule[] = [
				{ field: "pwd", rule: "minLength", value: 3, message: "Too short" },
			];
			const errors = validateForm({ pwd: 42 }, rules);
			expect(errors).toEqual([]);
		});

		it("returns error for maxLength rule when string is too long", () => {
			const rules: ValidationRule[] = [
				{ field: "code", rule: "maxLength", value: 5, message: "Too long" },
			];
			const errors = validateForm({ code: "abcdef" }, rules);
			expect(errors).toEqual(["Too long"]);
		});

		it("passes maxLength rule when string meets maximum", () => {
			const rules: ValidationRule[] = [
				{ field: "code", rule: "maxLength", value: 5, message: "Too long" },
			];
			const errors = validateForm({ code: "abcde" }, rules);
			expect(errors).toEqual([]);
		});

		it("returns error for pattern rule when string does not match", () => {
			const rules: ValidationRule[] = [
				{ field: "email", rule: "pattern", value: "^.+@.+\\..+$", message: "Invalid email" },
			];
			const errors = validateForm({ email: "not-an-email" }, rules);
			expect(errors).toEqual(["Invalid email"]);
		});

		it("passes pattern rule when string matches", () => {
			const rules: ValidationRule[] = [
				{ field: "email", rule: "pattern", value: "^.+@.+\\..+$", message: "Invalid email" },
			];
			const errors = validateForm({ email: "a@b.com" }, rules);
			expect(errors).toEqual([]);
		});

		it("passes pattern rule when value is not a string", () => {
			const rules: ValidationRule[] = [
				{ field: "email", rule: "pattern", value: "^.+$", message: "Invalid" },
			];
			const errors = validateForm({ email: 42 }, rules);
			expect(errors).toEqual([]);
		});

		it("ignores custom rule (no-op)", () => {
			const rules: ValidationRule[] = [
				{ field: "x", rule: "custom", message: "Custom fail" },
			];
			const errors = validateForm({ x: "anything" }, rules);
			expect(errors).toEqual([]);
		});

		it("collects multiple errors from different rules", () => {
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name required" },
				{ field: "age", rule: "min", value: 18, message: "Too young" },
				{ field: "code", rule: "maxLength", value: 3, message: "Code too long" },
			];
			const errors = validateForm({ age: 10, code: "ABCDE" }, rules);
			expect(errors).toEqual(["Name required", "Too young", "Code too long"]);
		});

		it("returns no errors when all rules pass", () => {
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name required" },
				{ field: "age", rule: "min", value: 0, message: "Too young" },
				{ field: "age", rule: "max", value: 150, message: "Too old" },
			];
			const errors = validateForm({ name: "Alice", age: 30 }, rules);
			expect(errors).toEqual([]);
		});

		it("skips min/max/minLength/maxLength/pattern when value is undefined", () => {
			const rules: ValidationRule[] = [
				{ field: "x", rule: "min", value: 0, message: "min fail" },
				{ field: "x", rule: "max", value: 100, message: "max fail" },
				{ field: "x", rule: "minLength", value: 1, message: "minLen fail" },
				{ field: "x", rule: "maxLength", value: 10, message: "maxLen fail" },
				{ field: "x", rule: "pattern", value: ".*", message: "pattern fail" },
			];
			const errors = validateForm({}, rules);
			expect(errors).toEqual([]);
		});
	});

	// ── Form-level validation ───────────────────────────────────────────

	describe("runForm — form-level validation failure returns null", () => {
		it("returns null when validation rules fail after collecting all fields", async () => {
			const fields: FormField[] = [
				textField({ name: "name", label: "Name" }),
			];
			const rules: ValidationRule[] = [
				{ field: "name", rule: "minLength", value: 10, message: "Name too short" },
			];
			const deps = makeDeps(["hi"]);
			const result = await runForm(fields, rules, deps);
			expect(result).toBeNull();
			expect(deps.log).toHaveBeenCalledWith("  Name too short");
		});

		it("returns data when all validation rules pass", async () => {
			const fields: FormField[] = [
				textField({ name: "name", label: "Name" }),
			];
			const rules: ValidationRule[] = [
				{ field: "name", rule: "required", message: "Name required" },
			];
			const deps = makeDeps(["Alice"]);
			const result = await runForm(fields, rules, deps);
			expect(result).toEqual({ name: "Alice" });
		});

		it("logs all validation errors before returning null", async () => {
			const fields: FormField[] = [
				textField({ name: "a", label: "A" }),
				textField({ name: "b", label: "B" }),
			];
			const rules: ValidationRule[] = [
				{ field: "a", rule: "minLength", value: 100, message: "A too short" },
				{ field: "b", rule: "required", message: "B required" },
			];
			const deps = makeDeps(["hi", ""]);
			const result = await runForm(fields, rules, deps);
			expect(result).toBeNull();
			const logCalls = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
			expect(logCalls).toContain("  A too short");
			expect(logCalls).toContain("  B required");
		});

		it("skips validation when validation array is undefined", async () => {
			const deps = makeDeps(["val"]);
			const result = await runForm([textField()], undefined, deps);
			expect(result).toEqual({ field1: "val" });
		});

		it("passes when validation array is empty", async () => {
			const deps = makeDeps(["val"]);
			const result = await runForm([textField()], [], deps);
			expect(result).toEqual({ field1: "val" });
		});
	});
});
