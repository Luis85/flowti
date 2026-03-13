import { describe, it, expect } from "vitest";
import {
	parseRef,
	resolveRefs,
	createJourneyResolver,
	loadAllJourneys,
	validateRaw,
} from "../../../../src/domain/e2e/journey/journey-loader.js";
import type { JourneyDefinition, JourneyStep, JourneyRefStep } from "../../../../src/domain/e2e/journey/journey-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeStep(id: string, title?: string): JourneyStep {
	return {
		id,
		title: title ?? id,
		description: `Step ${id}`,
		actions: [{ tool: "log", message: id }],
	};
}

function makeJourney(name: string, steps: (JourneyStep | JourneyRefStep)[]): JourneyDefinition {
	return {
		journey: name,
		description: `Journey ${name}`,
		steps,
	};
}

// ── parseRef ────────────────────────────────────────────────────────

describe("parseRef", () => {
	it("parses a valid ref 'slug#step-id'", () => {
		expect(parseRef("login-journey#verify-auth")).toEqual({
			journeySlug: "login-journey",
			stepId: "verify-auth",
		});
	});

	it("parses a ref with simple names", () => {
		expect(parseRef("a#b")).toEqual({ journeySlug: "a", stepId: "b" });
	});

	it("returns null for a string without #", () => {
		expect(parseRef("no-hash")).toBeNull();
	});

	it("returns null for a string with empty slug", () => {
		expect(parseRef("#step-id")).toBeNull();
	});

	it("returns null for a string with empty step id", () => {
		expect(parseRef("slug#")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseRef("")).toBeNull();
	});

	it("returns null for multiple # characters (only first split matters)", () => {
		// "a#b#c" splits into ["a", "b", "c"] which has length 3
		expect(parseRef("a#b#c")).toBeNull();
	});
});

// ── resolveRefs ─────────────────────────────────────────────────────

describe("resolveRefs", () => {
	it("passes through inline steps unchanged", () => {
		const step = makeStep("s1");
		const journey = makeJourney("Test Journey", [step]);
		const result = resolveRefs(journey, () => null);

		expect(result.steps).toHaveLength(1);
		expect(result.steps[0]).toEqual(step);
	});

	it("resolves a $ref step from another journey", () => {
		const sharedStep = makeStep("shared-step", "Shared Step");
		const sharedJourney = makeJourney("Shared Journey", [sharedStep]);

		const journey = makeJourney("Main Journey", [
			makeStep("s1"),
			{ $ref: "shared-journey#shared-step" },
		]);

		const loader = (slug: string) => (slug === "shared-journey" ? sharedJourney : null);
		const result = resolveRefs(journey, loader);

		expect(result.steps).toHaveLength(2);
		expect((result.steps[1] as JourneyStep).id).toBe("shared-step");
		expect((result.steps[1] as JourneyStep).title).toBe("Shared Step");
	});

	it("resolves chained refs (A refs B which refs C)", () => {
		const cStep = makeStep("c-step", "From C");
		const journeyC = makeJourney("Journey C", [cStep]);

		const journeyB = makeJourney("Journey B", [
			{ $ref: "journey-c#c-step" },
		]);

		const journeyA = makeJourney("Journey A", [
			{ $ref: "journey-b#c-step" },
		]);

		const loader = (slug: string) => {
			if (slug === "journey-b") return journeyB;
			if (slug === "journey-c") return journeyC;
			return null;
		};

		const result = resolveRefs(journeyA, loader);
		expect(result.steps).toHaveLength(1);
		expect((result.steps[0] as JourneyStep).id).toBe("c-step");
	});

	it("throws on circular references", () => {
		const journeyA = makeJourney("Journey A", [{ $ref: "journey-b#s1" }]);
		const journeyB = makeJourney("Journey B", [
			makeStep("s1"),
			{ $ref: "journey-a#s1" },
		]);

		const loader = (slug: string) => {
			if (slug === "journey-a") return journeyA;
			if (slug === "journey-b") return journeyB;
			return null;
		};

		expect(() => resolveRefs(journeyA, loader)).toThrow(/[Cc]ircular/);
	});

	it("throws when referenced journey is not found", () => {
		const journey = makeJourney("Main", [{ $ref: "nonexistent#s1" }]);
		expect(() => resolveRefs(journey, () => null)).toThrow(/not found.*nonexistent/i);
	});

	it("throws when referenced step is not found", () => {
		const other = makeJourney("Other Journey", [makeStep("exists")]);
		const journey = makeJourney("Main", [{ $ref: "other-journey#missing" }]);

		const loader = (slug: string) => (slug === "other-journey" ? other : null);
		expect(() => resolveRefs(journey, loader)).toThrow(/step not found.*missing/i);
	});

	it("throws on invalid $ref format", () => {
		const journey = makeJourney("Main", [{ $ref: "no-hash" } as JourneyRefStep]);
		expect(() => resolveRefs(journey, () => null)).toThrow(/Invalid \$ref format/);
	});

	it("preserves journey metadata through resolution", () => {
		const journey: JourneyDefinition = {
			journey: "Main",
			description: "Main journey",
			chapter: 5,
			type: "functional",
			steps: [makeStep("s1")],
		};
		const result = resolveRefs(journey, () => null);
		expect(result.chapter).toBe(5);
		expect(result.type).toBe("functional");
		expect(result.description).toBe("Main journey");
	});
});

