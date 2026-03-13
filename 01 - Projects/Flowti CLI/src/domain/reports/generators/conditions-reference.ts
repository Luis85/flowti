/**
 * conditions-reference.ts — Generates a Sitemap Conditions Reference.
 *
 * Documents all hidden/disabled conditions, registered handler IDs,
 * the expression grammar, and available context keys.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

// ── Condition handler catalog ────────────────────────────────────────

interface ConditionEntry {
	id: string;
	type: "hidden" | "disabled";
	description: string;
	usedBy: string;
}

const CONDITION_HANDLERS: ConditionEntry[] = [
	{
		id: "no-project-selected",
		type: "hidden",
		description: "Returns true when no project is currently selected. Hides items that only make sense with an active project.",
		usedBy: "start view — \"Selected Project\" item + preceding separator",
	},
	{
		id: "knowledgebase:available",
		type: "disabled",
		description: "Returns true when the Knowledgebase is NOT available (no Obsidian CLI or vault). Disables the Knowledgebase menu item.",
		usedBy: "project-detail view — \"Knowledgebase\" item",
	},
	{
		id: "readme:exists",
		type: "disabled",
		description: "Returns true when no README.md exists in the project root. Disables the README viewer.",
		usedBy: "project-detail view — \"README\" item",
	},
];

const CONTEXT_KEYS: { key: string; source: string; description: string }[] = [
	{ key: "tools.esbuild", source: "Tool detection", description: "True if esbuild is installed" },
	{ key: "tools.typescript", source: "Tool detection", description: "True if TypeScript is installed" },
	{ key: "project", source: "Project state", description: "True when a project is selected" },
	{ key: "project.config", source: "Project state", description: "True when project config exists" },
	{ key: "config.build", source: "flowti.config.json", description: "True if build section is configured" },
	{ key: "config.test", source: "flowti.config.json", description: "True if test section is configured" },
	{ key: "config.publish", source: "flowti.config.json", description: "True if publish section is configured" },
	{ key: "config.review", source: "flowti.config.json", description: "True if review section is configured" },
	{ key: "config.reports", source: "flowti.config.json", description: "True if reports section is configured" },
	{ key: "config.health", source: "flowti.config.json", description: "True if health section is configured" },
	{ key: "config.management", source: "flowti.config.json", description: "True if management section is configured" },
];

// ── Generator ────────────────────────────────────────────────────────

export function generateConditionsReference(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);

	const doc = Document.create("Sitemap Conditions Reference")
		.mergeFrontmatter({
			type: "ConditionsReference",
			date: deps.clock.iso(),
			handlers: CONDITION_HANDLERS.length,
			context_keys: CONTEXT_KEYS.length,
			tags: ["reference", "sitemap", "conditions"],
		})
		.addBlank()
		.heading(1, "Sitemap Conditions Reference")
		.addBlank()
		.text("Documents the hidden/disabled condition system used by `configs/sitemap.json` to control menu item visibility and interactivity.")
		.addBlank();

	// ── Condition types
	doc.heading(2, "Condition Types").addBlank();

	doc.heading(3, "Hidden Conditions").addBlank()
		.text("Controls whether a menu item is rendered at all. When true, the item is completely removed from the menu.")
		.addBlank()
		.text("Supported forms:")
		.addBlank()
		.list([
			"`true` / `false` — literal boolean",
			"`\"handler-id\"` — calls a registered ConditionHandler function",
		])
		.addBlank()
		.text("Separators also support hidden conditions (added to control visual grouping).")
		.addBlank();

	doc.heading(3, "Disabled Conditions").addBlank()
		.text("Controls whether a menu item can be selected. The item still renders but appears grayed out with an optional message.")
		.addBlank()
		.text("Supported forms:")
		.addBlank()
		.list([
			"`true` / `false` — literal boolean",
			"`\"handler-id\"` — calls a registered ConditionHandler",
			"`{ \"unless\": \"expression\" }` — disabled when the expression evaluates to **false**",
		])
		.addBlank();

	// ── Registered handlers
	doc.heading(2, "Registered Condition Handlers").addBlank();
	doc.table(
		["ID", "Type", "Description", "Used By"],
		CONDITION_HANDLERS.map((h) => [
			`\`${h.id}\``,
			h.type,
			h.description,
			h.usedBy,
		]),
	).addBlank();

	// ── Expression grammar
	doc.heading(2, "Expression Grammar").addBlank()
		.text("The `{ unless: \"...\" }` form supports a recursive descent boolean expression parser.")
		.addBlank()
		.text("```")
		.text("expr     → orExpr")
		.text("orExpr   → andExpr (\"||\" andExpr)*")
		.text("andExpr  → unary (\"&&\" unary)*")
		.text("unary    → \"!\" unary | primary")
		.text("primary  → \"(\" expr \")\" | IDENTIFIER")
		.text("```")
		.addBlank()
		.text("Identifiers are dot-paths resolved against the router context (e.g. `tools.esbuild`, `config.build`).")
		.addBlank();

	doc.heading(3, "Examples").addBlank()
		.list([
			"`tools.esbuild || tools.typescript` — true if either build tool is installed",
			"`config.build && config.test` — true if both sections are configured",
			"`!project` — true if no project is selected",
			"`(tools.esbuild || tools.typescript) && config.build` — compound expression with precedence",
		])
		.addBlank();

	// ── Context keys
	doc.heading(2, "Available Context Keys").addBlank()
		.text("These keys are available for use in `{ unless }` expressions. They are built from the `RouterContext` at render time.")
		.addBlank();
	doc.table(
		["Key", "Source", "Description"],
		CONTEXT_KEYS.map((k) => [`\`${k.key}\``, k.source, k.description]),
	).addBlank();

	// ── Adding new conditions
	doc.heading(2, "Adding New Conditions").addBlank()
		.text("To add a new condition handler:")
		.addBlank()
		.list([
			"Register it in `src/ui/handlers/register-handlers.ts` using `registry.registerCondition(id, fn)`",
			"The function receives `RouterContext` and returns `boolean`",
			"Reference the ID in `configs/sitemap.json` as a `hidden` or `disabled` value",
			"Update this reference by adding the handler to the catalog in `conditions-reference.ts`",
		])
		.addBlank();

	const outputPath = svc.saveReference(doc, "Sitemap Conditions Reference.md");

	return {
		success: true,
		outputPath,
		metrics: {
			handlers: CONDITION_HANDLERS.length,
			context_keys: CONTEXT_KEYS.length,
		},
	};
}
