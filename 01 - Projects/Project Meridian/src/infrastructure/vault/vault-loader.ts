import type { z } from 'zod';
import { Result, type ResultValue } from '../../domain/core/result.js';
import { parseFrontmatter } from './frontmatter-parser.js';
import { createQuarantine } from './quarantine.js';

export interface VaultLoader {
	loadEntity<T>(markdown: string, schema: z.ZodType<T>, filePath: string): ResultValue<T>;
	readonly quarantined: string[];
}

export function createVaultLoader(): VaultLoader {
	const quarantine = createQuarantine();

	return {
		get quarantined() { return quarantine.quarantined; },

		loadEntity<T>(markdown: string, schema: z.ZodType<T>, filePath: string): ResultValue<T> {
			const parsed = parseFrontmatter(markdown);
			if (!parsed.ok) {
				quarantine.add(filePath);
				return Result.err({ ...parsed.error, context: { filePath } });
			}

			const validated = schema.safeParse(parsed.value);
			if (!validated.success) {
				quarantine.add(filePath);
				return Result.err({
					code: 'SCHEMA_INVALID',
					message: `Schema validation failed for ${filePath}: ${validated.error.message}`,
					system: 'VaultSync',
					recoverable: true,
					context: { filePath, errors: validated.error.issues },
				});
			}

			return Result.ok(validated.data);
		},
	};
}
