/**
 * plugin-reference.ts — Generate a Plugin Reference document.
 *
 * Creates a markdown reference listing all installed plugins,
 * their commands, and validation status using the Document service.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { LoadedPlugin } from "./plugin-types.js";

export function generatePluginReference(
	deps: Pick<CliDeps, "clock">,
	plugins: LoadedPlugin[],
): Document {
	const date = deps.clock.iso();
	const valid = plugins.filter((p) => p.valid);
	const invalid = plugins.filter((p) => !p.valid);
	const totalCommands = valid.reduce((sum, p) => sum + Object.keys(p.commands).length, 0);

	const doc = Document.create("Plugin Reference")
		.mergeFrontmatter({
			type: "PluginReference",
			date,
			total_plugins: plugins.length,
			valid_plugins: valid.length,
			total_commands: totalCommands,
		})
		.addBlank()
		.heading(1, "Plugin Reference")
		.addBlank()
		.callout("info", "Summary", [
			`Total plugins: ${plugins.length} | Valid: ${valid.length} | Commands: ${totalCommands}`,
		])
		.addBlank();

	if (valid.length > 0) {
		doc.heading(2, "Plugins").addBlank();
		doc.table(
			["Plugin", "Version", "Description", "Commands"],
			valid.map((p) => [
				p.manifest.name,
				p.manifest.version ?? "-",
				p.manifest.description,
				String(Object.keys(p.commands).length),
			]),
		);
		doc.addBlank();

		for (const plugin of valid) {
			doc.heading(3, plugin.manifest.name).addBlank();
			doc.text(plugin.manifest.description);
			doc.addBlank();

			const cmds = Object.entries(plugin.manifest.commands);
			if (cmds.length > 0) {
				doc.table(
					["Command", "Description", "Run"],
					cmds.map(([name, def]) => [name, def.description, `\`${def.run}\``]),
				);
				doc.addBlank();
			}
		}
	}

	if (invalid.length > 0) {
		doc.heading(2, "Invalid Plugins").addBlank();
		doc.callout("warning", "Validation Errors", invalid.map((p) =>
			`**${p.manifest.name}**: ${p.errors.join(", ")}`,
		));
		doc.addBlank();
	}

	return doc;
}