// ── createJourneyResolver ───────────────────────────────────────────

describe("createJourneyResolver", () => {
	it("resolves a journey by slug name", () => {
		const journeyJson = JSON.stringify(makeJourney("Login Flow", [makeStep("s1")]));

		const readFile = (path: string) => {
			if (path === "/journeys/login-flow.journey") return journeyJson;
			throw new Error("not found");
		};
		const listFiles = () => ["login-flow.journey"];

		const resolver = createJourneyResolver(readFile, listFiles, "/journeys");
		const result = resolver("login-flow");

		expect(result).not.toBeNull();
		expect(result!.journey).toBe("Login Flow");
	});

	it("returns null for unknown slug", () => {
		const resolver = createJourneyResolver(
			() => { throw new Error("no"); },
			() => ["other.journey"],
			"/journeys",
		);
		expect(resolver("missing")).toBeNull();
	});

	it("caches resolved journeys", () => {
		let readCount = 0;
		const journeyJson = JSON.stringify(makeJourney("Cached", [makeStep("s1")]));
		const readFile = () => { readCount++; return journeyJson; };
		const listFiles = () => ["cached.journey"];

		const resolver = createJourneyResolver(readFile, listFiles, "/journeys");
		resolver("cached");
		resolver("cached");

		expect(readCount).toBe(1);
	});

	it("ignores non-.journey files", () => {
		const resolver = createJourneyResolver(
			() => { throw new Error("should not read"); },
			() => ["readme.md", "config.json"],
			"/journeys",
		);
		expect(resolver("readme")).toBeNull();
	});
});

// ── loadAllJourneys ─────────────────────────────────────────────────

describe("loadAllJourneys", () => {
	it("loads and resolves all .journey files from a directory", () => {
		const journeyA = makeJourney("Alpha", [makeStep("a1")]);
		const journeyB = makeJourney("Beta", [makeStep("b1")]);

		const files: Record<string, string> = {
			"/dir/alpha.journey": JSON.stringify(journeyA),
			"/dir/beta.journey": JSON.stringify(journeyB),
		};

		const readFile = (path: string) => files[path] ?? (() => { throw new Error("missing"); })();
		const listFiles = () => ["alpha.journey", "beta.journey"];

		const result = loadAllJourneys(readFile, listFiles, "/dir");
		expect(result).toHaveLength(2);
		expect(result.map((j) => j.journey).sort()).toEqual(["Alpha", "Beta"]);
	});

	it("resolves $refs across loaded journeys", () => {
		const shared = makeJourney("Shared", [makeStep("shared-step", "Shared Step")]);
		const main = makeJourney("Main", [
			makeStep("m1"),
			{ $ref: "shared#shared-step" },
		]);

		const files: Record<string, string> = {
			"/dir/shared.journey": JSON.stringify(shared),
			"/dir/main.journey": JSON.stringify(main),
		};

		const readFile = (path: string) => {
			if (files[path]) return files[path];
			throw new Error(`File not found: ${path}`);
		};
		const listFiles = () => ["shared.journey", "main.journey"];

		const result = loadAllJourneys(readFile, listFiles, "/dir");
		const mainResult = result.find((j) => j.journey === "Main");
		expect(mainResult).toBeDefined();
		expect(mainResult!.steps).toHaveLength(2);
		expect((mainResult!.steps[1] as JourneyStep).id).toBe("shared-step");
	});

	it("skips invalid journey files gracefully", () => {
		const valid = makeJourney("Valid", [makeStep("s1")]);

		const files: Record<string, string> = {
			"/dir/valid.journey": JSON.stringify(valid),
			"/dir/broken.journey": "not valid json {{{",
		};

		const readFile = (path: string) => files[path]!;
		const listFiles = () => ["valid.journey", "broken.journey"];

		const result = loadAllJourneys(readFile, listFiles, "/dir");
		expect(result).toHaveLength(1);
		expect(result[0].journey).toBe("Valid");
	});

	it("ignores non-.journey files in the listing", () => {
		const j = makeJourney("Only", [makeStep("s1")]);
		const files: Record<string, string> = {
			"/dir/only.journey": JSON.stringify(j),
		};

		const readFile = (path: string) => files[path]!;
		const listFiles = () => ["only.journey", "readme.md", ".gitkeep"];

		const result = loadAllJourneys(readFile, listFiles, "/dir");
		expect(result).toHaveLength(1);
	});
});

// ── validateRaw accepts $ref steps ──────────────────────────────────

describe("validateRaw with $ref steps", () => {
	it("accepts a journey with a valid $ref step", () => {
		const raw = {
			journey: "Test",
			steps: [{ $ref: "other#step-1" }],
		};
		const errors = validateRaw(raw);
		expect(errors).toHaveLength(0);
	});

	it("rejects a $ref step with an empty string", () => {
		const raw = {
			journey: "Test",
			steps: [{ $ref: "" }],
		};
		const errors = validateRaw(raw);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].path).toContain("$ref");
	});

	it("accepts a mix of inline and $ref steps", () => {
		const raw = {
			journey: "Mixed",
			steps: [
				{ id: "s1", title: "Step 1", description: "desc", actions: [{ tool: "log" }] },
				{ $ref: "other#s2" },
			],
		};
		const errors = validateRaw(raw);
		expect(errors).toHaveLength(0);
	});
});
