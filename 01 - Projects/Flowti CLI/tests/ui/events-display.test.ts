import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../src/infrastructure/logger.js";
import {
	renderEventList,
	renderEventFlowCreated,
	renderEventAdded,
	renderContractValidation,
	renderPayloadValidation,
	renderContractsGenerated,
	renderCodegenGenerated,
	renderEmpty,
	renderVersionEvent,
} from "../../src/ui/events-display.js";
import type {
	EventListModel,
	ContractValidationModel,
	PayloadValidationModel,
	ContractsGeneratedModel,
	CodegenGeneratedModel,
	VersionEventModel,
} from "../../src/ui/events-display.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderEventList ──────────────────────────────────────────────────

describe("renderEventList", () => {
	it("renders empty message when no events", () => {
		renderEventList({ events: [] });
		expect(output()).toContain("No events defined.");
	});

	it("renders event entries with name, domain, and version", () => {
		const data: EventListModel = {
			events: [
				{ name: "user.created", domain: "user", version: "1.0.0", file: "user-created.md" },
				{ name: "order.placed", domain: "order", version: "2.1.0", file: "order-placed.md" },
			],
		};
		renderEventList(data);
		const out = output();
		expect(out).toContain("user.created [user] v1.0.0");
		expect(out).toContain("order.placed [order] v2.1.0");
	});

	it("renders single event", () => {
		renderEventList({ events: [{ name: "evt", domain: "d", version: "1.0.0", file: "evt.md" }] });
		expect(output()).toContain("evt [d] v1.0.0");
	});
});

// ── renderEventFlowCreated ───────────────────────────────────────────

describe("renderEventFlowCreated", () => {
	it("renders generated path", () => {
		renderEventFlowCreated({ relativePath: "events/flow.json" });
		expect(output()).toContain("Generated: events/flow.json");
		expect(output()).toContain("✓");
	});
});

// ── renderEventAdded ─────────────────────────────────────────────────

describe("renderEventAdded", () => {
	it("renders created path", () => {
		renderEventAdded({ relativePath: "events/new-event.md" });
		expect(output()).toContain("Created: events/new-event.md");
		expect(output()).toContain("✓");
	});
});

// ── renderContractValidation ─────────────────────────────────────────

describe("renderContractValidation", () => {
	it("renders all valid message when no issues", () => {
		const data: ContractValidationModel = {
			contractCount: 3,
			result: { valid: true, issues: [] },
		};
		renderContractValidation(data);
		const out = output();
		expect(out).toContain("Validated 3 event contract(s).");
		expect(out).toContain("All contracts are valid.");
	});

	it("renders errors with ✗ marker", () => {
		const data: ContractValidationModel = {
			contractCount: 1,
			result: {
				valid: false,
				issues: [{ event: "user.created", severity: "error", message: "Missing domain." }],
			},
		};
		renderContractValidation(data);
		const out = output();
		expect(out).toContain("✗");
		expect(out).toContain("user.created");
		expect(out).toContain("Missing domain.");
	});

	it("renders warnings with ⚠ marker", () => {
		const data: ContractValidationModel = {
			contractCount: 1,
			result: {
				valid: true,
				issues: [{ event: "evt", severity: "warning", message: "No payload fields defined." }],
			},
		};
		renderContractValidation(data);
		const out = output();
		expect(out).toContain("⚠");
		expect(out).toContain("No payload fields defined.");
	});

	it("renders field tag when issue has field", () => {
		const data: ContractValidationModel = {
			contractCount: 1,
			result: {
				valid: false,
				issues: [{ event: "evt", field: "name", severity: "error", message: "Bad type." }],
			},
		};
		renderContractValidation(data);
		expect(output()).toContain("→ name");
	});

	it("does not render field tag when issue has no field", () => {
		const data: ContractValidationModel = {
			contractCount: 1,
			result: {
				valid: false,
				issues: [{ event: "evt", severity: "error", message: "Missing." }],
			},
		};
		renderContractValidation(data);
		expect(output()).not.toContain("→");
	});

	it("renders invalid summary when not valid", () => {
		const data: ContractValidationModel = {
			contractCount: 2,
			result: {
				valid: false,
				issues: [
					{ event: "a", severity: "error", message: "E1" },
					{ event: "b", severity: "warning", message: "W1" },
				],
			},
		};
		renderContractValidation(data);
		expect(output()).toContain("contracts invalid.");
	});

	it("renders valid summary with warnings only", () => {
		const data: ContractValidationModel = {
			contractCount: 1,
			result: {
				valid: true,
				issues: [{ event: "a", severity: "warning", message: "W1" }],
			},
		};
		renderContractValidation(data);
		expect(output()).toContain("contracts valid.");
	});

	it("renders error and warning counts in summary", () => {
		const data: ContractValidationModel = {
			contractCount: 2,
			result: {
				valid: false,
				issues: [
					{ event: "a", severity: "error", message: "E1" },
					{ event: "a", severity: "error", message: "E2" },
					{ event: "b", severity: "warning", message: "W1" },
				],
			},
		};
		renderContractValidation(data);
		expect(output()).toContain("2 error(s), 1 warning(s)");
	});
});

