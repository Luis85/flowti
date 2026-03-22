import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
	printHeader: vi.fn(),
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

const mockFiles: Record<string, string> = {};

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (p: string) => {
			const norm = p.replace(/\\/g, "/");
			// Check if any file starts with this path (directory check)
			for (const key of Object.keys(mockFiles)) {
				const normKey = key.replace(/\\/g, "/");
				if (normKey === norm || normKey.startsWith(norm + "/")) return true;
			}
			return false;
		},
		readdirSync: (p: string) => {
			const norm = p.replace(/\\/g, "/").replace(/\/$/, "");
			const files: string[] = [];
			for (const key of Object.keys(mockFiles)) {
				const normKey = key.replace(/\\/g, "/");
				if (normKey.startsWith(norm + "/")) {
					const rest = normKey.slice(norm.length + 1);
					if (!rest.includes("/")) files.push(rest);
				}
			}
			return files;
		},
		readFileSync: (p: string) => {
			const norm = p.replace(/\\/g, "/");
			for (const [key, value] of Object.entries(mockFiles)) {
				if (key.replace(/\\/g, "/") === norm) return value;
			}
			throw new Error(`File not found: ${p}`);
		},
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

import {
	parsePayloadTable,
	parseEventContract,
	loadEventContracts,
	validateContracts,
	generateContractsJson,
	isValidType,
	validatePayload,
	findContract,
} from "../../../src/domain/events/event-contracts.js";
import type {
	EventContract,
	PayloadField,
} from "../../../src/domain/events/event-contracts.js";
import { disk } from "../../../src/infrastructure/filesystem.js";

const contractDeps = { paths: { join: (...parts: string[]) => parts.join("/"), resolve: (...parts: string[]) => parts.join("/"), dirname: (p: string) => p, basename: (p: string) => p.split("/").pop() ?? p, relative: (_f: string, t: string) => t, extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; }, isAbsolute: (p: string) => p.startsWith("/"), sep: "/" as const } };

beforeEach(() => {
	for (const key of Object.keys(mockFiles)) delete mockFiles[key];
});

// ── parsePayloadTable ──────────────────────────────────────────────

describe("parsePayloadTable", () => {
	it("parses a well-formed payload table", () => {
		const content = [
			"## Payload",
			"",
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| userId | string | yes | The user ID |",
			"| count | number | no | Item count |",
			"| active | boolean | yes | Whether active |",
		].join("\n");

		const fields = parsePayloadTable(content);

		expect(fields).toHaveLength(3);
		expect(fields[0]).toEqual({ field: "userId", type: "string", required: true, description: "The user ID" });
		expect(fields[1]).toEqual({ field: "count", type: "number", required: false, description: "Item count" });
		expect(fields[2]).toEqual({ field: "active", type: "boolean", required: true, description: "Whether active" });
	});

	it("returns empty array when no table is present", () => {
		const content = "# Event\n\nSome description without a table.\n";
		expect(parsePayloadTable(content)).toEqual([]);
	});

	it("returns empty array for empty content", () => {
		expect(parsePayloadTable("")).toEqual([]);
	});

	it("handles table with extra whitespace in cells", () => {
		const content = [
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"|  name  |  string  |  yes  |  The name  |",
		].join("\n");

		const fields = parsePayloadTable(content);
		expect(fields).toHaveLength(1);
		expect(fields[0]).toEqual({ field: "name", type: "string", required: true, description: "The name" });
	});

	it("handles 'required' and 'true' as truthy values", () => {
		const content = [
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| a | string | required | A |",
			"| b | string | true | B |",
			"| c | string | no | C |",
			"| d | string | false | D |",
		].join("\n");

		const fields = parsePayloadTable(content);
		expect(fields[0].required).toBe(true);
		expect(fields[1].required).toBe(true);
		expect(fields[2].required).toBe(false);
		expect(fields[3].required).toBe(false);
	});

	it("stops parsing at end of table", () => {
		const content = [
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| name | string | yes | The name |",
			"",
			"## Next Section",
			"Some text that is not a table.",
		].join("\n");

		const fields = parsePayloadTable(content);
		expect(fields).toHaveLength(1);
	});

	it("skips rows with too few columns", () => {
		const content = [
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| name | string |",
			"| email | string | yes | User email |",
		].join("\n");

		const fields = parsePayloadTable(content);
		expect(fields).toHaveLength(1);
		expect(fields[0].field).toBe("email");
	});

	it("defaults type to string when empty", () => {
		const content = [
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| name |  | yes | The name |",
		].join("\n");

		const fields = parsePayloadTable(content);
		expect(fields[0].type).toBe("string");
	});
});

