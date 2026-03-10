import { describe, it, expect } from "vitest";
import { generateEventTypes, eventNameToInterfaceName } from "../../../src/domain/events/event-codegen.js";
import type { EventContract } from "../../../src/domain/events/event-contracts.js";

const makeContract = (overrides: Partial<EventContract> = {}): EventContract => ({
	name: "user.created",
	domain: "user",
	version: "1.0.0",
	description: "Emitted when a user is created",
	producers: ["UserService"],
	consumers: ["NotificationService"],
	payload: [
		{ field: "id", type: "string", required: true, description: "User ID" },
		{ field: "email", type: "string", required: true, description: "Email address" },
		{ field: "age", type: "number", required: false, description: "User age" },
	],
	...overrides,
});

describe("eventNameToInterfaceName", () => {
	it("converts dotted names to PascalCase + Payload", () => {
		expect(eventNameToInterfaceName("user.created")).toBe("UserCreatedPayload");
	});

	it("converts hyphenated names", () => {
		expect(eventNameToInterfaceName("data-exchange.item-imported")).toBe("DataExchangeItemImportedPayload");
	});

	it("converts underscore names", () => {
		expect(eventNameToInterfaceName("session_started")).toBe("SessionStartedPayload");
	});

	it("handles single-word names", () => {
		expect(eventNameToInterfaceName("ping")).toBe("PingPayload");
	});
});

describe("generateEventTypes", () => {
	it("returns comment for empty contracts", () => {
		const result = generateEventTypes([]);
		expect(result).toContain("No event contracts found");
	});

	it("generates interface with typed fields", () => {
		const result = generateEventTypes([makeContract()]);
		expect(result).toContain("export interface UserCreatedPayload");
		expect(result).toContain("id: string;");
		expect(result).toContain("email: string;");
		expect(result).toContain("age?: number;");
	});

	it("generates JSDoc from description", () => {
		const result = generateEventTypes([makeContract()]);
		expect(result).toContain("/** Emitted when a user is created */");
		expect(result).toContain("/** User ID */");
	});

	it("marks optional fields with ?", () => {
		const result = generateEventTypes([makeContract()]);
		// required field: no ?
		expect(result).toMatch(/\tid: string;/);
		// optional field: has ?
		expect(result).toMatch(/\tage\?: number;/);
	});

	it("maps object type to Record<string, unknown>", () => {
		const result = generateEventTypes([makeContract({
			payload: [{ field: "data", type: "object", required: true, description: "" }],
		})]);
		expect(result).toContain("data: Record<string, unknown>;");
	});

	it("maps array type to unknown[]", () => {
		const result = generateEventTypes([makeContract({
			payload: [{ field: "items", type: "array", required: true, description: "" }],
		})]);
		expect(result).toContain("items: unknown[];");
	});

	it("maps Date type to string | Date", () => {
		const result = generateEventTypes([makeContract({
			payload: [{ field: "created", type: "Date", required: true, description: "" }],
		})]);
		expect(result).toContain("created: string | Date;");
	});

	it("passes PascalCase custom types through", () => {
		const result = generateEventTypes([makeContract({
			payload: [{ field: "config", type: "DashboardConfig", required: true, description: "" }],
		})]);
		expect(result).toContain("config: DashboardConfig;");
	});

	it("generates EventPayloadMap type", () => {
		const result = generateEventTypes([
			makeContract(),
			makeContract({ name: "user.deleted", description: "User deleted" }),
		]);
		expect(result).toContain("export interface EventPayloadMap");
		expect(result).toContain('"user.created": UserCreatedPayload;');
		expect(result).toContain('"user.deleted": UserDeletedPayload;');
	});

	it("includes DO NOT EDIT header", () => {
		const result = generateEventTypes([makeContract()]);
		expect(result).toContain("DO NOT EDIT");
		expect(result).toContain("events:codegen");
	});
});
