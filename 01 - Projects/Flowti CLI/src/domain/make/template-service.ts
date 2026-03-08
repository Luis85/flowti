/**
 * template-service.ts — Re-export shim for backward compatibility.
 *
 * Implementation moved to templates/config.ts and templates/file-writer.ts.
 */

export {
	toJson,
	manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
	type ManifestOptions, type ProjectKind,
} from "./templates/config.js";

export { createFileWriter, type WriteResult } from "./templates/file-writer.js";