// ── parseEventContract ─────────────────────────────────────────────

describe("parseEventContract", () => {
	it("parses a complete event file", () => {
		const content = [
			"---",
			"name: user.created",
			"domain: user",
			"version: 1.0.0",
			"description: Emitted when a new user is created",
			"producers: UserService, AuthService",
			"consumers: NotificationService",
			"---",
			"",
			"# user.created",
			"",
			"## Payload",
			"",
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| userId | string | yes | The user ID |",
			"| email | string | yes | User email |",
		].join("\n");

		const contract = parseEventContract("user-created", content);

		expect(contract.name).toBe("user.created");
		expect(contract.domain).toBe("user");
		expect(contract.version).toBe("1.0.0");
		expect(contract.description).toBe("Emitted when a new user is created");
		expect(contract.producers).toEqual(["UserService", "AuthService"]);
		expect(contract.consumers).toEqual(["NotificationService"]);
		expect(contract.payload).toHaveLength(2);
	});

	it("uses filename as fallback for missing name", () => {
		const content = [
			"---",
			"domain: core",
			"version: 2.0.0",
			"---",
			"",
			"# Some Event",
		].join("\n");

		const contract = parseEventContract("some-event", content);
		expect(contract.name).toBe("some-event");
		expect(contract.domain).toBe("core");
		expect(contract.version).toBe("2.0.0");
	});

	it("handles missing frontmatter fields with defaults", () => {
		const content = "# My Event\n\nNo frontmatter here.\n";
		const contract = parseEventContract("my-event", content);

		expect(contract.name).toBe("my-event");
		expect(contract.domain).toBe("");
		expect(contract.version).toBe("1.0.0");
		expect(contract.producers).toEqual([]);
		expect(contract.consumers).toEqual([]);
		expect(contract.payload).toEqual([]);
	});

	it("handles empty producers and consumers", () => {
		const content = [
			"---",
			"name: test.event",
			"domain: test",
			"producers: ",
			"consumers: ",
			"---",
		].join("\n");

		const contract = parseEventContract("test-event", content);
		expect(contract.producers).toEqual([]);
		expect(contract.consumers).toEqual([]);
	});
});

// ── isValidType ────────────────────────────────────────────────────

describe("isValidType", () => {
	it("accepts built-in types", () => {
		expect(isValidType("string")).toBe(true);
		expect(isValidType("number")).toBe(true);
		expect(isValidType("boolean")).toBe(true);
		expect(isValidType("object")).toBe(true);
		expect(isValidType("array")).toBe(true);
		expect(isValidType("Date")).toBe(true);
	});

	it("accepts PascalCase custom types", () => {
		expect(isValidType("UserId")).toBe(true);
		expect(isValidType("EventPayload")).toBe(true);
		expect(isValidType("X")).toBe(true);
	});

	it("rejects invalid types", () => {
		expect(isValidType("")).toBe(false);
		expect(isValidType("my-type")).toBe(false);
		expect(isValidType("camelCase")).toBe(false);
		expect(isValidType("snake_case")).toBe(false);
		expect(isValidType("123")).toBe(false);
	});
});

// ── validateContracts ──────────────────────────────────────────────