// ── renderPayloadValidation ──────────────────────────────────────────

describe("renderPayloadValidation", () => {
	it("renders valid payload", () => {
		const data: PayloadValidationModel = {
			eventName: "user.created",
			result: { valid: true, errors: [] },
		};
		renderPayloadValidation(data);
		expect(output()).toContain('Payload valid for "user.created".');
		expect(output()).toContain("✓");
	});

	it("renders invalid payload with errors", () => {
		const data: PayloadValidationModel = {
			eventName: "order.placed",
			result: { valid: false, errors: ['Missing required field "amount".', 'Unknown field "extra".'] },
		};
		renderPayloadValidation(data);
		const out = output();
		expect(out).toContain('Payload invalid for "order.placed"');
		expect(out).toContain("✗");
		expect(out).toContain('Missing required field "amount".');
		expect(out).toContain('Unknown field "extra".');
	});

	it("renders bullet markers for each error", () => {
		const data: PayloadValidationModel = {
			eventName: "e",
			result: { valid: false, errors: ["err1", "err2"] },
		};
		renderPayloadValidation(data);
		expect(output()).toContain("•");
	});
});

// ── renderContractsGenerated ─────────────────────────────────────────

describe("renderContractsGenerated", () => {
	it("renders path and contract count", () => {
		const data: ContractsGeneratedModel = { relativePath: "events/contracts.json", contractCount: 5 };
		renderContractsGenerated(data);
		expect(output()).toContain("Generated: events/contracts.json (5 contracts)");
	});
});

// ── renderCodegenGenerated ───────────────────────────────────────────

describe("renderCodegenGenerated", () => {
	it("renders path and interface count", () => {
		const data: CodegenGeneratedModel = { relativePath: "src/types.ts", contractCount: 3 };
		renderCodegenGenerated(data);
		expect(output()).toContain("Generated: src/types.ts (3 interfaces)");
	});
});

// ── renderEmpty ──────────────────────────────────────────────────────

describe("renderEmpty", () => {
	it("renders the provided message", () => {
		renderEmpty({ message: "Nothing to show." });
		expect(output()).toContain("Nothing to show.");
	});
});

// ── renderVersionEvent ───────────────────────────────────────────────

describe("renderVersionEvent", () => {
	it("renders updated event with versions", () => {
		const data: VersionEventModel = {
			success: true, name: "user.created", newVersion: "2.0.0", previousVersion: "1.0.0",
		};
		renderVersionEvent(data);
		const out = output();
		expect(out).toContain("Updated user.created to v2.0.0");
		expect(out).toContain("Previous version: v1.0.0");
	});
});
