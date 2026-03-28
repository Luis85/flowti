import { GameConfigSchema } from '../../domain/schemas/game-config-schema.js';
import type { GameConfig } from '../../domain/schemas/game-config-schema.js';
import { Result, type ResultValue } from '../../domain/core/result.js';

export function loadGameConfig(jsonString: string): ResultValue<GameConfig> {
	let raw: unknown;
	try {
		raw = JSON.parse(jsonString);
	} catch {
		return Result.err({
			code: 'CONFIG_PARSE_ERROR',
			message: 'Failed to parse game-config.json',
			system: 'Config',
			recoverable: true,
		});
	}

	const validated = GameConfigSchema.safeParse(raw);
	if (!validated.success) {
		return Result.err({
			code: 'CONFIG_SCHEMA_INVALID',
			message: `game-config.json validation failed: ${validated.error.message}`,
			system: 'Config',
			recoverable: true,
		});
	}

	return Result.ok(validated.data);
}
