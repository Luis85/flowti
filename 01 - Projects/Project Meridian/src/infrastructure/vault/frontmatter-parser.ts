import { Result, type ResultValue } from '../../domain/core/result.js';
import { parse as parseYaml } from 'yaml';

export function parseFrontmatter(markdown: string): ResultValue<Record<string, unknown>> {
	const match = /^---\r?\n([\s\S]*?\r?\n)?---/.exec(markdown);
	if (match === null) {
		return Result.err({
			code: 'FRONTMATTER_MISSING',
			message: 'No frontmatter delimiters found',
			system: 'VaultSync',
			recoverable: true,
		});
	}

	const yamlContent = match[1]?.trim() ?? '';
	if (yamlContent === '') {
		return Result.ok({});
	}

	return parseYamlSafe(yamlContent);
}

function parseYamlSafe(content: string): ResultValue<Record<string, unknown>> {
	try {
		const data: unknown = parseYaml(content);
		if (typeof data !== 'object' || data === null) {
			return Result.err({
				code: 'FRONTMATTER_NOT_OBJECT',
				message: 'Frontmatter did not parse to an object',
				system: 'VaultSync',
				recoverable: true,
			});
		}
		return Result.ok(data as Record<string, unknown>);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown parse error';
		return Result.err({
			code: 'YAML_PARSE_ERROR',
			message: `Failed to parse YAML frontmatter: ${message}`,
			system: 'VaultSync',
			recoverable: true,
		});
	}
}
