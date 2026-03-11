/**
 * ai-tool-reference.ts — Generate an AI Tool Reference document.
 *
 * Creates a markdown reference listing all AI tools,
 * their parameters, and validation status using the Document service.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { LoadedAiTool } from "./ai-tool-types.js";

export function generateAiToolReference(
	deps: Pick<CliDeps, "clock">,
	tools: LoadedAiTool[],
): Document {
	const date = deps.clock.iso();
	const valid = tools.filter((t) => t.valid);
	const invalid = tools.filter((t) => !t.valid);
	const allTags = [...new Set(valid.flatMap((t) => t.definition.tags ?? []))].sort();

	const doc = Document.create("AI Tool Reference")
		.mergeFrontmatter({
			type: "AiToolReference",
			date,
			total_tools: tools.length,
			valid_tools: valid.length,
			tags: allTags.length,
		})
		.addBlank()
		.heading(1, "AI Tool Reference")
		.addBlank()
		.callout("info", "Summary", [
			`Total tools: ${tools.length} | Valid: ${valid.length} | Tags: ${allTags.length}`,
		])
		.addBlank();

	if (valid.length > 0) {
		doc.heading(2, "Tools").addBlank();
		doc.table(
			["Tool", "Version", "Description", "Params"],
			valid.map((t) => [
				t.definition.name,
				t.definition.version ?? "-",
				t.definition.description,
				String((t.definition.params ?? []).length),
			]),
		);
		doc.addBlank();

		for (const tool of valid) {
			const def = tool.definition;
			doc.heading(3, def.name).addBlank();
			doc.text(def.description);
			doc.addBlank();
			doc.text(`**Run**: \`${def.run}\``);

			if (def.cwd) {
				doc.text(`**Working directory**: \`${def.cwd}\``);
			}
			doc.addBlank();

			const params = def.params ?? [];
			if (params.length > 0) {
				doc.heading(4, "Parameters").addBlank();
				doc.table(
					["Name", "Type", "Required", "Description"],
					params.map((p) => [
						p.name,
						p.type,
						p.required ? "Yes" : "No",
						p.description,
					]),
				);
				doc.addBlank();
			}

			const tags = def.tags ?? [];
			if (tags.length > 0) {
				doc.text(`**Tags**: ${tags.join(", ")}`);
				doc.addBlank();
			}
		}
	}

	if (invalid.length > 0) {
		doc.heading(2, "Invalid Tools").addBlank();
		doc.callout("warning", "Validation Errors", invalid.map((t) =>
			`**${t.definition.name}**: ${t.errors.join(", ")}`,
		));
		doc.addBlank();
	}

	return doc;
}
