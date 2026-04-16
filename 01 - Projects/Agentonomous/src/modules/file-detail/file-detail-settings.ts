import { ok, err, type Result } from '../../domain/shared/result.js';

export type FileDetailSettings = {
	readonly enabled: boolean;
};

export const FILE_DETAIL_DEFAULTS: FileDetailSettings = {
	enabled: true,
};

export function validateFileDetailSettings(raw: unknown): Result<FileDetailSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('file-detail settings must be an object');
	}
	const { enabled } = raw as Record<string, unknown>;
	if (typeof enabled !== 'boolean') return err('enabled must be boolean');
	return ok({ enabled });
}
