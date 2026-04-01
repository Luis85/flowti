import { convertMDSLToJSON, validateDefinition } from 'mistreevous';
import type { Logger } from '../../domain/core/logger.js';
import type { VaultReader } from './agent-spawner.js';

export interface MDSLLoadResult {
	mdsl: string | null;
	valid: boolean;
	errors: { file: string; message: string }[];
}

export function createMDSLLoader(
	logger: Logger,
): { loadComposed(vault: VaultReader, basePath: string, branchPath: string): Promise<MDSLLoadResult> } {
	return {
		async loadComposed(vault: VaultReader, basePath: string, branchPath: string): Promise<MDSLLoadResult> {
			const errors: { file: string; message: string }[] = [];

			let baseContent: string | null = null;
			let branchContent: string | null = null;

			try {
				baseContent = await vault.read(basePath);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				logger.warn('MDSLLoader', `Failed to read base file ${basePath}: ${message}`);
				errors.push({ file: basePath, message });
			}

			try {
				branchContent = await vault.read(branchPath);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				logger.warn('MDSLLoader', `Failed to read branch file ${branchPath}: ${message}`);
				errors.push({ file: branchPath, message });
			}

			if (baseContent === null || branchContent === null) {
				return { mdsl: null, valid: false, errors };
			}

			const composed = baseContent + '\n\n' + branchContent;

			try {
				convertMDSLToJSON(composed);
				const result = validateDefinition(composed);
				if (!result.succeeded) {
					const message = result.errorMessage ?? 'Validation failed';
					logger.warn('MDSLLoader', `MDSL validation failed: ${message}`);
					errors.push({ file: basePath, message });
					return { mdsl: composed, valid: false, errors };
				}
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				logger.warn('MDSLLoader', `MDSL parse error: ${message}`);
				errors.push({ file: basePath, message });
				return { mdsl: composed, valid: false, errors };
			}

			logger.info('MDSLLoader', `Composed and validated MDSL from ${basePath} + ${branchPath}`);
			return { mdsl: composed, valid: true, errors };
		},
	};
}