describe("validateContracts", () => {
	function makeContract(overrides: Partial<EventContract> = {}): EventContract {
		return {
			name: "test.event",
			domain: "test",
			version: "1.0.0",
			description: "A test event",
			producers: ["ServiceA"],
			consumers: ["ServiceB"],
			payload: [
				{ field: "id", type: "string", required: true, description: "The ID" },
			],
			...overrides,
		};
	}

	it("returns valid for well-formed contracts", () => {
		const result = validateContracts([makeContract()]);
		expect(result.valid).toBe(true);
		expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
	});

	it("reports error for missing domain", () => {
		const result = validateContracts([makeContract({ domain: "" })]);
		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({
			event: "test.event",
			severity: "error",
			message: "Event is missing a domain.",
		}));
	});

	it("reports error for duplicate field names", () => {
		const result = validateContracts([makeContract({
			payload: [
				{ field: "id", type: "string", required: true, description: "First" },
				{ field: "id", type: "number", required: false, description: "Duplicate" },
			],
		})]);

		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({
			event: "test.event",
			field: "id",
			severity: "error",
			message: 'Duplicate payload field "id".',
		}));
	});

	it("reports error for invalid type", () => {
		const result = validateContracts([makeContract({
			payload: [
				{ field: "data", type: "invalid-type", required: true, description: "Bad type" },
			],
		})]);

		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({
			field: "data",
			severity: "error",
			message: expect.stringContaining("invalid type"),
		}));
	});

	it("reports error for empty field type", () => {
		const result = validateContracts([makeContract({
			payload: [
				{ field: "data", type: "", required: true, description: "Empty type" },
			],
		})]);

		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({
			field: "data",
			severity: "error",
			message: expect.stringContaining("empty type"),
		}));
	});

	it("reports error for empty field name", () => {
		const result = validateContracts([makeContract({
			payload: [
				{ field: "", type: "string", required: true, description: "No name" },
			],
		})]);

		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({
			severity: "error",
			message: "Payload field has an empty name.",
		}));
	});

	it("warns when no payload fields defined", () => {
		const result = validateContracts([makeContract({ payload: [] })]);
		expect(result.valid).toBe(true);
		expect(result.issues).toContainEqual(expect.objectContaining({
			severity: "warning",
			message: "No payload fields defined.",
		}));
	});

	it("warns when no producers defined", () => {
		const result = validateContracts([makeContract({ producers: [] })]);
		expect(result.issues).toContainEqual(expect.objectContaining({
			severity: "warning",
			message: "No producers defined.",
		}));
	});

	it("warns when no consumers defined", () => {
		const result = validateContracts([makeContract({ consumers: [] })]);
		expect(result.issues).toContainEqual(expect.objectContaining({
			severity: "warning",
			message: "No consumers defined.",
		}));
	});

	it("validates multiple contracts independently", () => {
		const contracts = [
			makeContract({ name: "good.event" }),
			makeContract({ name: "bad.event", domain: "", payload: [] }),
		];

		const result = validateContracts(contracts);
		expect(result.valid).toBe(false);
		const errorEvents = result.issues
			.filter((i) => i.severity === "error")
			.map((i) => i.event);
		expect(errorEvents).toContain("bad.event");
		expect(errorEvents).not.toContain("good.event");
	});

	it("accepts PascalCase custom types", () => {
		const result = validateContracts([makeContract({
			payload: [
				{ field: "user", type: "UserProfile", required: true, description: "User profile" },
			],
		})]);
		expect(result.valid).toBe(true);
		expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
	});
});

// ── generateContractsJson ──────────────────────────────────────────

describe("generateContractsJson", () => {
	it("produces valid JSON", () => {
		const contracts: EventContract[] = [{
			name: "test.event",
			domain: "test",
			version: "1.0.0",
			description: "A test event",
			producers: ["A"],
			consumers: ["B"],
			payload: [{ field: "id", type: "string", required: true, description: "ID" }],
		}];

		const json = generateContractsJson(contracts);
		const parsed = JSON.parse(json);

		expect(parsed).toHaveLength(1);
		expect(parsed[0].name).toBe("test.event");
		expect(parsed[0].payload[0].field).toBe("id");
	});

	it("pretty-prints with indentation", () => {
		const json = generateContractsJson([]);
		expect(json).toBe("[]");
	});

	it("serializes all fields", () => {
		const contract: EventContract = {
			name: "full.event",
			domain: "core",
			version: "2.0.0",
			description: "Full event",
			producers: ["P1", "P2"],
			consumers: ["C1"],
			payload: [
				{ field: "a", type: "string", required: true, description: "Field A" },
				{ field: "b", type: "number", required: false, description: "Field B" },
			],
		};

		const json = generateContractsJson([contract]);
		const parsed = JSON.parse(json);

		expect(parsed[0]).toEqual(contract);
	});
});

// ── loadEventContracts ─────────────────────────────────────────────

describe("loadEventContracts", () => {
	it("loads contracts from event files", () => {
		mockFiles["/project/docs/events/user-created.md"] = [
			"---",
			"name: user.created",
			"domain: user",
			"version: 1.0.0",
			"producers: UserService",
			"consumers: NotificationService",
			"---",
			"",
			"| Field | Type | Required | Description |",
			"| --- | --- | --- | --- |",
			"| userId | string | yes | The user ID |",
		].join("\n");

		mockFiles["/project/docs/events/order-placed.md"] = [
			"---",
			"name: order.placed",
			"domain: order",
			"version: 1.0.0",
			"producers: OrderService",
			"consumers: InventoryService",
			"---",
		].join("\n");

		const contracts = loadEventContracts(contractDeps, "/project/docs/events", disk);

		expect(contracts).toHaveLength(2);
		expect(contracts[0].name).toBe("order.placed");
		expect(contracts[1].name).toBe("user.created");
		expect(contracts[1].payload).toHaveLength(1);
	});

	it("returns empty array when directory does not exist", () => {
		const contracts = loadEventContracts(contractDeps, "/nonexistent/path", disk);
		expect(contracts).toEqual([]);
	});

	it("ignores non-markdown files", () => {
		mockFiles["/project/docs/events/readme.txt"] = "not an event";
		mockFiles["/project/docs/events/real-event.md"] = [
			"---",
			"name: real.event",
			"domain: core",
			"---",
		].join("\n");

		const contracts = loadEventContracts(contractDeps, "/project/docs/events", disk);
		expect(contracts).toHaveLength(1);
		expect(contracts[0].name).toBe("real.event");
	});

	it("sorts contracts by name", () => {
		mockFiles["/project/docs/events/z-event.md"] = "---\nname: z.event\ndomain: z\n---";
		mockFiles["/project/docs/events/a-event.md"] = "---\nname: a.event\ndomain: a\n---";
		mockFiles["/project/docs/events/m-event.md"] = "---\nname: m.event\ndomain: m\n---";

		const contracts = loadEventContracts(contractDeps, "/project/docs/events", disk);
		expect(contracts.map((c) => c.name)).toEqual(["a.event", "m.event", "z.event"]);
	});
});

// ── Runtime payload validation ──────────────────────────────────────

describe("validatePayload", () => {
	const contract: EventContract = {
		name: "user.created",
		domain: "user",
		version: "1.0.0",
		description: "User was created",
		producers: ["AuthService"],
		consumers: ["EmailService"],
		payload: [
			{ field: "id", type: "string", required: true, description: "User ID" },
			{ field: "email", type: "string", required: true, description: "Email" },
			{ field: "age", type: "number", required: false, description: "Age" },
			{ field: "active", type: "boolean", required: false, description: "Is active" },
			{ field: "metadata", type: "object", required: false, description: "Extra data" },
			{ field: "roles", type: "array", required: false, description: "User roles" },
		],
	};

	it("accepts valid payload with all required fields", () => {
		const result = validatePayload(contract, { id: "123", email: "a@b.com" });
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("accepts valid payload with optional fields", () => {
		const result = validatePayload(contract, {
			id: "123", email: "a@b.com", age: 30, active: true, metadata: { x: 1 }, roles: ["admin"],
		});
		expect(result.valid).toBe(true);
	});

	it("rejects payload missing required fields", () => {
		const result = validatePayload(contract, { id: "123" });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Missing required field "email".');
	});

	it("rejects payload with wrong types", () => {
		const result = validatePayload(contract, { id: 123, email: "a@b.com" });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('"id"') && e.includes("string"))).toBe(true);
	});

	it("rejects unknown fields", () => {
		const result = validatePayload(contract, { id: "123", email: "a@b.com", unknown: true });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Unknown field "unknown" not in contract.');
	});

	it("validates boolean type correctly", () => {
		const result = validatePayload(contract, { id: "1", email: "a@b.com", active: "yes" });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('"active"') && e.includes("boolean"))).toBe(true);
	});

	it("validates object type correctly", () => {
		const result = validatePayload(contract, { id: "1", email: "a@b.com", metadata: [1, 2] });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('"metadata"') && e.includes("object"))).toBe(true);
	});

	it("validates array type correctly", () => {
		const result = validatePayload(contract, { id: "1", email: "a@b.com", roles: "admin" });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('"roles"') && e.includes("array"))).toBe(true);
	});

	it("accepts null for optional fields", () => {
		const result = validatePayload(contract, { id: "1", email: "a@b.com", age: null });
		expect(result.valid).toBe(true);
	});

	it("accepts PascalCase custom types with any value", () => {
		const customContract: EventContract = {
			name: "order.placed", domain: "order", version: "1.0.0",
			description: "", producers: [], consumers: [],
			payload: [{ field: "userId", type: "UserId", required: true, description: "" }],
		};
		const result = validatePayload(customContract, { userId: { inner: "abc" } });
		expect(result.valid).toBe(true);
	});
});

describe("findContract", () => {
	const contracts: EventContract[] = [
		{ name: "user.created", domain: "user", version: "1.0.0", description: "", producers: [], consumers: [], payload: [] },
		{ name: "order.placed", domain: "order", version: "1.0.0", description: "", producers: [], consumers: [], payload: [] },
	];

	it("finds contract by name", () => {
		expect(findContract(contracts, "user.created")).toBeDefined();
		expect(findContract(contracts, "user.created")!.domain).toBe("user");
	});

	it("returns undefined for unknown name", () => {
		expect(findContract(contracts, "unknown.event")).toBeUndefined();
	});
});
